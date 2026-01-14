# Task 3.5: Claude CLI Wrapper - Core Invocation

> **Phase 3** | [← Mock Factory](./04-mock-factory.md) | [Next: CLI Validation →](./06-cli-validation.md)

---

## Context

**This task creates the core Claude CLI wrapper with process management and retry logic.** This is the central module that spawns CLI subprocesses and handles their output, forming the backbone of the AI integration.

### Prerequisites

- **Task 3.1** completed (AI Type Definitions) - provides types
- **Task 3.2** completed (Error Categorization) - provides `categorizeError`, `isRetryableError`
- **Task 3.3** completed (Input Sanitization) - provides `sanitizePrompt`, `sanitizeContext`
- **Task 3.4** completed (Mock Factory) - provides test infrastructure

### What This Task Creates

- `src/lib/ai/claude-cli.ts` - CLI wrapper with process manager
- `src/lib/ai/__tests__/claude-cli.test.ts` - CLI wrapper tests

### Tasks That Depend on This

- **Task 3.6** (CLI Validation) - extends this module
- **Task 3.7** (Streaming Module) - uses similar patterns

---

## Files to Create/Modify

- `src/lib/ai/claude-cli.ts` (create)
- `src/lib/ai/__tests__/claude-cli.test.ts` (create)

---

## Steps

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

```bash
npm test src/lib/ai/__tests__/claude-cli.test.ts
```

**Expected:** FAIL (module not found or export missing)

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/claude-cli.ts
import { spawn, ChildProcess } from 'child_process';
import type { ClaudeRequest, ClaudeResponse } from './types';
import { categorizeError, isRetryableError } from './errors';
import { sanitizePrompt, sanitizeContext } from './sanitize';
import { AI } from '@/lib/constants/ai';
import { logger } from '@/lib/logger';

// Create domain-specific child logger per Phase 2 pattern
export function aiLogger(context: { userId?: string; operationId?: string }) {
  return logger.child({ domain: 'ai', ...context });
}

const log = aiLogger({});

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

    if (response.error && isRetryableError(response.error) && attempt < AI.MAX_RETRIES) {
      const delay = response.error.retryAfterMs || AI.RETRY_DELAY_MS * Math.pow(2, attempt);
      log.info({ attempt, delay, errorCode: response.error.code }, 'Retrying after error');
      await new Promise((r) => setTimeout(r, delay));
      return this.executeWithRetry(request, attempt + 1);
    }

    return response;
  }

  private execute(request: ClaudeRequest): Promise<ClaudeResponse> {
    const { prompt, context, timeout = AI.DEFAULT_TIMEOUT_MS } = request;

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
            log.warn({ code, errorCode: error.code }, 'CLI process exited with error');
            resolve({
              content: error.partialContent || '',
              partial: !!error.partialContent,
              error,
            });
          } else {
            log.info({ contentLength: content.length }, 'CLI process completed successfully');
            resolve({ content });
          }
        });

        this.activeProcess.on('error', (err) => {
          log.error({ error: err }, 'CLI process error');
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

```bash
npm test src/lib/ai/__tests__/claude-cli.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/claude-cli.ts src/lib/ai/__tests__/claude-cli.test.ts
git commit -m "feat(ai): add Claude CLI wrapper with process manager"
```

---

## Verification Checklist

- [ ] `src/lib/ai/claude-cli.ts` exists
- [ ] `src/lib/ai/__tests__/claude-cli.test.ts` exists
- [ ] Tests pass: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
- [ ] `invokeClaude` and `cancelClaude` are exported
- [ ] Process manager handles queuing
- [ ] Retry logic works for retryable errors
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.6: CLI Validation](./06-cli-validation.md)**.
