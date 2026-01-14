# Phase 3: AI Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Claude Code CLI as the AI backbone for Quill, enabling selection actions (refine/extend/shorten/simplify), cursor generation (Cmd+K), and streaming AI responses.

**Architecture:** Subprocess-based Claude CLI integration with process manager, error categorization, and automatic retry. The `AIProvider` interface enables future migration to direct Anthropic API. Zustand for AI operation state; SSE for streaming.

**Tech Stack:** Next.js 14+, TipTap editor, Zustand, Supabase, Vitest, Playwright, Claude Code CLI

---

## Prerequisites

Before starting:

```bash
claude --version   # Verify Claude CLI installed
npm install zustand  # State management
npm test           # Verify existing tests pass
```

---

## Task 1: AI Type Definitions

**Files:**

- Create: `src/lib/ai/types.ts`
- Test: `src/lib/ai/__tests__/types.test.ts`

### Step 1: Write the failing test for type exports

```typescript
// src/lib/ai/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import type { ClaudeRequest, ClaudeResponse, ClaudeErrorCode, ClaudeError, CLIStatus, AIProvider } from '../types';

describe('AI Types', () => {
  it('ClaudeRequest should have required prompt field', () => {
    const request: ClaudeRequest = { prompt: 'test' };
    expect(request.prompt).toBe('test');
  });

  it('ClaudeErrorCode should include expected error types', () => {
    const codes: ClaudeErrorCode[] = ['CLI_NOT_FOUND', 'AUTH_FAILURE', 'RATE_LIMITED', 'TIMEOUT'];
    expect(codes).toHaveLength(4);
  });

  it('CLIStatus should have status field', () => {
    const status: CLIStatus = { status: 'ready', version: '1.0.0' };
    expect(status.status).toBe('ready');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/types.ts
export interface ClaudeRequest {
  prompt: string;
  context?: string;
  timeout?: number;
}

export interface ClaudeResponse {
  content: string;
  partial?: boolean;
  error?: ClaudeError;
}

export type ClaudeErrorCode =
  | 'CLI_NOT_FOUND'
  | 'CLI_VERSION_MISMATCH'
  | 'AUTH_FAILURE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'MALFORMED_OUTPUT'
  | 'PROCESS_CRASH'
  | 'CONTEXT_TOO_LONG'
  | 'UNKNOWN';

export interface ClaudeError {
  code: ClaudeErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  partialContent?: string;
  suggestion?: string;
}

export interface CLIStatus {
  status: 'ready' | 'not_installed' | 'outdated' | 'auth_required' | 'error';
  version?: string;
  message?: string;
}

export interface AIProvider {
  generate(request: ClaudeRequest): Promise<ClaudeResponse>;
  stream(request: ClaudeRequest): AsyncIterable<string>;
  cancel(): void;
  getStatus(): Promise<CLIStatus>;
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/types.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/types.ts src/lib/ai/__tests__/types.test.ts
git commit -m "feat(ai): add type definitions for Claude CLI integration"
```

---

## Task 2: Error Categorization Module

**Files:**

- Create: `src/lib/ai/errors.ts`
- Test: `src/lib/ai/__tests__/errors.test.ts`

### Step 1: Write the failing test for categorizeError

```typescript
// src/lib/ai/__tests__/errors.test.ts
import { describe, it, expect } from 'vitest';
import { categorizeError, isRetryableError } from '../errors';

describe('categorizeError', () => {
  it('should categorize authentication errors', () => {
    const error = categorizeError('authentication failed');
    expect(error.code).toBe('AUTH_FAILURE');
    expect(error.retryable).toBe(false);
  });

  it('should categorize rate limit errors with retry time', () => {
    const error = categorizeError('rate limit exceeded. wait 60 seconds');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(60000);
  });

  it('should categorize CLI not found errors', () => {
    const error = categorizeError('ENOENT: command not found');
    expect(error.code).toBe('CLI_NOT_FOUND');
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    const error = categorizeError('some random error');
    expect(error.code).toBe('UNKNOWN');
  });

  it('should preserve partial content', () => {
    const error = categorizeError('timeout', 'partial output');
    expect(error.partialContent).toBe('partial output');
  });
});

describe('isRetryableError', () => {
  it('should return true for rate limited errors', () => {
    const error = categorizeError('rate limit');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for auth errors', () => {
    const error = categorizeError('authentication failed');
    expect(isRetryableError(error)).toBe(false);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/errors.test.ts`
Expected: FAIL with "Cannot find module '../errors'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/errors.ts
import type { ClaudeError, ClaudeErrorCode } from './types';

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: ClaudeErrorCode;
  retryable: boolean;
  suggestion?: string;
}> = [
  {
    pattern: /authentication failed|please.*login/i,
    code: 'AUTH_FAILURE',
    retryable: false,
    suggestion: 'Run "claude login" in your terminal to authenticate.',
  },
  {
    pattern: /rate limit|too many requests/i,
    code: 'RATE_LIMITED',
    retryable: true,
    suggestion: 'Please wait a moment before trying again.',
  },
  {
    pattern: /timeout|timed out/i,
    code: 'TIMEOUT',
    retryable: true,
    suggestion: 'Try a shorter prompt or simpler request.',
  },
  {
    pattern: /ENOENT|not found|command not found/i,
    code: 'CLI_NOT_FOUND',
    retryable: false,
    suggestion: 'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
  },
  {
    pattern: /context.*too.*long|token limit/i,
    code: 'CONTEXT_TOO_LONG',
    retryable: false,
    suggestion: 'Reduce the amount of context or document length.',
  },
];

export function categorizeError(error: string | Error, partialContent?: string): ClaudeError {
  const message = typeof error === 'string' ? error : error.message;

  for (const { pattern, code, retryable, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        code,
        message,
        retryable,
        suggestion,
        partialContent,
        retryAfterMs: code === 'RATE_LIMITED' ? extractRetryAfter(message) : undefined,
      };
    }
  }

  return {
    code: 'UNKNOWN',
    message,
    retryable: false,
    partialContent,
  };
}

function extractRetryAfter(message: string): number {
  const match = message.match(/(\d+)\s*seconds?/i);
  return match ? parseInt(match[1], 10) * 1000 : 60000;
}

// Simplified: retryable flag already correctly set in ERROR_PATTERNS
export function isRetryableError(error: ClaudeError): boolean {
  return error.retryable;
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/errors.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/errors.ts src/lib/ai/__tests__/errors.test.ts
git commit -m "feat(ai): add error categorization with retry detection"
```

---

## Task 3: Input Sanitization Module

**Files:**

- Create: `src/lib/ai/sanitize.ts`
- Test: `src/lib/ai/__tests__/sanitize.test.ts`

### Step 1: Write the failing test for sanitization

```typescript
// src/lib/ai/__tests__/sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizePrompt, sanitizeContext, SanitizationError } from '../sanitize';

describe('sanitizePrompt', () => {
  it('should pass through valid prompts', () => {
    expect(sanitizePrompt('Hello world')).toBe('Hello world');
  });

  it('should remove control characters', () => {
    expect(sanitizePrompt('Hello\x00World')).toBe('HelloWorld');
  });

  it('should preserve newlines and tabs', () => {
    expect(sanitizePrompt('Hello\n\tWorld')).toBe('Hello\n\tWorld');
  });

  it('should reject prompts starting with CLI flags', () => {
    expect(() => sanitizePrompt('--dangerous')).toThrow(SanitizationError);
    expect(() => sanitizePrompt('-p injection')).toThrow(SanitizationError);
  });

  it('should reject empty prompts', () => {
    expect(() => sanitizePrompt('')).toThrow(SanitizationError);
  });

  it('should reject prompts exceeding max length', () => {
    const longPrompt = 'x'.repeat(60000);
    expect(() => sanitizePrompt(longPrompt)).toThrow(SanitizationError);
  });
});

describe('sanitizeContext', () => {
  it('should return empty string for falsy input', () => {
    expect(sanitizeContext('')).toBe('');
  });

  it('should truncate oversized context with indicator', () => {
    const longContext = 'x'.repeat(150000);
    const result = sanitizeContext(longContext);
    expect(result).toContain('[Context truncated...]');
    expect(result.length).toBeLessThan(110000);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/sanitize.test.ts`
Expected: FAIL with "Cannot find module '../sanitize'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/sanitize.ts
const MAX_PROMPT_LENGTH = 50000;
const MAX_CONTEXT_SIZE = 100000;

export class SanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizationError';
  }
}

export function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    throw new SanitizationError('Prompt must be a non-empty string');
  }

  // Remove control characters except newlines and tabs
  let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Check for CLI flag injection attempts
  if (/^-{1,2}\w/.test(sanitized.trim())) {
    throw new SanitizationError('Prompt cannot start with CLI flags');
  }

  // Length validation
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    throw new SanitizationError(`Prompt exceeds maximum length: ${sanitized.length} > ${MAX_PROMPT_LENGTH}`);
  }

  return sanitized;
}

export function sanitizeContext(context: string): string {
  if (!context) return '';

  // Remove control characters
  let sanitized = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Length validation with truncation
  if (sanitized.length > MAX_CONTEXT_SIZE) {
    sanitized = sanitized.slice(0, MAX_CONTEXT_SIZE - 50) + '\n\n[Context truncated...]';
  }

  return sanitized;
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/sanitize.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/sanitize.ts src/lib/ai/__tests__/sanitize.test.ts
git commit -m "feat(ai): add input sanitization to prevent CLI injection"
```

---

## Task 4: Mock Factory for CLI Tests

**Files:**

- Create: `src/lib/ai/__tests__/mocks/mock-claude-cli.ts`

### Step 1: Create mock factory (no test needed - this IS the test infrastructure)

```typescript
// src/lib/ai/__tests__/mocks/mock-claude-cli.ts
import { vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter, Readable, Writable } from 'stream';

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

export interface MockClaudeOptions {
  scenario: MockScenario;
  responseChunks?: string[];
  delayMs?: number;
}

export function createMockClaudeProcess(options: MockClaudeOptions): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stdout = new EventEmitter() as Readable;
  proc.stderr = new EventEmitter() as Readable;
  proc.stdin = new Writable({ write: () => true });
  proc.kill = vi.fn().mockReturnValue(true);

  setImmediate(() => {
    switch (options.scenario) {
      case 'success':
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

      case 'slow_stream':
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
        break;
    }
  });

  return proc;
}

export function setupMockClaude(options: MockClaudeOptions) {
  const mockSpawn = vi.mocked(spawn);
  mockSpawn.mockImplementation(() => createMockClaudeProcess(options));
  return mockSpawn;
}
```

### Step 2: Commit

```bash
git add src/lib/ai/__tests__/mocks/mock-claude-cli.ts
git commit -m "test(ai): add mock factory for Claude CLI process testing"
```

---

## Task 5: Claude CLI Wrapper - Core Invocation

**Files:**

- Create: `src/lib/ai/claude-cli.ts`
- Test: `src/lib/ai/__tests__/claude-cli.test.ts`

### Step 1: Write the failing test for invokeClaude

```typescript
// src/lib/ai/__tests__/claude-cli.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { invokeClaude, cancelClaude } from '../claude-cli';
import { setupMockClaude } from './mocks/mock-claude-cli';

vi.mock('child_process');

describe('invokeClaude', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cancelClaude();
  });

  it('should return content for successful response', async () => {
    setupMockClaude({
      scenario: 'success',
      responseChunks: ['{"content":"Hello world"}'],
    });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('Hello world');
    expect(result.error).toBeUndefined();
  });

  it('should concatenate multi-chunk responses', async () => {
    setupMockClaude({
      scenario: 'success',
      responseChunks: ['{"content":"Hello "}', '{"content":"world"}'],
    });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('Hello world');
  });

  it('should handle auth errors with proper error code', async () => {
    setupMockClaude({ scenario: 'auth_error' });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.error?.code).toBe('AUTH_FAILURE');
    expect(result.error?.retryable).toBe(false);
  });

  it('should handle CLI not found', async () => {
    setupMockClaude({ scenario: 'cli_not_found' });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.error?.code).toBe('CLI_NOT_FOUND');
  });

  it('should recover partial content on error', async () => {
    setupMockClaude({ scenario: 'partial_then_error' });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.partial).toBe(true);
    expect(result.content).toBe('Partial');
    expect(result.error).toBeDefined();
  });

  it('should handle empty response gracefully', async () => {
    setupMockClaude({ scenario: 'empty_response' });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('should handle context too long error', async () => {
    setupMockClaude({ scenario: 'context_too_long' });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.error?.code).toBe('CONTEXT_TOO_LONG');
    expect(result.error?.retryable).toBe(false);
  });

  it('should handle interleaved stdout/stderr gracefully', async () => {
    setupMockClaude({ scenario: 'interleaved_output' });

    const result = await invokeClaude({ prompt: 'Test' });

    expect(result.content).toBe('First second');
    expect(result.error).toBeUndefined();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
Expected: FAIL (module not found or export missing)

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/claude-cli.ts
import { spawn, ChildProcess } from 'child_process';
import type { ClaudeRequest, ClaudeResponse } from './types';
import { categorizeError, isRetryableError } from './errors';
import { sanitizePrompt, sanitizeContext } from './sanitize';

const DEFAULT_TIMEOUT = 120000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

class ClaudeProcessManager {
  private activeProcess: ChildProcess | null = null;
  private queue: Array<{
    request: ClaudeRequest;
    resolve: (response: ClaudeResponse) => void;
  }> = [];
  private processing = false;

  async invoke(request: ClaudeRequest): Promise<ClaudeResponse> {
    return new Promise((resolve) => {
      this.queue.push({ request, resolve });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { request, resolve } = this.queue.shift()!;

    try {
      const response = await this.executeWithRetry(request);
      resolve(response);
    } catch (error) {
      resolve({
        content: '',
        error: categorizeError(error as Error),
      });
    } finally {
      this.processing = false;
      this.activeProcess = null;
      this.processQueue();
    }
  }

  private async executeWithRetry(request: ClaudeRequest, attempt = 0): Promise<ClaudeResponse> {
    const response = await this.execute(request);

    if (response.error && isRetryableError(response.error) && attempt < MAX_RETRIES) {
      const delay = response.error.retryAfterMs || RETRY_DELAY * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return this.executeWithRetry(request, attempt + 1);
    }

    return response;
  }

  private execute(request: ClaudeRequest): Promise<ClaudeResponse> {
    const { prompt, context, timeout = DEFAULT_TIMEOUT } = request;

    return new Promise((resolve) => {
      try {
        const sanitizedPrompt = sanitizePrompt(prompt);
        const sanitizedContext = context ? sanitizeContext(context) : undefined;

        const args = ['-p', sanitizedPrompt, '--output-format', 'stream-json'];
        if (sanitizedContext) {
          args.push('--context', sanitizedContext);
        }

        this.activeProcess = spawn('claude', args, {
          timeout,
          shell: false,
          env: { PATH: process.env.PATH, HOME: process.env.HOME },
        });

        let output = '';
        let errorOutput = '';
        let content = '';

        this.activeProcess.stdout?.on('data', (data) => {
          output += data.toString();
          const lines = output.split('\n');
          output = lines.pop() || '';

          for (const line of lines.filter(Boolean)) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.content) {
                content += parsed.content;
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        });

        this.activeProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        this.activeProcess.on('close', (code) => {
          if (code !== 0 || errorOutput) {
            const error = categorizeError(errorOutput || `Exit code ${code}`, content);
            resolve({
              content: error.partialContent || '',
              partial: !!error.partialContent,
              error,
            });
          } else {
            resolve({ content });
          }
        });

        this.activeProcess.on('error', (err) => {
          resolve({
            content: '',
            error: categorizeError(err, content),
          });
        });
      } catch (err) {
        resolve({
          content: '',
          error: categorizeError(err as Error),
        });
      }
    });
  }

  cancel(): void {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
  }

  destroy(): void {
    this.cancel();
    // Reject all pending queue items to prevent memory leaks
    while (this.queue.length > 0) {
      const { resolve } = this.queue.shift()!;
      resolve({
        content: '',
        error: {
          code: 'UNKNOWN',
          message: 'Process manager destroyed',
          retryable: false,
        },
      });
    }
  }
}

const processManager = new ClaudeProcessManager();

export async function invokeClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  return processManager.invoke(request);
}

export function cancelClaude(): void {
  processManager.cancel();
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/claude-cli.ts src/lib/ai/__tests__/claude-cli.test.ts
git commit -m "feat(ai): add Claude CLI wrapper with process manager"
```

---

## Task 6: CLI Validation Function

**Files:**

- Modify: `src/lib/ai/claude-cli.ts`
- Test: `src/lib/ai/__tests__/claude-cli.test.ts`

### Step 1: Write the failing test for validateClaudeCLI

Add to `src/lib/ai/__tests__/claude-cli.test.ts`:

```typescript
import { validateClaudeCLI } from '../claude-cli';
import * as childProcess from 'child_process';
import { promisify } from 'util';

// Mock child_process.exec at module level
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    exec: vi.fn(),
  };
});

describe('validateClaudeCLI', () => {
  const mockExec = vi.mocked(childProcess.exec);

  beforeEach(() => {
    mockExec.mockReset();
  });

  it('should return ready status with version', async () => {
    // Mock version check succeeds
    mockExec.mockImplementation((cmd, opts, callback) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd === 'claude --version') {
        cb!(null, { stdout: 'claude version 1.2.3', stderr: '' });
      } else {
        // Auth test succeeds
        cb!(null, { stdout: '', stderr: '' });
      }
      return {} as any;
    });

    const status = await validateClaudeCLI();

    expect(status.status).toBe('ready');
    expect(status.version).toBe('1.2.3');
  });

  it('should return not_installed when CLI missing', async () => {
    mockExec.mockImplementation((cmd, opts, callback) => {
      const cb = typeof opts === 'function' ? opts : callback;
      const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      cb!(error, { stdout: '', stderr: '' });
      return {} as any;
    });

    const status = await validateClaudeCLI();

    expect(status.status).toBe('not_installed');
  });

  it('should return auth_required when auth test fails', async () => {
    mockExec.mockImplementation((cmd, opts, callback) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd === 'claude --version') {
        cb!(null, { stdout: 'claude version 1.2.3', stderr: '' });
      } else {
        // Auth test fails
        cb!(new Error('Authentication required'), { stdout: '', stderr: '' });
      }
      return {} as any;
    });

    const status = await validateClaudeCLI();

    expect(status.status).toBe('auth_required');
    expect(status.version).toBe('1.2.3');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
Expected: FAIL (validateClaudeCLI not exported)

### Step 3: Add implementation to claude-cli.ts

Add to `src/lib/ai/claude-cli.ts`:

```typescript
import { promisify } from 'util';
import { exec } from 'child_process';
import type { CLIStatus, AIProvider } from './types';

const execPromise = promisify(exec);
const MINIMUM_CLI_VERSION = '1.0.0';

export async function validateClaudeCLI(): Promise<CLIStatus> {
  try {
    const { stdout } = await execPromise('claude --version');
    const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);

    if (!versionMatch) {
      return { status: 'error', message: 'Could not parse CLI version' };
    }

    const version = versionMatch[1];

    if (version < MINIMUM_CLI_VERSION) {
      return {
        status: 'outdated',
        version,
        message: `Claude CLI ${version} found, but ${MINIMUM_CLI_VERSION}+ required`,
      };
    }

    try {
      await execPromise('claude -p "test" --max-turns 1', { timeout: 10000 });
      return { status: 'ready', version };
    } catch {
      return { status: 'auth_required', version, message: 'Please run: claude login' };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { status: 'not_installed' };
    }
    return { status: 'error', message: err.message };
  }
}

export class ClaudeCLIProvider implements AIProvider {
  private manager = new ClaudeProcessManager();

  async generate(request: ClaudeRequest): Promise<ClaudeResponse> {
    return this.manager.invoke(request);
  }

  async *stream(request: ClaudeRequest): AsyncIterable<string> {
    throw new Error('Use streamClaude for streaming');
  }

  cancel(): void {
    this.manager.cancel();
  }

  getStatus(): Promise<CLIStatus> {
    return validateClaudeCLI();
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/claude-cli.ts src/lib/ai/__tests__/claude-cli.test.ts
git commit -m "feat(ai): add CLI validation and AIProvider implementation"
```

---

## Task 7: Streaming Module

**Files:**

- Create: `src/lib/ai/streaming.ts`
- Test: `src/lib/ai/__tests__/streaming.test.ts`

### Step 1: Write the failing test for ClaudeStream

```typescript
// src/lib/ai/__tests__/streaming.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { ClaudeStream, streamClaude } from '../streaming';
import { setupMockClaude } from './mocks/mock-claude-cli';

vi.mock('child_process');

describe('ClaudeStream', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should emit chunks as they arrive', async () => {
    setupMockClaude({
      scenario: 'success',
      responseChunks: ['{"content":"Hello"}', '{"content":" world"}'],
      delayMs: 10,
    });

    const chunks: string[] = [];
    const stream = new ClaudeStream();

    await new Promise<void>((resolve) => {
      stream.stream('prompt', {
        onChunk: (chunk) => {
          if (chunk.content) chunks.push(chunk.content);
        },
        onComplete: resolve,
        onError: () => resolve(),
      });
    });

    expect(chunks).toEqual(['Hello', ' world']);
    expect(stream.getContent()).toBe('Hello world');
  });

  it('should support cancellation', async () => {
    setupMockClaude({ scenario: 'slow_stream' });

    const chunks: string[] = [];
    const stream = new ClaudeStream();

    stream.stream('prompt', {
      onChunk: (chunk) => {
        if (chunk.content) chunks.push(chunk.content);
      },
      onComplete: () => {},
      onError: () => {},
    });

    stream.cancel();

    await new Promise((r) => setTimeout(r, 200));
    expect(chunks.length).toBeLessThan(3);
  });

  it('should recover partial content on error', async () => {
    setupMockClaude({ scenario: 'partial_then_error' });

    let errorReceived: any = null;
    const stream = new ClaudeStream();

    await new Promise<void>((resolve) => {
      stream.stream('prompt', {
        onChunk: () => {},
        onComplete: resolve,
        onError: (err) => {
          errorReceived = err;
          resolve();
        },
      });
    });

    expect(errorReceived).toBeDefined();
    expect(stream.getContent()).toBe('Partial');
  });
});

describe('streamClaude convenience function', () => {
  it('should work with simple callbacks', async () => {
    setupMockClaude({
      scenario: 'success',
      responseChunks: ['{"content":"Test"}'],
    });

    let content = '';
    let completed = false;

    await new Promise<void>((resolve) => {
      streamClaude(
        'prompt',
        (chunk) => {
          content += chunk;
        },
        () => {
          completed = true;
          resolve();
        },
        () => resolve()
      );
    });

    expect(content).toBe('Test');
    expect(completed).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/streaming.test.ts`
Expected: FAIL with "Cannot find module '../streaming'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/streaming.ts
import { spawn, ChildProcess } from 'child_process';
import { sanitizePrompt, sanitizeContext } from './sanitize';
import { categorizeError } from './errors';
import type { ClaudeError } from './types';

export interface StreamChunk {
  id: string;
  sequence: number;
  content: string;
  done: boolean;
  error?: ClaudeError;
}

export interface StreamCallbacks {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: () => void;
  onError: (error: ClaudeError) => void;
}

const DEFAULT_TIMEOUT = 120000;
const HEARTBEAT_INTERVAL = 5000;

export class ClaudeStream {
  private process: ChildProcess | null = null;
  private chunks: StreamChunk[] = [];
  private buffer = '';
  private sequence = 0;
  private cancelled = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  async stream(
    prompt: string,
    callbacks: StreamCallbacks,
    options: { context?: string; timeout?: number } = {}
  ): Promise<void> {
    const { context, timeout = DEFAULT_TIMEOUT } = options;

    try {
      const sanitizedPrompt = sanitizePrompt(prompt);
      const sanitizedContext = context ? sanitizeContext(context) : undefined;

      const args = ['-p', sanitizedPrompt, '--output-format', 'stream-json'];
      if (sanitizedContext) {
        args.push('--context', sanitizedContext);
      }

      this.process = spawn('claude', args, {
        timeout,
        shell: false,
        env: { PATH: process.env.PATH, HOME: process.env.HOME },
      });

      this.heartbeatTimer = setInterval(() => {
        if (!this.cancelled) {
          callbacks.onChunk({
            id: 'heartbeat',
            sequence: -1,
            content: '',
            done: false,
          });
        }
      }, HEARTBEAT_INTERVAL);

      this.process.stdout?.on('data', (data) => {
        if (this.cancelled) return;
        this.processData(data.toString(), callbacks);
      });

      this.process.stderr?.on('data', (data) => {
        console.warn('Claude CLI stderr:', data.toString());
      });

      this.process.on('close', (code) => {
        this.cleanup();
        if (this.cancelled) return;

        if (code !== 0) {
          callbacks.onError(categorizeError(`Exit code ${code}`, this.getContent()));
        } else {
          callbacks.onChunk({
            id: 'done',
            sequence: this.sequence++,
            content: '',
            done: true,
          });
          callbacks.onComplete();
        }
      });

      this.process.on('error', (err) => {
        this.cleanup();
        if (!this.cancelled) {
          callbacks.onError(categorizeError(err, this.getContent()));
        }
      });
    } catch (err) {
      this.cleanup();
      callbacks.onError(categorizeError(err as Error));
    }
  }

  private processData(data: string, callbacks: StreamCallbacks): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines.filter(Boolean)) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.content) {
          const chunk: StreamChunk = {
            id: `chunk-${this.sequence}`,
            sequence: this.sequence++,
            content: parsed.content,
            done: false,
          };
          this.chunks.push(chunk);
          callbacks.onChunk(chunk);
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.cleanup();
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  getContent(): string {
    return this.chunks.map((c) => c.content).join('');
  }

  getChunks(): StreamChunk[] {
    return [...this.chunks];
  }

  getChunksAfter(sequence: number): StreamChunk[] {
    return this.chunks.filter((c) => c.sequence > sequence);
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export function streamClaude(
  prompt: string,
  onChunk: (content: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  timeout = DEFAULT_TIMEOUT
): () => void {
  const stream = new ClaudeStream();

  stream.stream(
    prompt,
    {
      onChunk: (chunk) => {
        if (chunk.content) onChunk(chunk.content);
      },
      onComplete,
      onError: (err) => onError(err.message),
    },
    { timeout }
  );

  return () => stream.cancel();
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/streaming.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/streaming.ts src/lib/ai/__tests__/streaming.test.ts
git commit -m "feat(ai): add streaming module with cancellation support"
```

---

## Task 8: AI State Store (Zustand)

**Files:**

- Create: `src/lib/stores/ai-store.ts`
- Test: `src/lib/stores/__tests__/ai-store.test.ts`

### Step 1: Write the failing test

```typescript
// src/lib/stores/__tests__/ai-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '../ai-store';

describe('AI Store', () => {
  beforeEach(() => {
    useAIStore.getState().reset();
  });

  it('should start with no current operation', () => {
    expect(useAIStore.getState().currentOperation).toBeNull();
  });

  it('should start an operation', () => {
    const id = useAIStore.getState().startOperation('selection', 'test input');

    const { currentOperation } = useAIStore.getState();
    expect(currentOperation).not.toBeNull();
    expect(currentOperation?.id).toBe(id);
    expect(currentOperation?.type).toBe('selection');
    expect(currentOperation?.status).toBe('loading');
  });

  it('should append output', () => {
    useAIStore.getState().startOperation('cursor', 'test');
    useAIStore.getState().appendOutput('Hello ');
    useAIStore.getState().appendOutput('world');

    expect(useAIStore.getState().currentOperation?.output).toBe('Hello world');
    expect(useAIStore.getState().currentOperation?.status).toBe('streaming');
  });

  it('should accept operation and add to history', () => {
    useAIStore.getState().startOperation('selection', 'test');
    useAIStore.getState().setOutput('result');
    useAIStore.getState().acceptOperation();

    expect(useAIStore.getState().currentOperation).toBeNull();
    expect(useAIStore.getState().operationHistory).toHaveLength(1);
  });

  it('should reject operation without adding to history', () => {
    useAIStore.getState().startOperation('selection', 'test');
    useAIStore.getState().rejectOperation();

    expect(useAIStore.getState().currentOperation).toBeNull();
    expect(useAIStore.getState().operationHistory).toHaveLength(0);
  });

  it('should undo operation and return snapshot', () => {
    const id = useAIStore.getState().startOperation('selection', 'test', '<p>snapshot</p>');
    useAIStore.getState().setOutput('result');
    useAIStore.getState().acceptOperation();

    const snapshot = useAIStore.getState().undoOperation(id);

    expect(snapshot).toBe('<p>snapshot</p>');
    expect(useAIStore.getState().operationHistory).toHaveLength(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/stores/__tests__/ai-store.test.ts`
Expected: FAIL with "Cannot find module '../ai-store'"

### Step 3: Write minimal implementation

```typescript
// src/lib/stores/ai-store.ts
import { create } from 'zustand';
import type { ClaudeError } from '@/lib/ai/types';

export type AIOperationType = 'selection' | 'cursor' | 'global' | 'chat';
export type AIOperationStatus = 'idle' | 'loading' | 'streaming' | 'preview' | 'error';

export interface AIOperation {
  id: string;
  type: AIOperationType;
  status: AIOperationStatus;
  input: string;
  output: string;
  error?: ClaudeError;
  documentSnapshot?: string;
  createdAt: Date;
}

interface AIStore {
  currentOperation: AIOperation | null;
  operationHistory: AIOperation[];

  startOperation: (type: AIOperationType, input: string, snapshot?: string) => string;
  appendOutput: (content: string) => void;
  setOutput: (content: string) => void;
  setStatus: (status: AIOperationStatus) => void;
  setError: (error: ClaudeError) => void;
  acceptOperation: () => void;
  rejectOperation: () => void;
  undoOperation: (operationId: string) => string | null;
  reset: () => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  currentOperation: null,
  operationHistory: [],

  startOperation: (type, input, snapshot) => {
    const id = crypto.randomUUID();
    set({
      currentOperation: {
        id,
        type,
        status: 'loading',
        input,
        output: '',
        documentSnapshot: snapshot,
        createdAt: new Date(),
      },
    });
    return id;
  },

  appendOutput: (content) => {
    set((state) => ({
      currentOperation: state.currentOperation
        ? {
            ...state.currentOperation,
            output: state.currentOperation.output + content,
            status: 'streaming',
          }
        : null,
    }));
  },

  setOutput: (content) => {
    set((state) => ({
      currentOperation: state.currentOperation ? { ...state.currentOperation, output: content } : null,
    }));
  },

  setStatus: (status) => {
    set((state) => ({
      currentOperation: state.currentOperation ? { ...state.currentOperation, status } : null,
    }));
  },

  setError: (error) => {
    set((state) => ({
      currentOperation: state.currentOperation ? { ...state.currentOperation, status: 'error', error } : null,
    }));
  },

  acceptOperation: () => {
    const { currentOperation } = get();
    if (!currentOperation) return;

    set((state) => ({
      currentOperation: null,
      operationHistory: [...state.operationHistory, { ...currentOperation, status: 'idle' }].slice(-50),
    }));
  },

  rejectOperation: () => {
    set({ currentOperation: null });
  },

  undoOperation: (operationId) => {
    const op = get().operationHistory.find((o) => o.id === operationId);
    if (op?.documentSnapshot) {
      set((state) => ({
        operationHistory: state.operationHistory.filter((o) => o.id !== operationId),
      }));
      return op.documentSnapshot;
    }
    return null;
  },

  reset: () => {
    set({ currentOperation: null });
  },
}));
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/stores/__tests__/ai-store.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/stores/ai-store.ts src/lib/stores/__tests__/ai-store.test.ts
git commit -m "feat(store): add Zustand AI operation state management"
```

---

## Task 9: useAIStream Hook

**Files:**

- Create: `src/hooks/useAIStream.ts`
- Test: `src/hooks/__tests__/useAIStream.test.tsx`

### Step 1: Write the failing test

```typescript
// src/hooks/__tests__/useAIStream.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIStream } from '../useAIStream';

// Mock fetch
global.fetch = vi.fn();

describe('useAIStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with idle state', () => {
    const { result } = renderHook(() => useAIStream());

    expect(result.current.content).toBe('');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should update content during streaming', async () => {
    const mockResponse = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"content":"Hello"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'X-Stream-Id': 'test-id' }),
      body: mockResponse,
    } as Response);

    const onChunk = vi.fn();
    const { result } = renderHook(() => useAIStream({ onChunk }));

    await act(async () => {
      await result.current.startStream('test prompt');
    });

    await waitFor(() => {
      expect(result.current.content).toBe('Hello');
    });
  });

  it('should handle cancel', async () => {
    const { result } = renderHook(() => useAIStream());

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it('should handle network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();
    const { result } = renderHook(() => useAIStream({ onError }));

    await act(async () => {
      await result.current.startStream('test');
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.code).toBe('UNKNOWN');
    expect(onError).toHaveBeenCalled();
  });

  it('should handle HTTP error responses', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response);

    const { result } = renderHook(() => useAIStream());

    await act(async () => {
      await result.current.startStream('test');
    });

    expect(result.current.error?.message).toBe('Server error');
  });

  it('should not call onError for user-initiated abort', async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
        })
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useAIStream({ onError }));

    act(() => {
      result.current.startStream('test');
    });

    act(() => {
      result.current.cancel();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it('should handle malformed SSE data gracefully', async () => {
    const mockResponse = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('not-valid-sse\n'));
        controller.enqueue(new TextEncoder().encode('data: {invalid json}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"content":"Valid"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: mockResponse,
    } as Response);

    const { result } = renderHook(() => useAIStream());

    await act(async () => {
      await result.current.startStream('test');
    });

    await waitFor(() => {
      expect(result.current.content).toBe('Valid');
    });

    expect(result.current.error).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/hooks/__tests__/useAIStream.test.tsx`
Expected: FAIL with "Cannot find module '../useAIStream'"

### Step 3: Write minimal implementation

```typescript
// src/hooks/useAIStream.ts
'use client';

import { useState, useRef, useCallback } from 'react';
import type { ClaudeError } from '@/lib/ai/types';

interface StreamState {
  content: string;
  isStreaming: boolean;
  error: ClaudeError | null;
  streamId: string | null;
}

interface UseAIStreamOptions {
  onChunk?: (content: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: ClaudeError) => void;
}

export function useAIStream(options: UseAIStreamOptions = {}) {
  const [state, setState] = useState<StreamState>({
    content: '',
    isStreaming: false,
    error: null,
    streamId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');

  const startStream = useCallback(
    async (prompt: string, documentId?: string, projectId?: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      contentRef.current = '';

      setState({
        content: '',
        isStreaming: true,
        error: null,
        streamId: null,
      });

      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, documentId, projectId }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Stream request failed');
        }

        const streamId = response.headers.get('X-Stream-Id');
        setState((prev) => ({ ...prev, streamId }));

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n').filter((line) => line.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              setState((prev) => ({ ...prev, isStreaming: false }));
              options.onComplete?.(contentRef.current);
              return;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: parsed.error,
                }));
                options.onError?.(parsed.error);
                return;
              }

              if (parsed.content && parsed.id !== 'heartbeat') {
                contentRef.current += parsed.content;
                setState((prev) => ({
                  ...prev,
                  content: contentRef.current,
                }));
                options.onChunk?.(parsed.content);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        const error: ClaudeError = {
          code: 'UNKNOWN',
          message: (err as Error).message,
          retryable: true,
        };

        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error,
        }));
        options.onError?.(error);
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    contentRef.current = '';
    setState({
      content: '',
      isStreaming: false,
      error: null,
      streamId: null,
    });
  }, [cancel]);

  return {
    ...state,
    startStream,
    cancel,
    reset,
  };
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/hooks/__tests__/useAIStream.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add src/hooks/useAIStream.ts src/hooks/__tests__/useAIStream.test.tsx
git commit -m "feat(hooks): add useAIStream hook for SSE consumption"
```

---

## Task 10: SSE API Route

**Files:**

- Create: `src/lib/ai/index.ts`
- Create: `src/app/api/ai/generate/route.ts`
- Test: `src/app/api/ai/generate/__tests__/route.test.ts`

### Step 1: Create provider factory

```typescript
// src/lib/ai/index.ts
import { ClaudeStream } from './streaming';
import { ClaudeCLIProvider } from './claude-cli';
import type { AIProvider } from './types';

// Factory for creating AI providers (enables future Anthropic API migration)
export function createAIProvider(): AIProvider {
  // Future: check for ANTHROPIC_API_KEY and return AnthropicAPIProvider
  return new ClaudeCLIProvider();
}

// Re-export streaming for direct use
export { ClaudeStream } from './streaming';
export type { StreamChunk, StreamCallbacks } from './streaming';
```

### Step 2: Write the failing test for the route

```typescript
// src/app/api/ai/generate/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  ClaudeStream: vi.fn().mockImplementation(() => ({
    stream: vi.fn().mockImplementation((prompt, callbacks) => {
      callbacks.onChunk({ id: 'chunk-0', sequence: 0, content: 'Test', done: false });
      callbacks.onComplete();
    }),
    cancel: vi.fn(),
  })),
}));

import { createClient } from '@/lib/supabase/server';

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should return 400 if prompt missing', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '1' } } }),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return SSE stream with correct headers', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '1' } } }),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Stream-Id')).toBeDefined();
  });
});
```

### Step 3: Run test to verify it fails

Run: `npm test src/app/api/ai/generate/__tests__/route.test.ts`
Expected: FAIL (module not found)

### Step 4: Implement the route

```typescript
// src/app/api/ai/generate/route.ts
import { NextRequest } from 'next/server';
import { ClaudeStream, StreamChunk } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { prompt, documentId, projectId } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const streamId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const claudeStream = new ClaudeStream();

      request.signal.addEventListener('abort', () => {
        claudeStream.cancel();
        controller.close();
      });

      await claudeStream.stream(prompt, {
        onChunk: (chunk: StreamChunk) => {
          if (request.signal.aborted) return;
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        },
        onComplete: () => {
          if (!request.signal.aborted) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        },
        onError: (error) => {
          if (!request.signal.aborted) {
            const errorData = JSON.stringify({ error });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Stream-Id': streamId,
    },
  });
}
```

### Step 5: Run test to verify it passes

Run: `npm test src/app/api/ai/generate/__tests__/route.test.ts`
Expected: PASS

### Step 6: Commit

```bash
git add src/lib/ai/index.ts src/app/api/ai/generate/route.ts src/app/api/ai/generate/__tests__/route.test.ts
git commit -m "feat(api): add SSE streaming endpoint with provider factory"
```

---

## Task 11: Context Builder

**Files:**

- Create: `src/lib/ai/context-builder.ts`
- Test: `src/lib/ai/__tests__/context-builder.test.ts`

### Step 1: Write the failing test

```typescript
// src/lib/ai/__tests__/context-builder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatContextForPrompt, buildPromptWithContext } from '../context-builder';

describe('formatContextForPrompt', () => {
  it('should format context with document content', () => {
    const context = {
      documentContent: 'My document',
      vaultContext: [],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toContain('## Current Document');
    expect(formatted).toContain('My document');
  });

  it('should include vault context', () => {
    const context = {
      documentContent: 'Doc',
      vaultContext: ['[From paper.pdf]: Research content'],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toContain('## Reference Materials');
    expect(formatted).toContain('paper.pdf');
  });

  it('should truncate long documents', () => {
    const context = {
      documentContent: 'x'.repeat(50000),
      vaultContext: [],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toContain('[Document truncated]');
    expect(formatted.length).toBeLessThan(40000);
  });

  it('should return empty string for empty context', () => {
    const context = {
      documentContent: '',
      vaultContext: [],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toBe('');
  });
});

describe('buildPromptWithContext', () => {
  it('should include operation-specific instructions', () => {
    const context = {
      documentContent: 'Doc',
      vaultContext: [],
      recentChat: [],
    };

    const selectionPrompt = buildPromptWithContext('improve this', context, 'selection');
    expect(selectionPrompt).toContain('selected portion');

    const cursorPrompt = buildPromptWithContext('write more', context, 'cursor');
    expect(cursorPrompt).toContain('cursor position');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/lib/ai/__tests__/context-builder.test.ts`
Expected: FAIL with "Cannot find module '../context-builder'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/context-builder.ts
export interface AIContext {
  documentContent: string;
  vaultContext: string[];
  recentChat: string[];
  recentOperations?: Array<{
    type: string;
    input: string;
    output: string;
    status: string;
  }>;
  citations?: Array<{
    shortRef: string;
    title: string;
  }>;
}

const MAX_CONTEXT_TOKENS = 8000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatContextForPrompt(context: AIContext): string {
  const parts: string[] = [];
  let tokenCount = 0;

  if (context.documentContent) {
    const docSection = `## Current Document\n${context.documentContent}`;
    const docTokens = estimateTokens(docSection);

    if (tokenCount + docTokens < MAX_CONTEXT_TOKENS * 0.6) {
      parts.push(docSection);
      tokenCount += docTokens;
    } else {
      const maxChars = (MAX_CONTEXT_TOKENS * 0.6 - tokenCount) * 4;
      parts.push(`## Current Document\n${context.documentContent.slice(0, maxChars)}...\n[Document truncated]`);
      tokenCount = MAX_CONTEXT_TOKENS * 0.6;
    }
  }

  if (context.recentOperations && context.recentOperations.length > 0) {
    const opsSection = `## Recent AI Operations (for context)\n${context.recentOperations
      .map((op) => `- ${op.type}: "${op.input.slice(0, 50)}..." → ${op.status}`)
      .join('\n')}`;
    const opsTokens = estimateTokens(opsSection);

    if (tokenCount + opsTokens < MAX_CONTEXT_TOKENS * 0.7) {
      parts.push(opsSection);
      tokenCount += opsTokens;
    }
  }

  if (context.vaultContext.length > 0) {
    const remainingBudget = MAX_CONTEXT_TOKENS - tokenCount - 500;
    let vaultSection = '## Reference Materials\n';
    let vaultTokens = estimateTokens(vaultSection);

    for (const chunk of context.vaultContext) {
      const chunkTokens = estimateTokens(chunk);
      if (vaultTokens + chunkTokens < remainingBudget) {
        vaultSection += chunk + '\n\n';
        vaultTokens += chunkTokens;
      } else {
        break;
      }
    }

    if (vaultSection !== '## Reference Materials\n') {
      parts.push(vaultSection.trim());
      tokenCount += vaultTokens;
    }
  }

  if (context.citations && context.citations.length > 0) {
    const citSection = `## Available Citations\n${context.citations
      .map((c) => `- ${c.shortRef}: "${c.title}"`)
      .join('\n')}`;
    const citTokens = estimateTokens(citSection);

    if (tokenCount + citTokens < MAX_CONTEXT_TOKENS) {
      parts.push(citSection);
    }
  }

  return parts.join('\n\n');
}

export function buildPromptWithContext(
  userPrompt: string,
  context: AIContext,
  operationType: 'selection' | 'cursor' | 'global' | 'chat'
): string {
  const formattedContext = formatContextForPrompt(context);

  const systemInstructions: Record<string, string> = {
    selection:
      'You are helping edit a selected portion of an academic document. Keep the same style and tone as the surrounding content.',
    cursor:
      'You are generating new content to be inserted at the cursor position in an academic document. Match the existing style.',
    global:
      'You are making changes across an entire academic document. Preserve the structure and improve consistency.',
    chat: 'You are a writing assistant helping with an academic grant proposal. Provide helpful, specific advice.',
  };

  return `${systemInstructions[operationType]}

${formattedContext}

User request: ${userPrompt}`;
}
```

### Step 4: Run test to verify it passes

Run: `npm test src/lib/ai/__tests__/context-builder.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/ai/context-builder.ts src/lib/ai/__tests__/context-builder.test.ts
git commit -m "feat(ai): add context builder with token budget management"
```

---

## Task 12: TipTap Selection Tracker Extension

**Files:**

- Create: `src/components/editor/extensions/selection-tracker.ts`
- Test: `src/components/editor/extensions/__tests__/selection-tracker.test.ts`

### Step 1: Write the failing test

```typescript
// src/components/editor/extensions/__tests__/selection-tracker.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SelectionTracker } from '../selection-tracker';

describe('SelectionTracker', () => {
  it('should track selection changes', () => {
    const editor = new Editor({
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Test content for selection</p>',
    });

    // Set selection
    editor.commands.setTextSelection({ from: 4, to: 8 });

    const storage = editor.storage.selectionTracker;
    expect(storage.selection).not.toBeNull();
    expect(storage.selection?.text).toBe('Test');

    editor.destroy();
  });

  it('should clear selection when collapsed', () => {
    const editor = new Editor({
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Test content</p>',
    });

    editor.commands.setTextSelection({ from: 4, to: 8 });
    expect(editor.storage.selectionTracker.selection).not.toBeNull();

    editor.commands.setTextSelection(4);
    expect(editor.storage.selectionTracker.selection).toBeNull();

    editor.destroy();
  });

  it('should notify listeners on selection change', () => {
    const listener = vi.fn();
    const editor = new Editor({
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Test content</p>',
    });

    editor.storage.selectionTracker.listeners.add(listener);
    editor.commands.setTextSelection({ from: 4, to: 8 });

    expect(listener).toHaveBeenCalled();
    editor.destroy();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/components/editor/extensions/__tests__/selection-tracker.test.ts`
Expected: FAIL (module not found)

### Step 3: Implement selection tracker

```typescript
// src/components/editor/extensions/selection-tracker.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SelectionState {
  from: number;
  to: number;
  text: string;
  rect: DOMRect | null;
}

export const SelectionTracker = Extension.create({
  name: 'selectionTracker',

  addStorage() {
    return {
      selection: null as SelectionState | null,
      listeners: new Set<(sel: SelectionState | null) => void>(),
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('selectionTracker'),
        view() {
          return {
            update(view) {
              const { selection } = view.state;
              const { from, to } = selection;

              if (from === to) {
                if (extension.storage.selection !== null) {
                  extension.storage.selection = null;
                  extension.storage.listeners.forEach((fn) => fn(null));
                }
                return;
              }

              const text = view.state.doc.textBetween(from, to, '\n');
              const start = view.coordsAtPos(from);
              const end = view.coordsAtPos(to);

              const rect = new DOMRect(start.left, start.top, end.right - start.left, end.bottom - start.top);

              const newSelection: SelectionState = { from, to, text, rect };
              extension.storage.selection = newSelection;
              extension.storage.listeners.forEach((fn) => fn(newSelection));
            },
          };
        },
      }),
    ];
  },
});
```

### Step 4: Run test to verify it passes

Run: `npm test src/components/editor/extensions/__tests__/selection-tracker.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/components/editor/extensions/selection-tracker.ts src/components/editor/extensions/__tests__/selection-tracker.test.ts
git commit -m "feat(editor): add TipTap selection tracker extension"
```

---

## Task 13: Selection Toolbar with Accessibility

**Files:**

- Create: `src/components/editor/SelectionToolbar.tsx`
- Test: `src/components/editor/__tests__/SelectionToolbar.test.tsx`

### Step 1: Write the failing test with accessibility checks

```typescript
// src/components/editor/__tests__/SelectionToolbar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionToolbar } from '../SelectionToolbar';
import { useAIStore } from '@/lib/stores/ai-store';

vi.mock('@/lib/stores/ai-store');
vi.mock('@/hooks/useAIStream', () => ({
  useAIStream: () => ({
    startStream: vi.fn(),
    cancel: vi.fn(),
    content: '',
    isStreaming: false,
    error: null,
  }),
}));

const mockEditor = {
  getHTML: vi.fn().mockReturnValue('<p>Test</p>'),
  chain: vi.fn().mockReturnThis(),
  focus: vi.fn().mockReturnThis(),
  setTextSelection: vi.fn().mockReturnThis(),
  insertContent: vi.fn().mockReturnThis(),
  run: vi.fn(),
  commands: { focus: vi.fn() },
};

const mockSelection = {
  from: 0,
  to: 10,
  text: 'Test text',
  rect: new DOMRect(100, 100, 50, 20),
};

describe('SelectionToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: null,
      startOperation: vi.fn().mockReturnValue('op-1'),
      appendOutput: vi.fn(),
      setOutput: vi.fn(),
      setStatus: vi.fn(),
      setError: vi.fn(),
      acceptOperation: vi.fn(),
      rejectOperation: vi.fn(),
    } as any);
  });

  it('should have proper ARIA attributes', () => {
    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Text formatting actions');
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('should support keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const refineBtn = screen.getByRole('button', { name: /refine/i });
    refineBtn.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /extend/i })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(refineBtn).toHaveFocus();
  });

  it('should close on Escape key', async () => {
    const rejectOperation = vi.fn();
    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: null,
      rejectOperation,
    } as any);

    const user = userEvent.setup();

    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    await user.keyboard('{Escape}');
    expect(rejectOperation).toHaveBeenCalled();
  });

  it('should announce loading state to screen readers', () => {
    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: { status: 'loading' },
    } as any);

    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/generating/i);
  });

  it('buttons should have accessible names with descriptions', () => {
    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const refineBtn = screen.getByRole('button', { name: /refine.*improve clarity/i });
    expect(refineBtn).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test src/components/editor/__tests__/SelectionToolbar.test.tsx`
Expected: FAIL (module not found)

### Step 3: Implement SelectionToolbar (abbreviated - see original plan for full component)

Create `src/components/editor/SelectionToolbar.tsx` with full ARIA support as shown in original plan.

### Step 4: Run test to verify it passes

Run: `npm test src/components/editor/__tests__/SelectionToolbar.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add src/components/editor/SelectionToolbar.tsx src/components/editor/__tests__/SelectionToolbar.test.tsx
git commit -m "feat(editor): add accessible selection toolbar with keyboard nav"
```

---

## Task 14: E2E Tests with Playwright

**Files:**

- Create: `e2e/selection-toolbar.spec.ts`
- Create: `e2e/cursor-generation.spec.ts`

### Step 1: Create selection toolbar E2E tests

```typescript
// e2e/selection-toolbar.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Selection Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the AI endpoint
    await page.route('/api/ai/generate', async (route) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"content":"Refined text with better clarity."}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: Buffer.from(await new Response(stream).arrayBuffer()),
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.waitForSelector('[role="textbox"]');
  });

  test('should appear when text is selected', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('This is some text to select.');

    // Select all text
    await editor.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /refine/i })).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Select this text');
    await editor.press('Control+a');

    const toolbar = page.getByRole('toolbar');
    await expect(toolbar).toBeVisible();

    // First button should be focused
    const refineBtn = toolbar.getByRole('button', { name: /refine/i });
    await expect(refineBtn).toBeFocused();

    // Arrow right moves to next
    await page.keyboard.press('ArrowRight');
    await expect(toolbar.getByRole('button', { name: /extend/i })).toBeFocused();

    // Escape closes
    await page.keyboard.press('Escape');
    await expect(toolbar).not.toBeVisible();
  });

  test('should show loading spinner during generation', async ({ page }) => {
    // Delay mock response
    await page.route('/api/ai/generate', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Result"}\n\ndata: [DONE]\n\n',
      });
    });

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Test');
    await editor.press('Control+a');

    await page.getByRole('button', { name: /refine/i }).click();

    // Should show aria-busy and loading indicator
    const toolbar = page.getByRole('toolbar');
    await expect(toolbar).toHaveAttribute('aria-busy', 'true');
  });

  test('should accept and replace selected text', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Original text');
    await editor.press('Control+a');

    await page.getByRole('button', { name: /refine/i }).click();

    // Wait for and click Accept
    await page.getByRole('button', { name: /accept/i }).click({ timeout: 5000 });

    // Text should be replaced
    await expect(editor).toContainText('Refined text');
  });

  test('should have proper ARIA live regions', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Test');
    await editor.press('Control+a');

    // Check for live region
    const status = page.getByRole('status');
    await expect(status).toBeAttached();
  });
});
```

### Step 2: Create cursor generation E2E tests

```typescript
// e2e/cursor-generation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Cursor Generation (Cmd+K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI generated content here."}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.waitForSelector('[role="textbox"]');
  });

  test('should open modal on Cmd+K', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();

    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog', { name: /generate/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('textbox')).toBeFocused();
  });

  test('should have correct ARIA attributes on modal', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby');
  });

  test('should close on Escape', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('should trap focus within modal', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    const promptInput = modal.getByRole('textbox');
    const cancelBtn = modal.getByRole('button', { name: /cancel/i });

    await expect(promptInput).toBeFocused();

    // Tab through all elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should loop back (focus trap)
    await page.keyboard.press('Tab');
    // Focus should still be within modal
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeAttached();
  });

  test('should show streaming preview', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await modal.getByRole('textbox').fill('Write a transition paragraph');
    await modal.getByRole('button', { name: /generate/i }).click();

    // Preview should appear with live region
    const preview = modal.locator('[aria-live="polite"]');
    await expect(preview).toContainText('AI generated');
  });

  test('should insert content at cursor on Accept', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Before cursor.');

    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await modal.getByRole('textbox').fill('Generate text');
    await modal.getByRole('button', { name: /generate/i }).click();

    await modal.getByRole('button', { name: /accept/i }).click({ timeout: 5000 });

    await expect(editor).toContainText('Before cursor.');
    await expect(editor).toContainText('AI generated');
    await expect(modal).not.toBeVisible();
  });

  test('should support keyboard-only operation', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();

    // Open with keyboard
    await page.keyboard.press('Meta+k');

    // Type prompt
    await page.keyboard.type('Write something');

    // Submit with Enter
    await page.keyboard.press('Enter');

    // Wait for preview, then Enter to accept
    await page.waitForSelector('[data-testid="preview-panel"]', { timeout: 5000 });
    await page.keyboard.press('Enter');

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

### Step 3: Run E2E tests

Run: `npm run test:e2e`
Expected: PASS (with mocked routes)

### Step 4: Commit

```bash
git add e2e/selection-toolbar.spec.ts e2e/cursor-generation.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for AI features"
```

---

## Task 15: Integration with Editor

**Files:**

- Modify: `src/components/editor/DocumentEditor.tsx`

### Step 1: Integrate all components

Add to your existing DocumentEditor:

```typescript
// src/components/editor/DocumentEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SelectionTracker, useEditorSelection } from './extensions/selection-tracker';
import { SelectionToolbar } from './SelectionToolbar';
import { CursorPrompt } from './CursorPrompt';

interface DocumentEditorProps {
  projectId: string;
  documentId: string;
  initialContent?: string;
}

export function DocumentEditor({ projectId, documentId, initialContent }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      SelectionTracker,
    ],
    content: initialContent || '<p>Start writing...</p>',
  });

  const selection = useEditorSelection(editor);

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        className="prose max-w-none"
      />

      {editor && selection && (
        <SelectionToolbar
          editor={editor}
          selection={selection}
          projectId={projectId}
          documentId={documentId}
        />
      )}

      {editor && (
        <CursorPrompt
          editor={editor}
          projectId={projectId}
          documentId={documentId}
        />
      )}
    </div>
  );
}
```

### Step 2: Commit

```bash
git add src/components/editor/DocumentEditor.tsx
git commit -m "feat(editor): integrate AI toolbar and cursor prompt"
```

---

## Completion Checklist

After all tasks:

```bash
npm test                    # All unit tests pass
npm run test:e2e            # All E2E tests pass
npm run lint                # No linting errors
npm run build               # Build succeeds
```

### Functional Verification

- [ ] `claude --version` works
- [ ] Streaming responses appear progressively
- [ ] Selection toolbar appears on text selection
- [ ] Refine/Extend/Shorten/Simplify actions work
- [ ] Cmd+K opens cursor prompt modal
- [ ] Accept/Reject flows work correctly
- [ ] Keyboard navigation works throughout
- [ ] Error states display with retry options

### Accessibility Verification

- [ ] All interactive elements have accessible names
- [ ] Toolbar has `role="toolbar"` with `aria-label`
- [ ] Modal has `role="dialog"` with `aria-modal="true"`
- [ ] Focus is trapped within modal when open
- [ ] Focus returns to editor when modal closes
- [ ] Live regions announce state changes (loading, preview, error)
- [ ] Screen reader can navigate all actions
- [ ] Keyboard-only operation works end-to-end

### Edge Cases Verified

- [ ] Cancel during stream works (no orphan processes)
- [ ] Empty response handled gracefully
- [ ] Network failure shows retry option
- [ ] Rate limit shows appropriate wait message
- [ ] Context too long shows truncation notice
- [ ] Multiple rapid requests queue properly
- [ ] Heartbeat keeps connection alive during slow generation

---

## Migration Notes for Direct Anthropic API

When ready to add direct API:

1. Create `src/lib/ai/anthropic-provider.ts` implementing `AIProvider`
2. Add `ANTHROPIC_API_KEY` to environment
3. Create provider factory:

```typescript
// src/lib/ai/index.ts
import { ClaudeCLIProvider } from './claude-cli';
import { AnthropicAPIProvider } from './anthropic-provider';
import type { AIProvider } from './types';

export function createAIProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicAPIProvider();
  }
  return new ClaudeCLIProvider();
}
```

---

## Dependencies

```bash
npm install zustand
```
