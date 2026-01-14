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
    exec: vi.fn(),
  };
});

// Mock child_process WITHOUT importOriginal - provide our own minimal mock
vi.mock('child_process', () => {
  const mockModule = {
    spawn: mocks.spawn,
    exec: mocks.exec,
    ChildProcess: class {},
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Import module under test - uses the mocked spawn and exec
import { invokeClaude, cancelClaude, validateClaudeCLI, ClaudeCLIProvider } from '../claude-cli';

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

describe('validateClaudeCLI', () => {
  beforeEach(() => {
    mocks.exec.mockReset();
  });

  it('should return ready status with valid version and auth', async () => {
    // Mock exec to simulate callback-based API used by promisify
    mocks.exec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        // Handle both 2-arg and 3-arg calls (promisify passes callback)
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (cb) {
          setImmediate(() => cb(null, { stdout: 'claude version 1.2.3\n', stderr: '' }));
        }
        return { stdout: '', stderr: '' };
      }
    );

    const result = await validateClaudeCLI();

    expect(result.status).toBe('ready');
    expect(result.version).toBe('1.2.3');
  });

  it('should return not_installed when CLI is missing (ENOENT)', async () => {
    mocks.exec.mockImplementation(
      (_cmd: string, _opts: unknown, callback?: (error: NodeJS.ErrnoException | null) => void) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (cb) {
          const error = new Error('Command not found') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          setImmediate(() => cb(error));
        }
        return { stdout: '', stderr: '' };
      }
    );

    const result = await validateClaudeCLI();

    expect(result.status).toBe('not_installed');
  });

  it('should return auth_required when auth test fails', async () => {
    let callCount = 0;
    mocks.exec.mockImplementation(
      (
        cmd: string,
        _opts: unknown,
        callback?: (error: Error | null, result?: { stdout: string; stderr: string }) => void
      ) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        callCount++;
        if (cb) {
          // First call: version check succeeds
          if (callCount === 1) {
            setImmediate(() => cb(null, { stdout: 'claude version 1.2.3\n', stderr: '' }));
          } else {
            // Second call: auth test fails
            setImmediate(() => cb(new Error('Not authenticated')));
          }
        }
        return { stdout: '', stderr: '' };
      }
    );

    const result = await validateClaudeCLI();

    expect(result.status).toBe('auth_required');
    expect(result.version).toBe('1.2.3');
    expect(result.message).toBe('Please run: claude login');
  });

  it('should return outdated when version is below minimum', async () => {
    mocks.exec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (cb) {
          setImmediate(() => cb(null, { stdout: 'claude version 0.1.0\n', stderr: '' }));
        }
        return { stdout: '', stderr: '' };
      }
    );

    const result = await validateClaudeCLI();

    expect(result.status).toBe('outdated');
    expect(result.version).toBe('0.1.0');
    expect(result.message).toContain('0.1.0');
    expect(result.message).toContain('1.0.0');
  });

  it('should return error when version cannot be parsed', async () => {
    mocks.exec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (cb) {
          setImmediate(() => cb(null, { stdout: 'claude unknown version\n', stderr: '' }));
        }
        return { stdout: '', stderr: '' };
      }
    );

    const result = await validateClaudeCLI();

    expect(result.status).toBe('error');
    expect(result.message).toBe('Could not parse CLI version');
  });
});

describe('ClaudeCLIProvider', () => {
  let provider: ClaudeCLIProvider;

  beforeEach(() => {
    provider = new ClaudeCLIProvider();
    mocks.spawn.mockReset();
    mocks.exec.mockReset();
  });

  afterEach(() => {
    provider.cancel();
  });

  it('should generate responses using invokeClaude', async () => {
    setupMockClaude(
      {
        scenario: 'success',
        responseChunks: ['{"content":"Provider response"}'],
      },
      mocks.spawn
    );

    const result = await provider.generate({ prompt: 'Test prompt' });

    expect(result.content).toBe('Provider response');
    expect(result.error).toBeUndefined();
  });

  it('should throw error for stream method', async () => {
    const iterator = provider.stream({ prompt: 'Test' });

    await expect(async () => {
      for await (const _chunk of iterator) {
        // Should throw before yielding
      }
    }).rejects.toThrow('Use streamClaude for streaming');
  });

  it('should delegate getStatus to validateClaudeCLI', async () => {
    mocks.exec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (cb) {
          setImmediate(() => cb(null, { stdout: 'claude version 2.0.0\n', stderr: '' }));
        }
        return { stdout: '', stderr: '' };
      }
    );

    const status = await provider.getStatus();

    expect(status.status).toBe('ready');
    expect(status.version).toBe('2.0.0');
  });
});
