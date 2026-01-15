import { describe, it, expect } from 'vitest';
import { categorizeError, isRetryableError } from '../errors';

describe('categorizeError', () => {
  it('should categorize authentication errors', () => {
    const error = categorizeError('authentication failed');
    expect(error.code).toBe('AUTH_FAILURE');
    expect(error.retryable).toBe(false);
  });

  it('should categorize "please login" errors', () => {
    const error = categorizeError('Please run claude login first');
    expect(error.code).toBe('AUTH_FAILURE');
    expect(error.retryable).toBe(false);
    expect(error.suggestion).toContain('claude login');
  });

  it('should categorize rate limit errors with retry time', () => {
    const error = categorizeError('rate limit exceeded. wait 60 seconds');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(60000);
  });

  it('should categorize "too many requests" errors', () => {
    const error = categorizeError('Too many requests');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryable).toBe(true);
  });

  it('should extract retry time from various formats', () => {
    expect(categorizeError('rate limit, retry in 30 seconds').retryAfterMs).toBe(30000);
    expect(categorizeError('rate limited').retryAfterMs).toBe(60000); // Default
  });

  it('should categorize CLI not found errors', () => {
    const error = categorizeError('ENOENT: command not found');
    expect(error.code).toBe('CLI_NOT_FOUND');
    expect(error.retryable).toBe(false);
  });

  it('should categorize generic "not found" errors as CLI_NOT_FOUND', () => {
    const error = categorizeError('command not found: claude');
    expect(error.code).toBe('CLI_NOT_FOUND');
  });

  it('should categorize timeout errors', () => {
    const error = categorizeError('Request timed out');
    expect(error.code).toBe('TIMEOUT');
    expect(error.retryable).toBe(true);
  });

  it('should categorize context too long errors', () => {
    const error = categorizeError('context too long, token limit exceeded');
    expect(error.code).toBe('CONTEXT_TOO_LONG');
    expect(error.retryable).toBe(false);
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    const error = categorizeError('some random error');
    expect(error.code).toBe('UNKNOWN');
    expect(error.retryable).toBe(false);
  });

  it('should preserve partial content', () => {
    const error = categorizeError('timeout', 'partial output');
    expect(error.partialContent).toBe('partial output');
  });

  it('should accept Error objects', () => {
    const error = categorizeError(new Error('authentication failed'));
    expect(error.code).toBe('AUTH_FAILURE');
  });
});

describe('isRetryableError', () => {
  it('should return true for rate limited errors', () => {
    const error = categorizeError('rate limit');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for timeout errors', () => {
    const error = categorizeError('timed out');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for auth errors', () => {
    const error = categorizeError('authentication failed');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for CLI not found errors', () => {
    const error = categorizeError('ENOENT');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for context too long errors', () => {
    const error = categorizeError('context too long');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for unknown errors', () => {
    const error = categorizeError('mysterious error');
    expect(isRetryableError(error)).toBe(false);
  });
});
