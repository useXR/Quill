import { describe, it, expect } from 'vitest';
import { createMockClaudeProcess, createMockClaudeError } from './mocks/mock-claude-cli';

describe('createMockClaudeProcess', () => {
  it('should emit success data for success scenario', async () => {
    const proc = createMockClaudeProcess({
      scenario: 'success',
      responseChunks: ['{"content":"Test response"}'],
    });

    const dataPromise = new Promise<string>((resolve) => {
      proc.stdout!.on('data', (data) => resolve(data.toString()));
    });

    const data = await dataPromise;
    expect(data).toContain('Test response');
  });

  it('should emit auth error for auth_error scenario', async () => {
    const proc = createMockClaudeProcess({ scenario: 'auth_error' });

    const errorPromise = new Promise<string>((resolve) => {
      proc.stderr!.on('data', (data) => resolve(data.toString()));
    });

    const data = await errorPromise;
    expect(data).toContain('Authentication failed');
  });

  it('should emit rate limit error for rate_limit scenario', async () => {
    const proc = createMockClaudeProcess({ scenario: 'rate_limit' });

    const errorPromise = new Promise<string>((resolve) => {
      proc.stderr!.on('data', (data) => resolve(data.toString()));
    });

    const data = await errorPromise;
    expect(data).toContain('Rate limit exceeded');
  });

  it('should emit ENOENT error for cli_not_found scenario', async () => {
    const proc = createMockClaudeProcess({ scenario: 'cli_not_found' });

    const errorPromise = new Promise<Error>((resolve) => {
      proc.on('error', (err) => resolve(err));
    });

    const error = await errorPromise;
    expect(error.message).toContain('ENOENT');
  });

  it('should emit close with exit code for success', async () => {
    const proc = createMockClaudeProcess({ scenario: 'success' });

    const closePromise = new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? -1));
    });

    const code = await closePromise;
    expect(code).toBe(0);
  });

  it('should emit close with error exit code for failures', async () => {
    const proc = createMockClaudeProcess({ scenario: 'auth_error' });

    const closePromise = new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? -1));
    });

    const code = await closePromise;
    expect(code).toBe(1);
  });

  it('should emit multiple chunks for slow_stream scenario', async () => {
    const proc = createMockClaudeProcess({
      scenario: 'slow_stream',
      responseChunks: ['{"content":"A"}', '{"content":"B"}', '{"content":"C"}'],
    });

    const chunks: string[] = [];
    proc.stdout!.on('data', (data) => chunks.push(data.toString()));

    await new Promise<void>((resolve) => {
      proc.on('close', () => resolve());
    });

    expect(chunks).toHaveLength(3);
  });

  it('should handle partial_then_error scenario', async () => {
    const proc = createMockClaudeProcess({ scenario: 'partial_then_error' });

    const outputs: string[] = [];
    const errors: string[] = [];

    proc.stdout!.on('data', (data) => outputs.push(data.toString()));
    proc.stderr!.on('data', (data) => errors.push(data.toString()));

    await new Promise<void>((resolve) => {
      proc.on('close', () => resolve());
    });

    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toContain('Partial');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Connection lost');
  });

  it('should have kill function that returns true', () => {
    const proc = createMockClaudeProcess({ scenario: 'success' });
    expect(proc.kill()).toBe(true);
    expect(proc.kill).toHaveBeenCalled();
  });

  it('should have pid property', () => {
    const proc = createMockClaudeProcess({ scenario: 'success' });
    expect(proc.pid).toBe(12345);
  });
});

describe('createMockClaudeError', () => {
  it('should create default error', () => {
    const error = createMockClaudeError();
    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBe('An error occurred');
    expect(error.retryable).toBe(false);
  });

  it('should allow overrides', () => {
    const error = createMockClaudeError({
      code: 'AUTH_FAILURE',
      message: 'Custom error',
      retryable: false,
      suggestion: 'Run claude login',
    });
    expect(error.code).toBe('AUTH_FAILURE');
    expect(error.message).toBe('Custom error');
    expect(error.suggestion).toBe('Run claude login');
  });
});
