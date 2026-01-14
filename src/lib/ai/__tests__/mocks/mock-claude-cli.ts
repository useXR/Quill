/**
 * Mock factory for simulating Claude CLI process behavior in tests.
 *
 * This test infrastructure enables comprehensive unit testing of the CLI wrapper
 * without requiring actual CLI calls.
 */
import { vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { EventEmitter, Readable, Writable } from 'stream';

/**
 * Available mock scenarios for CLI testing.
 */
export type MockScenario =
  | 'success'
  | 'timeout'
  | 'auth_error'
  | 'malformed_json'
  | 'rate_limit'
  | 'empty_response'
  | 'partial_then_error'
  | 'slow_stream'
  | 'cli_not_found'
  | 'context_too_long'
  | 'process_crash'
  | 'interleaved_output';

/**
 * Options for creating a mock Claude CLI process.
 */
export interface MockClaudeOptions {
  /** The scenario to simulate */
  scenario: MockScenario;
  /** Custom response chunks for success/slow_stream scenarios */
  responseChunks?: string[];
  /** Delay between chunks in milliseconds */
  delayMs?: number;
}

/**
 * Create a mock ChildProcess that simulates Claude CLI behavior.
 *
 * @param options - Configuration for the mock behavior
 * @returns A mock ChildProcess that emits events based on the scenario
 */
export function createMockClaudeProcess(options: MockClaudeOptions): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stdout = new EventEmitter() as Readable;
  proc.stderr = new EventEmitter() as Readable;
  proc.stdin = new Writable({ write: (_chunk, _encoding, callback) => callback() });
  proc.kill = vi.fn().mockReturnValue(true);
  proc.pid = 12345;

  setImmediate(() => {
    switch (options.scenario) {
      case 'success': {
        const chunks = options.responseChunks || ['{"content":"Default response"}'];
        chunks.forEach((chunk, i) => {
          setTimeout(
            () => {
              proc.stdout!.emit('data', chunk + '\n');
            },
            (options.delayMs || 0) * i
          );
        });
        setTimeout(
          () => {
            proc.emit('close', 0);
          },
          (options.delayMs || 0) * chunks.length + 10
        );
        break;
      }

      case 'auth_error':
        proc.stderr!.emit('data', 'Error: Authentication failed. Please run claude login.');
        proc.emit('close', 1);
        break;

      case 'rate_limit':
        proc.stderr!.emit('data', 'Error: Rate limit exceeded. Please wait 60 seconds.');
        proc.emit('close', 1);
        break;

      case 'malformed_json':
        proc.stdout!.emit('data', 'Not valid JSON\n');
        proc.stdout!.emit('data', '{"content":"valid"}\n');
        proc.emit('close', 0);
        break;

      case 'empty_response':
        proc.emit('close', 0);
        break;

      case 'partial_then_error':
        proc.stdout!.emit('data', '{"content":"Partial"}\n');
        setTimeout(() => {
          proc.stderr!.emit('data', 'Connection lost');
          proc.emit('close', 1);
        }, 50);
        break;

      case 'cli_not_found':
        proc.emit('error', Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
        break;

      case 'slow_stream': {
        const slowChunks = options.responseChunks || [
          '{"content":"Slow "}',
          '{"content":"streaming "}',
          '{"content":"response"}',
        ];
        slowChunks.forEach((chunk, i) => {
          setTimeout(() => proc.stdout!.emit('data', chunk + '\n'), 100 * (i + 1));
        });
        setTimeout(() => proc.emit('close', 0), 100 * (slowChunks.length + 1));
        break;
      }

      case 'context_too_long':
        proc.stderr!.emit('data', 'Error: Context too long. Token limit exceeded.');
        proc.emit('close', 1);
        break;

      case 'process_crash':
        proc.stdout!.emit('data', '{"content":"Partial before crash"}\n');
        setTimeout(() => {
          proc.emit('error', new Error('Process crashed: SIGSEGV'));
        }, 50);
        break;

      case 'interleaved_output':
        proc.stdout!.emit('data', '{"content":"First"}\n');
        proc.stderr!.emit('data', 'Warning: High latency detected');
        proc.stdout!.emit('data', '{"content":" second"}\n');
        proc.emit('close', 0);
        break;

      case 'timeout':
        // Never emit close - simulate timeout
        // The calling code should implement its own timeout handling
        break;
    }
  });

  return proc;
}

/**
 * Helper to set up mock Claude CLI for use in tests.
 *
 * This function configures a mocked spawn function to return
 * a mock process based on the specified scenario.
 *
 * @example
 * ```typescript
 * import { spawn } from 'child_process';
 * vi.mock('child_process');
 *
 * describe('CLI Wrapper', () => {
 *   it('handles auth errors', async () => {
 *     const mockSpawn = vi.mocked(spawn);
 *     setupMockClaude({ scenario: 'auth_error' }, mockSpawn);
 *     const result = await cliWrapper.generate({ prompt: 'test' });
 *     expect(result.error?.code).toBe('AUTH_FAILURE');
 *   });
 * });
 * ```
 *
 * @param options - Configuration for the mock behavior
 * @param mockSpawn - The mocked spawn function from vi.mocked(spawn)
 * @returns The mocked spawn function for assertions
 */
export function setupMockClaude(options: MockClaudeOptions, mockSpawn: ReturnType<typeof vi.fn>) {
  mockSpawn.mockImplementation(() => createMockClaudeProcess(options));
  return mockSpawn;
}

/**
 * Create mock Claude error for testing error handling.
 */
export function createMockClaudeError(
  overrides: Partial<{
    code: string;
    message: string;
    retryable: boolean;
    retryAfterMs: number;
    partialContent: string;
    suggestion: string;
  }> = {}
) {
  return {
    code: 'UNKNOWN',
    message: 'An error occurred',
    retryable: false,
    ...overrides,
  };
}
