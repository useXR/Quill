# Phase 3: AI Integration (Claude Code CLI) - Detailed Implementation Plan

> **Source:** Generated from comprehensive review of the original Phase 3 plan by architecture and testing specialist agents.

**Goal:** Integrate Claude Code CLI as the AI backbone for Quill, enabling selection actions, cursor generation (Cmd+K), and streaming AI responses with robust error handling and state management.

**Architecture Decision:** Subprocess-based Claude CLI integration (vs direct Anthropic API) to leverage existing Claude subscriptions without additional API costs. Migration path to direct API designed in from the start.

---

## Prerequisites

Before starting Phase 3, ensure:

- [ ] Phase 0-2 completed (Next.js, Supabase, TipTap, Vault)
- [ ] Claude Code CLI installed locally (`claude --version`)
- [ ] Vitest and Playwright configured and passing
- [ ] `npm install zustand diff` (new dependencies)

---

## Task 3.1: Create Claude Code CLI Wrapper (Enhanced)

**Goal:** Build a robust, testable wrapper around the Claude CLI with process management, error categorization, and sanitization.

### Files to Create/Modify

| File                                            | Action | Purpose                               |
| ----------------------------------------------- | ------ | ------------------------------------- |
| `src/lib/ai/types.ts`                           | Create | Type definitions for AI module        |
| `src/lib/ai/claude-cli.ts`                      | Create | Core CLI wrapper with process manager |
| `src/lib/ai/errors.ts`                          | Create | Error types and categorization        |
| `src/lib/ai/sanitize.ts`                        | Create | Input sanitization utilities          |
| `src/lib/ai/__tests__/claude-cli.test.ts`       | Create | Unit tests                            |
| `src/lib/ai/__tests__/mocks/mock-claude-cli.ts` | Create | Test mock factory                     |

---

### Step 1: Define Type System

Create `src/lib/ai/types.ts`:

```typescript
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

---

### Step 2: Create Error Handling Module

Create `src/lib/ai/errors.ts`:

```typescript
import type { ClaudeError, ClaudeErrorCode } from './types';

const ERROR_PATTERNS: Array<{ pattern: RegExp; code: ClaudeErrorCode; retryable: boolean; suggestion?: string }> = [
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

export function isRetryableError(error: ClaudeError): boolean {
  return error.retryable && !['AUTH_FAILURE', 'CLI_NOT_FOUND'].includes(error.code);
}
```

---

### Step 3: Create Input Sanitization

Create `src/lib/ai/sanitize.ts`:

```typescript
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

  // Length validation
  if (sanitized.length > MAX_CONTEXT_SIZE) {
    // Truncate with indicator rather than failing
    sanitized = sanitized.slice(0, MAX_CONTEXT_SIZE - 50) + '\n\n[Context truncated...]';
  }

  return sanitized;
}

export function validateInputSizes(prompt: string, context?: string): void {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new SanitizationError(`Prompt too long: ${prompt.length} > ${MAX_PROMPT_LENGTH}`);
  }
  if (context && context.length > MAX_CONTEXT_SIZE) {
    throw new SanitizationError(`Context too large: ${context.length} > ${MAX_CONTEXT_SIZE}`);
  }
}
```

---

### Step 4: Implement CLI Wrapper with Process Manager

Create `src/lib/ai/claude-cli.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import type { ClaudeRequest, ClaudeResponse, CLIStatus, AIProvider } from './types';
import { categorizeError, isRetryableError } from './errors';
import { sanitizePrompt, sanitizeContext } from './sanitize';

const execPromise = promisify(exec);
const MINIMUM_CLI_VERSION = '1.0.0';
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
          shell: false, // SECURITY: Never use shell
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
          },
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
}

// Singleton instance
const processManager = new ClaudeProcessManager();

export async function invokeClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  return processManager.invoke(request);
}

export function cancelClaude(): void {
  processManager.cancel();
}

export async function validateClaudeCLI(): Promise<CLIStatus> {
  try {
    const { stdout } = await execPromise('claude --version');
    const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);

    if (!versionMatch) {
      return { status: 'error', message: 'Could not parse CLI version' };
    }

    const version = versionMatch[1];

    // Simple version comparison (for MVP)
    if (version < MINIMUM_CLI_VERSION) {
      return {
        status: 'outdated',
        version,
        message: `Claude CLI ${version} found, but ${MINIMUM_CLI_VERSION}+ required`,
      };
    }

    // Test authentication
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

// Export for direct API migration
export class ClaudeCLIProvider implements AIProvider {
  private manager = new ClaudeProcessManager();

  async generate(request: ClaudeRequest): Promise<ClaudeResponse> {
    return this.manager.invoke(request);
  }

  async *stream(request: ClaudeRequest): AsyncIterable<string> {
    // Streaming implementation - see Task 3.2
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

---

### Step 5: Create Test Mock Factory

Create `src/lib/ai/__tests__/mocks/mock-claude-cli.ts`:

```typescript
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
  | 'cli_not_found';

export interface MockClaudeOptions {
  scenario: MockScenario;
  responseChunks?: string[];
  delayMs?: number;
  errorMessage?: string;
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

      case 'timeout':
        // Never emit close - simulate timeout
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

      case 'cli_not_found':
        proc.emit('error', Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
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

---

### Step 6: Write Unit Tests

Create `src/lib/ai/__tests__/claude-cli.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { invokeClaude, validateClaudeCLI, cancelClaude } from '../claude-cli';
import { setupMockClaude } from './mocks/mock-claude-cli';

vi.mock('child_process');

describe('Claude CLI Wrapper', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cancelClaude();
  });

  describe('invokeClaude', () => {
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
      expect(result.error?.suggestion).toContain('login');
    });

    it('should handle rate limits with retry info', async () => {
      setupMockClaude({ scenario: 'rate_limit' });

      const result = await invokeClaude({ prompt: 'Test' });

      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.retryAfterMs).toBeGreaterThan(0);
    });

    it('should handle CLI not found', async () => {
      setupMockClaude({ scenario: 'cli_not_found' });

      const result = await invokeClaude({ prompt: 'Test' });

      expect(result.error?.code).toBe('CLI_NOT_FOUND');
      expect(result.error?.suggestion).toContain('Install');
    });

    it('should recover partial content on error', async () => {
      setupMockClaude({ scenario: 'partial_then_error' });

      const result = await invokeClaude({ prompt: 'Test' });

      expect(result.partial).toBe(true);
      expect(result.content).toBe('Partial');
      expect(result.error).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      setupMockClaude({ scenario: 'malformed_json' });

      const result = await invokeClaude({ prompt: 'Test' });

      expect(result.content).toBe('valid');
    });

    it('should reject prompts starting with CLI flags', async () => {
      const result = await invokeClaude({ prompt: '--dangerous-flag' });

      expect(result.error?.code).toBe('UNKNOWN');
      expect(result.error?.message).toContain('CLI flags');
    });
  });

  describe('command construction', () => {
    it('should pass prompt with -p flag', async () => {
      setupMockClaude({ scenario: 'success' });

      await invokeClaude({ prompt: 'My prompt' });

      expect(spawn).toHaveBeenCalledWith('claude', expect.arrayContaining(['-p', 'My prompt']), expect.any(Object));
    });

    it('should pass context when provided', async () => {
      setupMockClaude({ scenario: 'success' });

      await invokeClaude({ prompt: 'Test', context: 'My context' });

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--context', 'My context']),
        expect.any(Object)
      );
    });

    it('should use stream-json output format', async () => {
      setupMockClaude({ scenario: 'success' });

      await invokeClaude({ prompt: 'Test' });

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--output-format', 'stream-json']),
        expect.any(Object)
      );
    });

    it('should not use shell option (security)', async () => {
      setupMockClaude({ scenario: 'success' });

      await invokeClaude({ prompt: 'Test' });

      expect(spawn).toHaveBeenCalledWith('claude', expect.any(Array), expect.objectContaining({ shell: false }));
    });
  });
});
```

---

### Step 7: Run Tests and Verify

```bash
npm test src/lib/ai/__tests__/claude-cli.test.ts
```

Expected: All tests pass

---

### Step 8: Commit

```bash
git add .
git commit -m "feat(ai): add Claude CLI wrapper with process manager and error handling

- Process manager with queue to prevent concurrent CLI calls
- Comprehensive error categorization (auth, rate limit, timeout, etc.)
- Input sanitization to prevent CLI flag injection
- Automatic retry for retryable errors
- Partial content recovery on mid-stream failures
- Full test coverage with mock factory"
```

---

## Task 3.2: Create Streaming Claude Endpoint (Enhanced)

**Goal:** Implement robust streaming with backpressure handling, heartbeats, and reconnection support.

### Files to Create/Modify

| File                                     | Action | Purpose                         |
| ---------------------------------------- | ------ | ------------------------------- |
| `src/lib/ai/streaming.ts`                | Create | Robust streaming implementation |
| `src/app/api/ai/generate/route.ts`       | Create | SSE streaming endpoint          |
| `src/lib/ai/__tests__/streaming.test.ts` | Create | Streaming unit tests            |
| `src/hooks/useAIStream.ts`               | Create | Client-side streaming hook      |

---

### Step 1: Create Streaming Module

Create `src/lib/ai/streaming.ts`:

```typescript
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

      // Start heartbeat
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
        // Log but don't fail on stderr (warnings)
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

// Convenience function
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

---

### Step 2: Create SSE API Route

Create `src/app/api/ai/generate/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { ClaudeStream, StreamChunk } from '@/lib/ai/streaming';
import { buildContext, formatContextForPrompt } from '@/lib/ai/context-builder';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verify authentication
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

  // Build context
  let formattedContext = '';
  if (documentId && projectId) {
    try {
      const context = await buildContext(documentId, projectId, prompt);
      formattedContext = formatContextForPrompt(context);
    } catch (err) {
      console.error('Context build error:', err);
    }
  }

  // Generate stream ID for reconnection
  const streamId = crypto.randomUUID();

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const claudeStream = new ClaudeStream();

      // Handle abort
      request.signal.addEventListener('abort', () => {
        claudeStream.cancel();
        controller.close();
      });

      await claudeStream.stream(
        prompt,
        {
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
        },
        { context: formattedContext }
      );
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

---

### Step 3: Create Client Hook

Create `src/hooks/useAIStream.ts`:

```typescript
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
      // Cancel any existing stream
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

---

### Step 4: Write Streaming Tests

Create `src/lib/ai/__tests__/streaming.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { ClaudeStream, streamClaude } from '../streaming';
import { setupMockClaude } from './mocks/mock-claude-cli';

vi.mock('child_process');

describe('ClaudeStream', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('streaming behavior', () => {
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

    it('should emit heartbeats during long operations', async () => {
      vi.useFakeTimers();

      setupMockClaude({ scenario: 'slow_stream', delayMs: 2000 });

      const heartbeats: number[] = [];
      const stream = new ClaudeStream();

      const streamPromise = new Promise<void>((resolve) => {
        stream.stream('prompt', {
          onChunk: (chunk) => {
            if (chunk.id === 'heartbeat') {
              heartbeats.push(chunk.sequence);
            }
          },
          onComplete: resolve,
          onError: () => resolve(),
        });
      });

      // Advance time to trigger heartbeats
      await vi.advanceTimersByTimeAsync(15000);

      stream.cancel();
      vi.useRealTimers();

      expect(heartbeats.length).toBeGreaterThan(0);
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

      // Cancel immediately
      stream.cancel();

      await new Promise((r) => setTimeout(r, 200));

      // Should have minimal or no chunks
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

  describe('getChunksAfter', () => {
    it('should return chunks after sequence number', async () => {
      setupMockClaude({
        scenario: 'success',
        responseChunks: ['{"content":"A"}', '{"content":"B"}', '{"content":"C"}'],
      });

      const stream = new ClaudeStream();

      await new Promise<void>((resolve) => {
        stream.stream('prompt', {
          onChunk: () => {},
          onComplete: resolve,
          onError: () => resolve(),
        });
      });

      const afterFirst = stream.getChunksAfter(0);
      expect(afterFirst.length).toBe(2);
      expect(afterFirst[0].content).toBe('B');
    });
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
      const cancel = streamClaude(
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

---

### Step 5: Commit

```bash
git add .
git commit -m "feat(ai): add streaming Claude endpoint with SSE

- ClaudeStream class with backpressure and heartbeat support
- SSE API route at /api/ai/generate
- useAIStream React hook for client-side consumption
- Cancellation and partial content recovery
- Full test coverage"
```

---

## Task 3.3: Create Enhanced Context Builder

**Goal:** Build comprehensive context from document sections, vault, previous operations, and citations.

### Files to Create/Modify

| File                                           | Action | Purpose                   |
| ---------------------------------------------- | ------ | ------------------------- |
| `src/lib/ai/context-builder.ts`                | Create | Enhanced context assembly |
| `src/lib/ai/__tests__/context-builder.test.ts` | Create | Context builder tests     |

---

### Step 1: Create Enhanced Context Builder

Create `src/lib/ai/context-builder.ts`:

```typescript
import { searchVault, type SearchResult } from '@/lib/api/search';
import { getDocument } from '@/lib/api/documents';
import { getRecentOperations } from '@/lib/api/ai-operations';
import { getCitationsForProject } from '@/lib/api/citations';

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

export interface EnhancedAIContext extends AIContext {
  currentSection?: {
    content: string;
    heading: string;
    position: number;
  };
  tokenEstimate: number;
}

const MAX_CONTEXT_TOKENS = 8000;

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

export async function buildContext(
  documentId: string,
  projectId: string,
  query: string,
  options: {
    includeOperations?: boolean;
    includeCitations?: boolean;
    maxVaultChunks?: number;
  } = {}
): Promise<AIContext> {
  const { includeOperations = false, includeCitations = false, maxVaultChunks = 5 } = options;

  // Parallel fetches for efficiency
  const [document, vaultResults, operations, citations] = await Promise.all([
    getDocument(documentId).catch(() => null),
    searchVault(projectId, query, maxVaultChunks, 0.7).catch(() => []),
    includeOperations ? getRecentOperations(documentId, 3).catch(() => []) : Promise.resolve([]),
    includeCitations ? getCitationsForProject(projectId).catch(() => []) : Promise.resolve([]),
  ]);

  const documentContent = document?.content_text || '';

  const vaultContext = (vaultResults as SearchResult[]).map((r) => `[From ${r.filename}]: ${r.content}`);

  const context: AIContext = {
    documentContent,
    vaultContext,
    recentChat: [],
  };

  if (includeOperations && operations.length > 0) {
    context.recentOperations = operations.map((op) => ({
      type: op.operation_type,
      input: op.input_summary || '',
      output: (op.output_content || '').slice(0, 200),
      status: op.status,
    }));
  }

  if (includeCitations && citations.length > 0) {
    context.citations = citations.slice(0, 10).map((c) => ({
      shortRef: `${c.authors?.split(',')[0] || 'Unknown'}, ${c.year || 'n.d.'}`,
      title: c.title,
    }));
  }

  return context;
}

export function formatContextForPrompt(context: AIContext): string {
  const parts: string[] = [];
  let tokenCount = 0;

  // Priority 1: Document content
  if (context.documentContent) {
    const docSection = `## Current Document\n${context.documentContent}`;
    const docTokens = estimateTokens(docSection);

    if (tokenCount + docTokens < MAX_CONTEXT_TOKENS * 0.6) {
      parts.push(docSection);
      tokenCount += docTokens;
    } else {
      // Truncate document if too long
      const maxChars = (MAX_CONTEXT_TOKENS * 0.6 - tokenCount) * 4;
      parts.push(`## Current Document\n${context.documentContent.slice(0, maxChars)}...\n[Document truncated]`);
      tokenCount = MAX_CONTEXT_TOKENS * 0.6;
    }
  }

  // Priority 2: Recent operations (prevent repetition)
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

  // Priority 3: Vault context
  if (context.vaultContext.length > 0) {
    const remainingBudget = MAX_CONTEXT_TOKENS - tokenCount - 500; // Reserve for citations
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

  // Priority 4: Available citations
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

---

### Step 2: Write Context Builder Tests

Create `src/lib/ai/__tests__/context-builder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildContext, formatContextForPrompt, buildPromptWithContext } from '../context-builder';
import * as searchModule from '@/lib/api/search';
import * as documentsModule from '@/lib/api/documents';

vi.mock('@/lib/api/search');
vi.mock('@/lib/api/documents');
vi.mock('@/lib/api/ai-operations', () => ({
  getRecentOperations: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/api/citations', () => ({
  getCitationsForProject: vi.fn().mockResolvedValue([]),
}));

describe('Context Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildContext', () => {
    it('should build context with document and vault', async () => {
      vi.mocked(documentsModule.getDocument).mockResolvedValue({
        id: 'doc-1',
        content_text: 'Test document content',
        content: {},
        title: 'Test',
        project_id: 'proj-1',
        sort_order: 0,
        version: 1,
        created_at: '',
        updated_at: '',
      });

      vi.mocked(searchModule.searchVault).mockResolvedValue([
        { content: 'Vault chunk 1', similarity: 0.9, vaultItemId: 'v1', filename: 'paper.pdf' },
      ]);

      const context = await buildContext('doc-1', 'proj-1', 'query');

      expect(context.documentContent).toBe('Test document content');
      expect(context.vaultContext).toHaveLength(1);
      expect(context.vaultContext[0]).toContain('paper.pdf');
    });

    it('should handle empty vault results', async () => {
      vi.mocked(documentsModule.getDocument).mockResolvedValue({
        id: 'doc-1',
        content_text: 'Content',
        content: {},
        title: 'Test',
        project_id: 'proj-1',
        sort_order: 0,
        version: 1,
        created_at: '',
        updated_at: '',
      });

      vi.mocked(searchModule.searchVault).mockResolvedValue([]);

      const context = await buildContext('doc-1', 'proj-1', 'obscure query');

      expect(context.vaultContext).toHaveLength(0);
    });

    it('should handle null document', async () => {
      vi.mocked(documentsModule.getDocument).mockResolvedValue(null);
      vi.mocked(searchModule.searchVault).mockResolvedValue([]);

      const context = await buildContext('nonexistent', 'proj-1', 'query');

      expect(context.documentContent).toBe('');
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format context with all sections', () => {
      const context = {
        documentContent: 'My document',
        vaultContext: ['[From paper.pdf]: Research content'],
        recentChat: [],
        recentOperations: [{ type: 'selection', input: 'refine this', output: 'refined', status: 'accepted' }],
        citations: [{ shortRef: 'Smith, 2023', title: 'Important Paper' }],
      };

      const formatted = formatContextForPrompt(context);

      expect(formatted).toContain('## Current Document');
      expect(formatted).toContain('## Reference Materials');
      expect(formatted).toContain('## Recent AI Operations');
      expect(formatted).toContain('## Available Citations');
    });

    it('should omit empty sections', () => {
      const context = {
        documentContent: '',
        vaultContext: [],
        recentChat: [],
      };

      const formatted = formatContextForPrompt(context);

      expect(formatted).toBe('');
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

      const globalPrompt = buildPromptWithContext('fix grammar', context, 'global');
      expect(globalPrompt).toContain('entire academic document');
    });
  });
});
```

---

### Step 3: Commit

```bash
git add .
git commit -m "feat(ai): add enhanced context builder with token budget

- Document, vault, operations, and citations context
- Token budget management with priority ordering
- Operation-specific system instructions
- Truncation for oversized content
- Full test coverage"
```

---

## Task 3.4: Implement Selection Actions with Accessibility

**Goal:** Create a floating toolbar for text selection with AI actions, full keyboard accessibility, and proper ARIA attributes.

### Files to Create/Modify

| File                                                        | Action | Purpose                    |
| ----------------------------------------------------------- | ------ | -------------------------- |
| `src/lib/stores/ai-store.ts`                                | Create | Global AI state management |
| `src/components/editor/extensions/selection-tracker.ts`     | Create | TipTap selection extension |
| `src/components/editor/SelectionToolbar.tsx`                | Create | Floating toolbar UI        |
| `src/app/api/ai/selection/route.ts`                         | Create | Selection AI endpoint      |
| `src/components/editor/__tests__/SelectionToolbar.test.tsx` | Create | Component tests            |
| `e2e/selection-toolbar.spec.ts`                             | Create | E2E tests                  |

---

### Step 1: Create AI State Store

Create `src/lib/stores/ai-store.ts`:

```typescript
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

  // Actions
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
      operationHistory: [...state.operationHistory, { ...currentOperation, status: 'idle' }].slice(-50), // Keep last 50
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

---

### Step 2: Create TipTap Selection Extension

Create `src/components/editor/extensions/selection-tracker.ts`:

```typescript
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
                // No selection
                if (extension.storage.selection !== null) {
                  extension.storage.selection = null;
                  extension.storage.listeners.forEach((fn) => fn(null));
                }
                return;
              }

              const text = view.state.doc.textBetween(from, to, '\n');

              // Get position for toolbar placement
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

// React hook for selection state
import { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';

export function useEditorSelection(editor: Editor | null): SelectionState | null {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    if (!editor) return;

    const tracker = editor.storage.selectionTracker;
    if (!tracker) return;

    // Set initial state
    setSelection(tracker.selection);

    // Subscribe to changes
    tracker.listeners.add(setSelection);

    return () => {
      tracker.listeners.delete(setSelection);
    };
  }, [editor]);

  return selection;
}
```

---

### Step 3: Create Selection Toolbar Component

Create `src/components/editor/SelectionToolbar.tsx`:

```typescript
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Wand2, Expand, Minimize2, BookOpen, Loader2, X } from 'lucide-react';
import { useEditorSelection } from './extensions/selection-tracker';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';

interface SelectionToolbarProps {
  editor: Editor;
  projectId: string;
  documentId: string;
}

const ACTIONS = [
  { id: 'refine', label: 'Refine', icon: Wand2, description: 'Improve clarity and flow' },
  { id: 'extend', label: 'Extend', icon: Expand, description: 'Add more detail' },
  { id: 'shorten', label: 'Shorten', icon: Minimize2, description: 'Make more concise' },
  { id: 'simplify', label: 'Simplify', icon: BookOpen, description: 'Use simpler language' },
] as const;

type ActionId = typeof ACTIONS[number]['id'];

export function SelectionToolbar({ editor, projectId, documentId }: SelectionToolbarProps) {
  const selection = useEditorSelection(editor);
  const { currentOperation, startOperation, setOutput, setStatus, setError, acceptOperation, rejectOperation } = useAIStore();
  const { startStream, cancel, content, isStreaming, error } = useAIStream({
    onChunk: (chunk) => {
      useAIStore.getState().appendOutput(chunk);
    },
    onComplete: (fullContent) => {
      setStatus('preview');
    },
    onError: (err) => {
      setError(err);
    },
  });

  const toolbarRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLButtonElement[]>([]);
  const focusedIndex = useRef(0);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const buttons = buttonsRef.current.filter(Boolean);

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex.current = (focusedIndex.current + 1) % buttons.length;
        buttons[focusedIndex.current]?.focus();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex.current = (focusedIndex.current - 1 + buttons.length) % buttons.length;
        buttons[focusedIndex.current]?.focus();
        break;
      case 'Escape':
        e.preventDefault();
        if (isStreaming) {
          cancel();
        }
        rejectOperation();
        editor.commands.focus();
        break;
      case 'Tab':
        // Trap focus within toolbar
        if (!e.shiftKey && focusedIndex.current === buttons.length - 1) {
          e.preventDefault();
          focusedIndex.current = 0;
          buttons[0]?.focus();
        } else if (e.shiftKey && focusedIndex.current === 0) {
          e.preventDefault();
          focusedIndex.current = buttons.length - 1;
          buttons[buttons.length - 1]?.focus();
        }
        break;
    }
  }, [isStreaming, cancel, rejectOperation, editor]);

  // Focus first button when toolbar appears
  useEffect(() => {
    if (selection && !currentOperation) {
      focusedIndex.current = 0;
      buttonsRef.current[0]?.focus();
    }
  }, [selection, currentOperation]);

  const handleAction = async (action: ActionId) => {
    if (!selection) return;

    const snapshot = editor.getHTML();
    startOperation('selection', `${action}: ${selection.text.slice(0, 100)}`, snapshot);

    const prompt = buildSelectionPrompt(action, selection.text);
    await startStream(prompt, documentId, projectId);
  };

  const handleAccept = () => {
    if (!selection || !currentOperation) return;

    editor
      .chain()
      .focus()
      .setTextSelection({ from: selection.from, to: selection.to })
      .insertContent(currentOperation.output)
      .run();

    acceptOperation();
  };

  const handleReject = () => {
    cancel();
    rejectOperation();
    editor.commands.focus();
  };

  // Don't show if no selection or already in preview mode with accepted result
  if (!selection) return null;

  const isLoading = currentOperation?.status === 'loading' || isStreaming;
  const isPreview = currentOperation?.status === 'preview';
  const hasError = currentOperation?.status === 'error';

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting actions"
      aria-orientation="horizontal"
      aria-busy={isLoading}
      onKeyDown={handleKeyDown}
      className="fixed z-50 bg-white rounded-lg shadow-lg border p-1 flex items-center gap-1"
      style={{
        top: (selection.rect?.top ?? 0) - 48,
        left: selection.rect?.left ?? 0,
      }}
      data-testid="selection-toolbar"
    >
      {!isPreview && !hasError && (
        <>
          {ACTIONS.map((action, index) => (
            <button
              key={action.id}
              ref={(el) => { buttonsRef.current[index] = el!; }}
              onClick={() => handleAction(action.id)}
              disabled={isLoading}
              aria-label={`${action.label}: ${action.description}`}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
            >
              {isLoading && currentOperation?.input.startsWith(action.id) ? (
                <Loader2 className="w-4 h-4 animate-spin" data-testid="loading-spinner" />
              ) : (
                <action.icon className="w-4 h-4" />
              )}
              <span className="sr-only sm:not-sr-only">{action.label}</span>
            </button>
          ))}
          {isLoading && (
            <button
              onClick={handleReject}
              aria-label="Cancel generation"
              className="p-2 rounded hover:bg-red-100 text-red-600"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Cancel</span>
            </button>
          )}
        </>
      )}

      {isPreview && currentOperation && (
        <div className="flex items-center gap-2" role="group" aria-label="Accept or reject suggestion">
          <span className="text-sm text-gray-600 max-w-[200px] truncate">
            {currentOperation.output.slice(0, 50)}...
          </span>
          <button
            onClick={handleAccept}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
          >
            Reject
          </button>
        </div>
      )}

      {hasError && currentOperation?.error && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-2 text-red-600" data-testid="error-message">
          <span className="text-sm">{currentOperation.error.message}</span>
          {currentOperation.error.retryable && (
            <button
              onClick={() => handleAction('refine')}
              className="px-2 py-1 text-sm underline"
            >
              Retry
            </button>
          )}
          <button onClick={handleReject} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live region for screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading && 'Generating suggestion...'}
        {isPreview && 'Suggestion ready. Press Enter to accept or Escape to reject.'}
        {hasError && `Error: ${currentOperation?.error?.message}`}
      </div>
    </div>
  );
}

function buildSelectionPrompt(action: ActionId, text: string): string {
  const instructions: Record<ActionId, string> = {
    refine: 'Improve the clarity, flow, and academic tone of this text while preserving its meaning:',
    extend: 'Expand this text with more detail, examples, or explanation while maintaining academic tone:',
    shorten: 'Make this text more concise while preserving the key points and academic tone:',
    simplify: 'Rewrite this text using simpler, more accessible language while maintaining accuracy:',
  };

  return `${instructions[action]}\n\n"${text}"\n\nProvide only the revised text, no explanations.`;
}
```

---

### Step 4: Create Selection API Route

Create `src/app/api/ai/selection/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { invokeClaude } from '@/lib/ai/claude-cli';
import { buildContext, buildPromptWithContext } from '@/lib/ai/context-builder';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, selectedText, documentId, projectId } = await request.json();

  if (!action || !selectedText) {
    return NextResponse.json({ error: 'Action and selectedText required' }, { status: 400 });
  }

  // Build context
  const context = await buildContext(documentId, projectId, selectedText, {
    includeOperations: true,
  });

  const prompt = buildPromptWithContext(buildSelectionPrompt(action, selectedText), context, 'selection');

  const response = await invokeClaude({ prompt });

  if (response.error) {
    return NextResponse.json({ error: response.error }, { status: 500 });
  }

  return NextResponse.json({ content: response.content });
}

function buildSelectionPrompt(action: string, text: string): string {
  const instructions: Record<string, string> = {
    refine: 'Improve the clarity, flow, and academic tone of this text:',
    extend: 'Expand this text with more detail:',
    shorten: 'Make this text more concise:',
    simplify: 'Rewrite using simpler language:',
  };

  return `${instructions[action] || instructions.refine}\n\n"${text}"\n\nProvide only the revised text.`;
}
```

---

### Step 5: Create E2E Tests

Create `e2e/selection-toolbar.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Selection Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AI endpoint
    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Improved text with better clarity."}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.waitForSelector('[role="textbox"]');
  });

  test('should appear on text selection', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');

    // Type and select text
    await editor.click();
    await editor.pressSequentially('This is some text to select.');
    await editor.press('Control+a');

    const toolbar = page.locator('[data-testid="selection-toolbar"]');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator('button:has-text("Refine")')).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Select this text');
    await editor.press('Control+a');

    const toolbar = page.locator('[data-testid="selection-toolbar"]');
    await expect(toolbar).toBeVisible();

    // First button should be focused
    const refineBtn = toolbar.locator('button:has-text("Refine")');
    await expect(refineBtn).toBeFocused();

    // Arrow right should move to next button
    await page.keyboard.press('ArrowRight');
    const extendBtn = toolbar.locator('button:has-text("Extend")');
    await expect(extendBtn).toBeFocused();

    // Escape should close
    await page.keyboard.press('Escape');
    await expect(toolbar).not.toBeVisible();
  });

  test('should trigger AI action and show preview', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Text to improve');
    await editor.press('Control+a');

    const toolbar = page.locator('[data-testid="selection-toolbar"]');
    await toolbar.locator('button:has-text("Refine")').click();

    // Should show loading
    await expect(toolbar.locator('[data-testid="loading-spinner"]')).toBeVisible();

    // After streaming, should show accept/reject
    await expect(toolbar.locator('button:has-text("Accept")')).toBeVisible({ timeout: 5000 });
    await expect(toolbar.locator('button:has-text("Reject")')).toBeVisible();
  });

  test('should accept and replace text', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Original text');
    await editor.press('Control+a');

    const toolbar = page.locator('[data-testid="selection-toolbar"]');
    await toolbar.locator('button:has-text("Refine")').click();

    await toolbar.locator('button:has-text("Accept")').click({ timeout: 5000 });

    // Text should be replaced
    await expect(editor).toContainText('Improved text');
    await expect(toolbar).not.toBeVisible();
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Text');
    await editor.press('Control+a');

    const toolbar = page.locator('[data-testid="selection-toolbar"]');

    // Check toolbar role and label
    await expect(toolbar).toHaveAttribute('role', 'toolbar');
    await expect(toolbar).toHaveAttribute('aria-label', 'Text formatting actions');

    // Check button labels
    const refineBtn = toolbar.locator('button:has-text("Refine")');
    await expect(refineBtn).toHaveAttribute('aria-label', /Refine.*Improve clarity/);
  });
});
```

---

### Step 6: Commit

```bash
git add .
git commit -m "feat(editor): add selection toolbar with AI actions

- Zustand store for AI operation state management
- TipTap selection tracker extension
- SelectionToolbar with keyboard navigation
- Full ARIA accessibility (toolbar role, live regions)
- Accept/reject flow with preview
- E2E tests with Playwright"
```

---

## Task 3.5: Implement Cursor Generation (Cmd+K)

**Goal:** Create an inline prompt modal triggered by Cmd+K with streaming preview and accept/edit/regenerate actions.

### Files to Create/Modify

| File                                                    | Action | Purpose                 |
| ------------------------------------------------------- | ------ | ----------------------- |
| `src/components/editor/CursorPrompt.tsx`                | Create | Cmd+K prompt modal      |
| `src/components/editor/PreviewPanel.tsx`                | Create | Streaming preview panel |
| `src/components/editor/__tests__/CursorPrompt.test.tsx` | Create | Component tests         |
| `e2e/cursor-generation.spec.ts`                         | Create | E2E tests               |

---

### Step 1: Create Cursor Prompt Modal

Create `src/components/editor/CursorPrompt.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { X, Sparkles, Loader2, RotateCcw, Check, Edit3 } from 'lucide-react';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';

interface CursorPromptProps {
  editor: Editor;
  projectId: string;
  documentId: string;
}

const LENGTH_OPTIONS = [
  { value: 'sentence', label: 'Sentence' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'section', label: 'Section' },
] as const;

export function CursorPrompt({ editor, projectId, documentId }: CursorPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState<string>('paragraph');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const {
    currentOperation,
    startOperation,
    appendOutput,
    setStatus,
    setError,
    acceptOperation,
    rejectOperation,
  } = useAIStore();

  const { startStream, cancel, reset, isStreaming, content, error } = useAIStream({
    onChunk: (chunk) => appendOutput(chunk),
    onComplete: () => setStatus('preview'),
    onError: (err) => setError(err),
  });

  // Register Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isStreaming) cancel();
    rejectOperation();
    reset();
    setPrompt('');
    setIsOpen(false);
    editor.commands.focus();
  }, [isStreaming, cancel, rejectOperation, reset, editor]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    const cursorPos = editor.state.selection.from;
    const snapshot = editor.getHTML();

    startOperation('cursor', prompt, snapshot);

    const fullPrompt = buildCursorPrompt(prompt, length);
    await startStream(fullPrompt, documentId, projectId);
  };

  const handleRegenerate = async () => {
    reset();
    useAIStore.getState().setOutput('');
    useAIStore.getState().setStatus('loading');
    await handleGenerate();
  };

  const handleAccept = () => {
    if (!currentOperation) return;

    const cursorPos = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .setTextSelection(cursorPos)
      .insertContent(currentOperation.output)
      .run();

    acceptOperation();
    setPrompt('');
    setIsOpen(false);
  };

  const handleEdit = () => {
    // Switch to editable preview
    setStatus('idle');
    setPrompt(currentOperation?.output || '');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentOperation?.status === 'preview') {
        handleAccept();
      } else if (!isStreaming) {
        handleGenerate();
      }
    }
  };

  if (!isOpen) return null;

  const isLoading = currentOperation?.status === 'loading';
  const isPreview = currentOperation?.status === 'preview';
  const hasError = currentOperation?.status === 'error';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cursor-prompt-title"
        aria-describedby="cursor-prompt-description"
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
        data-testid="cursor-prompt-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="cursor-prompt-title" className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Generate Content
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p id="cursor-prompt-description" className="text-sm text-gray-600">
            Describe what you want to generate. It will be inserted at your cursor position.
          </p>

          {/* Input */}
          <div>
            <label htmlFor="prompt-input" className="sr-only">
              Prompt
            </label>
            <textarea
              ref={inputRef}
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="e.g., Write a transition paragraph connecting methodology to results..."
              rows={3}
              disabled={isLoading || isStreaming}
              className="w-full border rounded-lg p-3 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {/* Length selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="length-select" className="text-sm text-gray-600">
              Approximate length:
            </label>
            <select
              id="length-select"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              disabled={isLoading || isStreaming}
              aria-label="Select output length"
              className="border rounded px-2 py-1 text-sm"
            >
              {LENGTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {(isStreaming || isPreview) && currentOperation && (
            <div
              data-testid="preview-panel"
              aria-live="polite"
              className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto"
            >
              <p className="text-sm text-gray-500 mb-2">Preview:</p>
              <div className="prose prose-sm">
                {currentOperation.output || (
                  <span className="text-gray-400">Generating...</span>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {hasError && currentOperation?.error && (
            <div
              role="alert"
              aria-live="assertive"
              className="bg-red-50 text-red-700 rounded-lg p-3 text-sm"
              data-testid="error-message"
            >
              <p>{currentOperation.error.message}</p>
              {currentOperation.error.suggestion && (
                <p className="mt-1 text-red-600">{currentOperation.error.suggestion}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>

          {!isPreview && !hasError && (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading || isStreaming}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {(isLoading || isStreaming) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          )}

          {isPreview && (
            <>
              <button
                onClick={handleRegenerate}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
            </>
          )}

          {hasError && currentOperation?.error?.retryable && (
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Retry
            </button>
          )}
        </div>

        {/* Live region for screen readers */}
        <div role="status" aria-live="polite" className="sr-only">
          {isLoading && 'Generating content...'}
          {isStreaming && 'Receiving content...'}
          {isPreview && 'Content ready. Press Enter to accept, or use the action buttons.'}
        </div>
      </div>
    </div>
  );
}

function buildCursorPrompt(userPrompt: string, length: string): string {
  const lengthInstructions: Record<string, string> = {
    sentence: 'Write 1-2 sentences.',
    paragraph: 'Write a full paragraph (3-5 sentences).',
    section: 'Write a complete section with multiple paragraphs.',
  };

  return `${userPrompt}

${lengthInstructions[length] || lengthInstructions.paragraph}

Provide only the generated content, no explanations or preamble.`;
}
```

---

### Step 2: Create E2E Tests

Create `e2e/cursor-generation.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cursor Generation (Cmd+K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"This is AI "}\n\ndata: {"content":"generated content."}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.waitForSelector('[role="textbox"]');
  });

  test('should open modal on Cmd+K', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();

    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('textarea')).toBeFocused();
  });

  test('should close modal on Escape', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('should show streaming preview', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');
    await modal.locator('textarea').fill('Write a transition');
    await modal.locator('textarea').press('Enter');

    const preview = page.locator('[data-testid="preview-panel"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('AI generated');
  });

  test('should show Accept/Edit/Regenerate after generation', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');
    await modal.locator('textarea').fill('Generate something');
    await modal.locator('button:has-text("Generate")').click();

    await expect(modal.locator('button:has-text("Accept")')).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('button:has-text("Edit")')).toBeVisible();
    await expect(modal.locator('button:has-text("Regenerate")')).toBeVisible();
  });

  test('should insert content on Accept', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Before cursor.');

    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');
    await modal.locator('textarea').fill('Generate text');
    await modal.locator('button:has-text("Generate")').click();

    await modal.locator('button:has-text("Accept")').click({ timeout: 5000 });

    await expect(editor).toContainText('Before cursor.This is AI generated content.');
    await expect(modal).not.toBeVisible();
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');

    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby');
    await expect(modal).toHaveAttribute('aria-describedby');
  });

  test('should support keyboard-only operation', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.locator('[data-testid="cursor-prompt-modal"]');

    // Type prompt
    await page.keyboard.type('Write something');

    // Tab to Generate button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Activate with Enter
    await page.keyboard.press('Enter');

    // Wait for preview
    await expect(modal.locator('[data-testid="preview-panel"]')).toBeVisible({ timeout: 5000 });

    // Press Enter to accept (when in preview mode)
    // Focus should be on textarea, Enter accepts
    await page.locator('textarea').press('Enter');

    await expect(modal).not.toBeVisible();
  });
});
```

---

### Step 3: Update Editor to Include New Components

Modify the main editor component to include SelectionToolbar and CursorPrompt:

```typescript
// Add to src/components/editor/DocumentEditor.tsx or equivalent

import { SelectionTracker } from './extensions/selection-tracker';
import { SelectionToolbar } from './SelectionToolbar';
import { CursorPrompt } from './CursorPrompt';

// In editor setup, add the extension:
const editor = useEditor({
  extensions: [
    // ... other extensions
    SelectionTracker,
  ],
  // ...
});

// In the render:
return (
  <div className="relative">
    <EditorContent editor={editor} />
    {editor && (
      <>
        <SelectionToolbar
          editor={editor}
          projectId={projectId}
          documentId={documentId}
        />
        <CursorPrompt
          editor={editor}
          projectId={projectId}
          documentId={documentId}
        />
      </>
    )}
  </div>
);
```

---

### Step 4: Commit

```bash
git add .
git commit -m "feat(editor): add Cmd+K cursor generation with preview

- CursorPrompt modal with length selection
- Streaming preview panel with progressive rendering
- Accept/Edit/Regenerate workflow
- Full keyboard navigation and ARIA accessibility
- Focus trapping within modal
- E2E tests with Playwright"
```

---

## Phase 3 Complete Checklist

After completing all tasks, verify:

- [ ] `npm test` - All unit tests pass
- [ ] `npm run test:e2e` - All E2E tests pass
- [ ] `npm run lint` - No linting errors
- [ ] `npm run build` - Build succeeds

### Functional Verification

- [ ] Claude CLI wrapper handles all error scenarios
- [ ] Streaming responses appear progressively
- [ ] Selection toolbar appears on text selection
- [ ] Selection actions (Refine/Extend/Shorten/Simplify) work
- [ ] Cmd+K opens cursor generation modal
- [ ] Accept/Reject flows work correctly
- [ ] Keyboard navigation works throughout
- [ ] Screen reader announcements are correct
- [ ] Error states display with retry options

---

## Migration Notes for Direct Anthropic API

When ready to add direct API support:

1. Create `src/lib/ai/anthropic-provider.ts` implementing `AIProvider` interface
2. Add `ANTHROPIC_API_KEY` to environment variables
3. Create provider factory in `src/lib/ai/index.ts`:

```typescript
import { ClaudeCLIProvider } from './claude-cli';
import { AnthropicAPIProvider } from './anthropic-provider';

export function createAIProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicAPIProvider();
  }
  return new ClaudeCLIProvider();
}
```

This allows gradual migration without changing consumers.

---

## Dependencies Added

```json
{
  "dependencies": {
    "zustand": "^4.x"
  }
}
```

Install before starting:

```bash
npm install zustand
```
