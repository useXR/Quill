import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAuthAttempt } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Validate that a redirect URL is safe (same origin or relative)
 */
function isValidRedirectUrl(url: string, origin: string): boolean {
  // Allow relative URLs starting with /
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // Check if URL is same origin
  try {
    const parsed = new URL(url);
    const originParsed = new URL(origin);
    return parsed.origin === originParsed.origin;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  // Get IP address for logging
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';

  // Validate redirect URL to prevent open redirect
  const redirectTo = isValidRedirectUrl(next, origin) ? next : '/projects';

  // Debug: Log all cookies present at callback
  const allCookies = request.cookies.getAll();
  logger.info(
    {
      cookieNames: allCookies.map((c) => c.name),
      cookieCount: allCookies.length,
      ipAddress,
    },
    'Auth callback - cookies present'
  );

  if (!code) {
    logger.warn({ ipAddress }, 'Auth callback called without code');
    return NextResponse.redirect(new URL('/login?error=missing_code', origin));
  }

  try {
    // Use the server client helper which uses cookies() from next/headers
    // This properly reads the PKCE code_verifier cookie set during login
    const supabase = await createClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error({ error, ipAddress }, 'Failed to exchange code for session');
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
    }

    if (data.user?.email) {
      // Record successful auth attempt
      await recordAuthAttempt(data.user.email, ipAddress, true);
      logger.info({ userId: data.user.id, email: data.user.email }, 'User authenticated successfully');
    }

    // Redirect to the intended destination
    const redirectUrl = new URL(redirectTo, origin);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error({ error, ipAddress }, 'Auth callback error');
    return NextResponse.redirect(new URL('/login?error=server_error', origin));
  }
}
