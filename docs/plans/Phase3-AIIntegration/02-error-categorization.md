# Task 3.2: Error Categorization Module

> **Phase 3** | [← AI Type Definitions](./01-ai-type-definitions.md) | [Next: Input Sanitization →](./03-input-sanitization.md)

---

## Context

**This task creates the error categorization module that classifies CLI errors into actionable error codes.** This enables intelligent retry logic and user-friendly error messages throughout the AI system.

### Prerequisites

- **Task 3.1** completed (AI Type Definitions) - provides `ClaudeError`, `ClaudeErrorCode` types

### What This Task Creates

- `src/lib/ai/errors.ts` - Error categorization functions
- `src/lib/ai/__tests__/errors.test.ts` - Error categorization tests

### Tasks That Depend on This

- **Task 3.5** (Claude CLI Wrapper) - uses `categorizeError`, `isRetryableError`
- **Task 3.7** (Streaming Module) - uses `categorizeError`

### Design System: Error Display Patterns

When rendering errors from this module in the UI, use the [Quill Design System](../../design-system.md) semantic error tokens:

| Error Type               | Display Pattern                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **Retryable errors**     | Warning alert: `bg-warning-light border-warning/20 text-warning-dark` with retry button |
| **Non-retryable errors** | Error alert: `bg-error-light border-error/20 text-error-dark`                           |
| **Suggestion text**      | `font-ui text-sm text-ink-secondary` below error message                                |
| **Error icons**          | Lucide `AlertTriangle` (warning) or `AlertCircle` (error) with `w-5 h-5`                |

Example error alert markup:

```tsx
<div role="alert" className="flex items-start gap-3 p-4 bg-error-light border border-error/20 rounded-lg">
  <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
  <div>
    <p className="text-sm font-ui text-error-dark">{error.message}</p>
    {error.suggestion && <p className="text-sm font-ui text-ink-secondary mt-1">{error.suggestion}</p>}
  </div>
</div>
```

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.3** (Input Sanitization)
- **Task 3.4** (Mock Factory)

---

## Files to Create/Modify

- `src/lib/ai/errors.ts` (create)
- `src/lib/ai/__tests__/errors.test.ts` (create)

---

## Steps

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

```bash
npm test src/lib/ai/__tests__/errors.test.ts
```

**Expected:** FAIL with "Cannot find module '../errors'"

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

export function isRetryableError(error: ClaudeError): boolean {
  return error.retryable;
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/errors.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/errors.ts src/lib/ai/__tests__/errors.test.ts
git commit -m "feat(ai): add error categorization with retry detection"
```

---

## Verification Checklist

- [ ] `src/lib/ai/errors.ts` exists
- [ ] `src/lib/ai/__tests__/errors.test.ts` exists
- [ ] Tests pass: `npm test src/lib/ai/__tests__/errors.test.ts`
- [ ] Error patterns cover: AUTH_FAILURE, RATE_LIMITED, TIMEOUT, CLI_NOT_FOUND, CONTEXT_TOO_LONG
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.3: Input Sanitization](./03-input-sanitization.md)**.
