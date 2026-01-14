import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { recordAuthAttempt } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/supabase/database.types';

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

  if (!code) {
    logger.warn({ ipAddress }, 'Auth callback called without code');
    return NextResponse.redirect(new URL('/login?error=missing_code', origin));
  }

  // Create response that we'll add cookies to
  const redirectUrl = new URL(redirectTo, origin);
  const response = NextResponse.redirect(redirectUrl);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Create Supabase client that sets cookies on the response
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

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

    return response;
  } catch (error) {
    logger.error({ error, ipAddress }, 'Auth callback error');
    return NextResponse.redirect(new URL('/login?error=server_error', origin));
  }
}
