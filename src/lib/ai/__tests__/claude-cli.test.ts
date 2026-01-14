/**
 * Tests for Claude CLI wrapper module.
 *
 * Tests process spawning, response parsing, error handling, and retry logic
 * using mock CLI processes.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { setupMockClaude } from './mocks/mock-claude-cli';

// Use vi.hoisted to create a stable mock reference that both the factory and tests can use
const mocks = vi.hoisted(() => {
  return {
    spawn: vi.fn(),
  };
});

// Mock child_process WITHOUT importOriginal - provide our own minimal mock
vi.mock('child_process', () => {
  const mockModule = {
    spawn: mocks.spawn,
    ChildProcess: class {},
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Import module under test - uses the mocked spawn
import { invokeClaude, cancelClaude } from '../claude-cli';

describe('invokeClaude', () => {
  beforeEach(() => {
    // Reset mock state between tests
    mocks.spawn.mockReset();
  });

  afterEach(() => {
    cancelClaude();
  });

  it('should return content for successful response', async () => {
    setupMockClaude(
      {
        scenario: 'success',
        responseChunks: ['{"content":"Hello world"}'],
      },
      mocks.spawn
    );

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('Hello world');
    expect(result.error).toBeUndefined();
  });

  it('should concatenate multi-chunk responses', async () => {
    setupMockClaude(
      {
        scenario: 'success',
        responseChunks: ['{"content":"Hello "}', '{"content":"world"}'],
      },
      mocks.spawn
    );

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('Hello world');
  });

  it('should handle auth errors with proper error code', async () => {
    setupMockClaude({ scenario: 'auth_error' }, mocks.spawn);

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.error?.code).toBe('AUTH_FAILURE');
    expect(result.error?.retryable).toBe(false);
  });

  it('should handle CLI not found', async () => {
    setupMockClaude({ scenario: 'cli_not_found' }, mocks.spawn);

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.error?.code).toBe('CLI_NOT_FOUND');
  });

  it('should recover partial content on error', async () => {
    setupMockClaude({ scenario: 'partial_then_error' }, mocks.spawn);

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.partial).toBe(true);
    expect(result.content).toBe('Partial');
    expect(result.error).toBeDefined();
  });

  it('should handle empty response gracefully', async () => {
    setupMockClaude({ scenario: 'empty_response' }, mocks.spawn);

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('should handle context too long error', async () => {
    setupMockClaude({ scenario: 'context_too_long' }, mocks.spawn);

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.error?.code).toBe('CONTEXT_TOO_LONG');
    expect(result.error?.retryable).toBe(false);
  });

  it('should handle interleaved stdout/stderr gracefully', async () => {
    setupMockClaude({ scenario: 'interleaved_output' }, mocks.spawn);

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('First second');
    expect(result.error).toBeUndefined();
  });
});
