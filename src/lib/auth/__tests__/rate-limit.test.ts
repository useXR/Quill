import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { checkRateLimit, recordAuthAttempt } from '../rate-limit';

// Mock the supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

describe('rate-limit', () => {
  const mockRpc = vi.fn();
  const mockInsert = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      insert: mockInsert,
    });

    (createClient as Mock).mockResolvedValue({
      rpc: mockRpc,
      from: mockFrom,
    });
  });

  describe('checkRateLimit', () => {
    it('should return allowed: true when rate limit check passes', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const result = await checkRateLimit('test@example.com', '192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
      expect(mockRpc).toHaveBeenCalledWith('check_auth_rate_limit', {
        p_email: 'test@example.com',
        p_ip: '192.168.1.1',
      });
    });

    it('should return allowed: false with retryAfter when rate limited', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const result = await checkRateLimit('test@example.com', '192.168.1.1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(3600); // 60 minutes * 60 seconds
    });

    it('should fail open and log error when RPC fails', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };
      mockRpc.mockResolvedValue({ data: null, error: mockError });

      const result = await checkRateLimit('test@example.com', '192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        { error: mockError, email: 'test@example.com', ipAddress: '192.168.1.1' },
        'Rate limit check failed'
      );
    });
  });

  describe('recordAuthAttempt', () => {
    it('should record successful auth attempt', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await recordAuthAttempt('test@example.com', '192.168.1.1', true);

      expect(mockFrom).toHaveBeenCalledWith('auth_attempts');
      expect(mockInsert).toHaveBeenCalledWith({
        email: 'test@example.com',
        ip_address: '192.168.1.1',
        success: true,
      });
    });

    it('should record failed auth attempt', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await recordAuthAttempt('test@example.com', '192.168.1.1', false);

      expect(mockInsert).toHaveBeenCalledWith({
        email: 'test@example.com',
        ip_address: '192.168.1.1',
        success: false,
      });
    });

    it('should log warning when insert fails', async () => {
      const mockError = { message: 'Insert failed', code: 'INSERT_ERROR' };
      mockInsert.mockResolvedValue({ error: mockError });

      await recordAuthAttempt('test@example.com', '192.168.1.1', true);

      expect(logger.warn).toHaveBeenCalledWith(
        { error: mockError, email: 'test@example.com' },
        'Failed to record auth attempt'
      );
    });
  });
});
