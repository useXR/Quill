# Task 3.4: Mock Factory for CLI Tests

> **Phase 3** | [← Input Sanitization](./03-input-sanitization.md) | [Next: Claude CLI Wrapper →](./05-claude-cli-wrapper.md)

---

## Context

**This task creates a mock factory for simulating Claude CLI process behavior in tests.** This test infrastructure enables comprehensive unit testing of the CLI wrapper without requiring actual CLI calls.

### Prerequisites

- Pre-flight checklist completed

### What This Task Creates

- `src/lib/ai/__tests__/mocks/mock-claude-cli.ts` - Mock factory for CLI process testing
- Updates to `src/test-utils/factories.ts` - AI operation factories (per Phase 0-2 patterns)

### Tasks That Depend on This

- **Task 3.5** (Claude CLI Wrapper) - uses mock factory for testing
- **Task 3.7** (Streaming Module) - uses mock factory for testing
- **Task 3.8** (AI State Store) - uses AI operation factories
- **Task 3.13** (Selection Toolbar) - uses AI operation factories

### Design System Testing Notes

When testing UI components that use these mocks, verify design system compliance:

| Mock Scenario | Expected UI State                 | Design Tokens to Verify                                     |
| ------------- | --------------------------------- | ----------------------------------------------------------- |
| `'loading'`   | Spinner visible, buttons disabled | `text-quill animate-spin`, `opacity-50`                     |
| `'streaming'` | Live preview with content         | `font-prose text-base`, live region                         |
| `'error'`     | Error alert displayed             | `bg-error-light text-error-dark`                            |
| `'preview'`   | Accept/Reject buttons             | `bg-quill text-white` (Accept), `bg-surface-hover` (Reject) |

Test that all states render with proper [Quill Design System](../../design-system.md) tokens.

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.1** (AI Type Definitions)
- **Task 3.2** (Error Categorization)
- **Task 3.3** (Input Sanitization)

---

## Files to Create/Modify

- `src/lib/ai/__tests__/mocks/mock-claude-cli.ts` (create)
- `src/test-utils/factories.ts` (modify - add AI factories per Phase 0-2 patterns)

---

## Steps

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

### Step 2: Add AI factories to test-utils (per Phase 0-2 patterns)

Per best practices, extend the existing factories file with AI operation factories:

```typescript
// src/test-utils/factories.ts - ADD these exports

import type { AIOperation, AIOperationType, AIOperationStatus } from '@/lib/stores/ai-store';
import type { StreamChunk } from '@/lib/ai/streaming';
import type { ClaudeError, ClaudeErrorCode } from '@/lib/ai/types';

// AI Operation factory
export function createMockAIOperation(overrides: Partial<AIOperation> = {}): AIOperation {
  return {
    id: crypto.randomUUID(),
    type: 'selection' as AIOperationType,
    status: 'idle' as AIOperationStatus,
    input: 'Test input prompt',
    output: 'Generated output text',
    documentSnapshot: '<p>Original document content</p>',
    createdAt: new Date(),
    ...overrides,
  };
}

// Stream chunk factory
export function createMockStreamChunk(overrides: Partial<StreamChunk> = {}): StreamChunk {
  return {
    id: `chunk-${Date.now()}`,
    sequence: 0,
    content: 'Streamed content',
    done: false,
    ...overrides,
  };
}

// Claude error factory
export function createMockClaudeError(overrides: Partial<ClaudeError> = {}): ClaudeError {
  return {
    code: 'UNKNOWN' as ClaudeErrorCode,
    message: 'An error occurred',
    retryable: false,
    ...overrides,
  };
}

// Collection of mock stream chunks for testing streaming behavior
export const mockStreamChunks: StreamChunk[] = [
  createMockStreamChunk({ id: 'chunk-0', sequence: 0, content: 'First ' }),
  createMockStreamChunk({ id: 'chunk-1', sequence: 1, content: 'second ' }),
  createMockStreamChunk({ id: 'chunk-2', sequence: 2, content: 'third.', done: true }),
];

// Collection of mock AI operations for list testing
export const mockAIOperations: AIOperation[] = [
  createMockAIOperation({ id: 'op-1', type: 'selection', status: 'idle' }),
  createMockAIOperation({ id: 'op-2', type: 'cursor', status: 'idle' }),
  createMockAIOperation({ id: 'op-3', type: 'global', status: 'idle' }),
];
```

### Step 3: Commit

```bash
git add src/lib/ai/__tests__/mocks/mock-claude-cli.ts src/test-utils/factories.ts
git commit -m "test(ai): add mock factory for Claude CLI and AI operation factories"
```

---

## Verification Checklist

- [ ] `src/lib/ai/__tests__/mocks/mock-claude-cli.ts` exists
- [ ] Mock covers all scenarios: success, timeout, auth_error, malformed_json, rate_limit, empty_response, partial_then_error, slow_stream, cli_not_found, context_too_long, process_crash, interleaved_output
- [ ] `createMockClaudeProcess` function is exported
- [ ] `setupMockClaude` helper function is exported
- [ ] `src/test-utils/factories.ts` updated with AI factories:
  - [ ] `createMockAIOperation` exported
  - [ ] `createMockStreamChunk` exported
  - [ ] `createMockClaudeError` exported
  - [ ] `mockStreamChunks` collection exported
  - [ ] `mockAIOperations` collection exported
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.5: Claude CLI Wrapper](./05-claude-cli-wrapper.md)**.
