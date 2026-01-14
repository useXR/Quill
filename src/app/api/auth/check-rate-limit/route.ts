import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface RateLimitRequest {
  email: string;
}

interface RateLimitResponse {
  allowed: boolean;
  retryAfter?: number;
}

interface ErrorResponse {
  error: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RateLimitResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as RateLimitRequest;
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Get IP address from request headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    const result = await checkRateLimit(email, ipAddress);

    if (!result.allowed) {
      logger.info({ email, ipAddress }, 'Rate limit exceeded');
      return NextResponse.json({ allowed: false, retryAfter: result.retryAfter }, { status: 429 });
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    logger.error({ error }, 'Rate limit check endpoint error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
