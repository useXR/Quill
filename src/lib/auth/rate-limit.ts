import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { AUTH } from '@/lib/constants';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(email: string, ipAddress: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('check_auth_rate_limit', {
    p_email: email,
    p_ip: ipAddress,
  });

  if (error) {
    logger.error({ error, email, ipAddress }, 'Rate limit check failed');
    return { allowed: true }; // Fail open
  }

  const retryAfterSeconds = AUTH.RATE_LIMIT_WINDOW_MINUTES * 60;
  return {
    allowed: data === true,
    retryAfter: data === true ? undefined : retryAfterSeconds,
  };
}

export async function recordAuthAttempt(email: string, ipAddress: string, success: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('auth_attempts').insert({
    email,
    ip_address: ipAddress,
    success,
  });
  if (error) {
    logger.warn({ error, email }, 'Failed to record auth attempt');
  }
}
