# Task 3.7: Streaming Module

> **Phase 3** | [← CLI Validation](./06-cli-validation.md) | [Next: AI State Store →](./08-ai-state-store.md)

---

## Context

**This task creates the streaming module for real-time AI response delivery.** This enables progressive text display during generation, improving perceived performance and user experience.

### Prerequisites

- **Task 3.1** completed (AI Type Definitions) - provides `ClaudeError` type
- **Task 3.3** completed (Input Sanitization) - provides sanitization functions

### What This Task Creates

- `src/lib/ai/streaming.ts` - Streaming class and convenience function
- `src/lib/ai/__tests__/streaming.test.ts` - Streaming tests

### Tasks That Depend on This

- **Task 3.10** (SSE API Route) - uses `ClaudeStream` class

### Design System: Streaming UI Patterns

When displaying streaming content in the UI, follow the [Quill Design System](../../design-system.md) "Scholarly Craft" aesthetic:

**Streaming Preview Container:**

```tsx
<div
  className="
  p-4
  bg-surface-muted
  border border-ink-faint rounded-lg
  font-prose text-base text-ink-primary
  leading-relaxed
  max-h-48 overflow-y-auto
"
>
  {streamingContent}
  {isStreaming && <span className="inline-block w-0.5 h-4 bg-quill animate-pulse ml-0.5" />}
</div>
```

**Streaming Progress Indicator:**

- Use `text-quill` for the animated cursor/caret
- No flashy animations - just a subtle pulsing cursor (`animate-pulse`)
- Content appears naturally without letter-by-letter animation (per "unhurried" motion philosophy)

**Streaming Status Bar:**

```tsx
<div className="flex items-center gap-2 py-2 text-xs font-ui text-ink-tertiary">
  <Loader2 className="w-3 h-3 text-quill animate-spin" />
  <span>Generating response...</span>
</div>
```

**Heartbeat Visual (connection keepalive):**

- No visual indicator needed - heartbeats are internal
- Only show loading state while actively streaming

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.8** (AI State Store)
- **Task 3.9** (useAIStream Hook)
- **Task 3.11** (Context Builder)

---

## Files to Create/Modify

- `src/lib/ai/streaming.ts` (create)
- `src/lib/ai/__tests__/streaming.test.ts` (create)

---

## Steps

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

```bash
npm test src/lib/ai/__tests__/streaming.test.ts
```

**Expected:** FAIL with "Cannot find module '../streaming'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/streaming.ts
import { spawn, ChildProcess } from 'child_process';
import { sanitizePrompt, sanitizeContext } from './sanitize';
import { categorizeError } from './errors';
import { aiLogger } from './claude-cli';
import { AI } from '@/lib/constants/ai';
import type { ClaudeError } from './types';

const log = aiLogger({});

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
    const { context, timeout = AI.DEFAULT_TIMEOUT_MS } = options;

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
      }, AI.HEARTBEAT_INTERVAL_MS);

      this.process.stdout?.on('data', (data) => {
        if (this.cancelled) return;
        this.processData(data.toString(), callbacks);
      });

      this.process.stderr?.on('data', (data) => {
        log.warn({ stderr: data.toString() }, 'Claude CLI stderr output');
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
  timeout = AI.DEFAULT_TIMEOUT_MS
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

```bash
npm test src/lib/ai/__tests__/streaming.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/streaming.ts src/lib/ai/__tests__/streaming.test.ts
git commit -m "feat(ai): add streaming module with cancellation support"
```

---

## Verification Checklist

- [ ] `src/lib/ai/streaming.ts` exists
- [ ] `src/lib/ai/__tests__/streaming.test.ts` exists
- [ ] Tests pass: `npm test src/lib/ai/__tests__/streaming.test.ts`
- [ ] `ClaudeStream` class is exported
- [ ] `streamClaude` convenience function is exported
- [ ] Cancellation works correctly
- [ ] Heartbeat keeps connection alive
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.8: AI State Store](./08-ai-state-store.md)**.
