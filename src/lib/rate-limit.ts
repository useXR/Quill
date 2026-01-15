interface RateLimitConfig {
  limit: number;
  window: number; // seconds
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter?: number;
}

// Simple in-memory rate limiter
// NOTE: For production multi-instance deployment, use Redis (see Production Considerations)
const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  return async (identifier: string): Promise<RateLimitResult> => {
    const now = Date.now();
    const windowMs = config.window * 1000;
    const key = identifier;

    let record = requests.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      requests.set(key, record);
    }

    record.count++;

    if (record.count > config.limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { success: false, remaining: 0, retryAfter };
    }

    return { success: true, remaining: config.limit - record.count };
  };
}

/**
 * Clear all rate limit records (useful for testing)
 */
export function clearRateLimits(): void {
  requests.clear();
}
