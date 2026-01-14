# Task 3.3: Input Sanitization Module

> **Phase 3** | [← Error Categorization](./02-error-categorization.md) | [Next: Mock Factory →](./04-mock-factory.md)

---

## Context

**This task creates input sanitization functions to prevent CLI injection attacks.** This security-critical module ensures user input cannot escape the Claude CLI command boundaries.

### Prerequisites

- Pre-flight checklist completed

### What This Task Creates

- `src/lib/ai/sanitize.ts` - Sanitization functions
- `src/lib/ai/__tests__/sanitize.test.ts` - Sanitization tests

### Tasks That Depend on This

- **Task 3.5** (Claude CLI Wrapper) - uses `sanitizePrompt`, `sanitizeContext`
- **Task 3.7** (Streaming Module) - uses `sanitizePrompt`, `sanitizeContext`

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.1** (AI Type Definitions)
- **Task 3.2** (Error Categorization)
- **Task 3.4** (Mock Factory)

---

## Files to Create/Modify

- `src/lib/ai/sanitize.ts` (create)
- `src/lib/ai/__tests__/sanitize.test.ts` (create)

---

## Steps

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

```bash
npm test src/lib/ai/__tests__/sanitize.test.ts
```

**Expected:** FAIL with "Cannot find module '../sanitize'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/sanitize.ts
import { AI } from '@/lib/constants/ai';

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
  if (sanitized.length > AI.MAX_PROMPT_LENGTH) {
    throw new SanitizationError(`Prompt exceeds maximum length: ${sanitized.length} > ${AI.MAX_PROMPT_LENGTH}`);
  }

  return sanitized;
}

export function sanitizeContext(context: string): string {
  if (!context) return '';

  // Remove control characters
  let sanitized = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Length validation with truncation
  if (sanitized.length > AI.MAX_CONTEXT_SIZE) {
    sanitized = sanitized.slice(0, AI.MAX_CONTEXT_SIZE - 50) + '\n\n[Context truncated...]';
  }

  return sanitized;
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/sanitize.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/sanitize.ts src/lib/ai/__tests__/sanitize.test.ts
git commit -m "feat(ai): add input sanitization to prevent CLI injection"
```

---

## Verification Checklist

- [ ] `src/lib/ai/sanitize.ts` exists
- [ ] `src/lib/ai/__tests__/sanitize.test.ts` exists
- [ ] Tests pass: `npm test src/lib/ai/__tests__/sanitize.test.ts`
- [ ] CLI flag injection is prevented
- [ ] Length limits are enforced
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.4: Mock Factory](./04-mock-factory.md)**.
