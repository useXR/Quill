# Task 3.1: AI Type Definitions

> **Phase 3** | [← Overview](./00-overview.md) | [Next: Error Categorization →](./02-error-categorization.md)

---

## Context

**This task creates the core TypeScript type definitions for Claude CLI integration.** These types provide the foundation for all AI-related code, ensuring type safety across the entire AI subsystem.

### Prerequisites

- Pre-flight checklist completed (Claude CLI installed, Zustand available)

### What This Task Creates

- `src/lib/ai/types.ts` - Core type definitions
- `src/lib/ai/__tests__/types.test.ts` - Type validation tests

### Tasks That Depend on This

- **Task 3.5** (Claude CLI Wrapper) - uses `ClaudeRequest`, `ClaudeResponse`, `ClaudeError`
- **Task 3.7** (Streaming Module) - uses `ClaudeError`
- **Task 3.8** (AI State Store) - uses `ClaudeError`
- **Task 3.9** (useAIStream Hook) - uses `ClaudeError`
- **Task 3.11** (Context Builder) - uses operation types

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.2** (Error Categorization)
- **Task 3.3** (Input Sanitization)
- **Task 3.4** (Mock Factory)

---

## Files to Create/Modify

- `src/lib/ai/types.ts` (create)
- `src/lib/ai/__tests__/types.test.ts` (create)

---

## Steps

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

```bash
npm test src/lib/ai/__tests__/types.test.ts
```

**Expected:** FAIL with "Cannot find module '../types'"

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

```bash
npm test src/lib/ai/__tests__/types.test.ts
```

**Expected:** PASS

### Step 5: Create AI constants file

Per best practices, create constants file to avoid magic values.

> **Design System Note:** These constants work alongside the [Quill Design System](../../design-system.md). UI components consuming these types should use design tokens like `text-error` for error states, `text-quill` for loading spinners, and `font-ui` for status messages.

```typescript
// src/lib/constants/ai.ts
export const AI = {
  // Timeouts
  DEFAULT_TIMEOUT_MS: 120000,
  HEARTBEAT_INTERVAL_MS: 5000,
  CLI_AUTH_TEST_TIMEOUT_MS: 10000,

  // Limits
  MAX_PROMPT_LENGTH: 50000,
  MAX_CONTEXT_SIZE: 100000,
  MAX_CONTEXT_TOKENS: 8000,

  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,

  // History
  MAX_OPERATION_HISTORY: 50,

  // CLI
  MINIMUM_CLI_VERSION: '1.0.0',

  // Rate limiting (per Phase 1 infrastructure patterns)
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 10,
    MAX_REQUESTS_PER_HOUR: 100,
    WINDOW_MS: 60000, // 1 minute window
  },
} as const;
```

### Step 6: Commit

```bash
git add src/lib/ai/types.ts src/lib/ai/__tests__/types.test.ts src/lib/constants/ai.ts
git commit -m "feat(ai): add type definitions and constants for Claude CLI integration"
```

---

## Verification Checklist

- [ ] `src/lib/ai/types.ts` exists
- [ ] `src/lib/ai/__tests__/types.test.ts` exists
- [ ] `src/lib/constants/ai.ts` exists
- [ ] Tests pass: `npm test src/lib/ai/__tests__/types.test.ts`
- [ ] All types export correctly
- [ ] Constants are not hardcoded
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.2: Error Categorization](./02-error-categorization.md)**.
