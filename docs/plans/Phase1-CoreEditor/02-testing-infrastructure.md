# Task 1: Phase 1 Testing Extensions

> **Phase 1** | [← Supabase Setup](./01-supabase-setup.md) | [Next: TipTap Editor →](./03-tiptap-editor.md)

---

## Context

**This task extends the Phase 0 testing foundation with Phase 1-specific utilities.** Adds mocks, constants, and API utilities needed for editor and auth features.

> **Note:** This task follows the patterns from `docs/best-practices/testing-best-practices.md`. Vitest configuration, ESLint test rules, and browser API mocks were established in Phase 0. This task builds on that foundation.

### Prerequisites

- **Phase 0** completed (Vitest, test utilities, Supabase types available)

### What This Task Creates

- `src/lib/constants/auth.ts` - Auth-related constants
- `src/lib/constants/editor.ts` - Editor-related constants
- `src/lib/constants/index.ts` - Constants barrel export
- `src/lib/logger.ts` - Structured logger (pino)
- `src/test-utils/supabase-mock.ts` - Supabase client mock (for unit tests)
- `src/test-utils/tiptap-mock.ts` - TipTap editor mock
- `src/lib/api/types.ts` - API response types
- `src/lib/api/errors.ts` - Error classes
- `src/lib/api/format-errors.ts` - Zod error formatting utility
- `src/lib/api/index.ts` - API barrel export

### Relationship to Phase 0 Testing

| Phase 0 Provides                         | Phase 1 Adds                    |
| ---------------------------------------- | ------------------------------- |
| `vitest.config.ts`                       | (uses existing)                 |
| `vitest.setup.ts` with browser mocks     | (uses existing)                 |
| `src/test-utils/` with render, factories | Domain-specific mocks           |
| Real DB test client (`createTestClient`) | Mock client for unit tests      |
| Factory functions (`createTestProject`)  | Static fixtures for quick tests |

**When to use which:**

- **Phase 0 factories + real DB**: Integration tests that need actual database behavior
- **Phase 1 mocks**: Unit tests that should run fast without DB dependencies

### Tasks That Depend on This

- **Task 2** (TipTap Editor) - Uses TipTap mock
- **Task 4** (Auth) - Uses Supabase mock, auth constants
- **Task 6** (Projects CRUD) - Uses Supabase mock
- **Task 7** (Documents CRUD) - Uses editor constants

---

## Files to Create/Modify

- `src/lib/constants/auth.ts` (create)
- `src/lib/constants/editor.ts` (create)
- `src/lib/constants/index.ts` (create)
- `src/lib/logger.ts` (create)
- `src/test-utils/supabase-mock.ts` (create)
- `src/test-utils/tiptap-mock.ts` (create)
- `src/lib/api/types.ts` (create)
- `src/lib/api/errors.ts` (create)
- `src/lib/api/format-errors.ts` (create)
- `src/lib/api/handle-error.ts` (create)
- `src/lib/api/index.ts` (create)
- `src/test-utils/index.ts` (modify - add new exports)

---

## Steps

### Step 1.1: Install additional dependencies

```bash
pnpm add pino pino-pretty zod
pnpm add -D @types/pino
```

**Expected:** Logger and validation packages added

### Step 1.2: Create auth constants

Create `src/lib/constants/auth.ts`:

```typescript
/**
 * Authentication-related constants.
 * Centralizes magic values for auth operations.
 */
export const AUTH = {
  /** Maximum login attempts before rate limiting */
  MAX_LOGIN_ATTEMPTS: 5,
  /** Rate limit window in minutes */
  RATE_LIMIT_WINDOW_MINUTES: 60,
  /** Magic link expiry in minutes */
  MAGIC_LINK_EXPIRY_MINUTES: 60,
  /** Session duration in days */
  SESSION_DURATION_DAYS: 7,
  /** Maximum session age in days */
  SESSION_MAX_AGE_DAYS: 30,
} as const;
```

### Step 1.3: Create editor constants

Create `src/lib/constants/editor.ts`:

```typescript
/**
 * Editor-related constants.
 * Centralizes magic values for editor operations.
 */
export const EDITOR = {
  /** Autosave debounce delay in milliseconds */
  AUTOSAVE_DEBOUNCE_MS: 1000,
  /** Maximum retry attempts for failed saves */
  MAX_RETRIES: 3,
  /** Default word count warning threshold (percentage) */
  DEFAULT_WORD_WARNING_THRESHOLD: 90,
  /** Minimum editor height in pixels */
  MIN_HEIGHT_PX: 200,
} as const;
```

### Step 1.4: Create constants barrel export

Create `src/lib/constants/index.ts`:

```typescript
export { AUTH } from './auth';
export { EDITOR } from './editor';
```

### Step 1.5: Create structured logger

Create `src/lib/logger.ts`:

```typescript
import pino from 'pino';

/**
 * Structured logger for application-wide logging.
 * Use instead of console.log/error for production code.
 *
 * @example
 * logger.info({ userId, action: 'login' }, 'User logged in');
 * logger.error({ error, requestId }, 'Failed to process request');
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Pretty print in development
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});

/**
 * Create a child logger with bound context.
 * Useful for request-scoped logging.
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

### Step 1.6: Create API types

Create `src/lib/api/types.ts`:

```typescript
export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string; details?: unknown };

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalCount?: number;
}
```

### Step 1.7: Create API error classes

Create `src/lib/api/errors.ts`:

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### Step 1.8: Create Zod error formatting utility

Create `src/lib/api/format-errors.ts`:

```typescript
import { ZodError } from 'zod';

/**
 * Format Zod validation errors into a user-friendly string.
 * Groups errors by field path.
 *
 * @example
 * formatZodError(error) // "email: Invalid email, password: Too short"
 */
export function formatZodError(error: ZodError): string {
  return error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
}

/**
 * Extract field-level errors from a Zod error.
 * Useful for displaying errors next to form fields.
 *
 * @example
 * getFieldErrors(error) // { email: "Invalid email", password: "Too short" }
 */
export function getFieldErrors(error: ZodError): Record<string, string> {
  const flattened = error.flatten();
  const result: Record<string, string> = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length > 0) {
      result[field] = messages[0];
    }
  }

  return result;
}
```

### Step 1.9: Create API error handler utility

Create `src/lib/api/handle-error.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ApiError } from './errors';
import type { Logger } from 'pino';

/**
 * Centralized error handler for API routes.
 * Reduces code duplication and ensures consistent error responses.
 *
 * @example
 * export async function GET(request: Request) {
 *   try {
 *     // ... route logic
 *   } catch (error) {
 *     return handleApiError(error, logger, 'Failed to get items');
 *   }
 * }
 */
export function handleApiError(error: unknown, logger: Logger, context: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  logger.error({ error }, context);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### Step 1.10: Create API barrel export

Create `src/lib/api/index.ts`:

```typescript
export { ApiError, ErrorCodes } from './errors';
export { formatZodError, getFieldErrors } from './format-errors';
export { handleApiError } from './handle-error';
export type { ApiResponse, PaginatedResponse } from './types';
```

### Step 1.11: Create Supabase mock for unit tests

Create `src/test-utils/supabase-mock.ts`:

```typescript
import { vi } from 'vitest';

export interface MockSupabaseOptions {
  authenticated?: boolean;
  userId?: string;
  userEmail?: string;
}

/**
 * Create a mock Supabase client for unit tests.
 * Use this when you want fast tests without database dependencies.
 *
 * For integration tests that need real database behavior,
 * use createTestClient from '@/lib/supabase/test-utils' instead.
 */
export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const { authenticated = true, userId = 'user-test-123', userEmail = 'test@example.com' } = options;

  const createQueryBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Helper methods for test setup
    mockResolve(data: unknown) {
      this.single.mockResolvedValue({ data, error: null });
      this.maybeSingle.mockResolvedValue({ data, error: null });
      return this;
    },
    mockReject(message: string, code = 'ERROR') {
      const error = { message, code };
      this.single.mockResolvedValue({ data: null, error });
      this.maybeSingle.mockResolvedValue({ data: null, error });
      return this;
    },
    mockResolveMany(data: unknown[]) {
      // For queries that return arrays (no .single())
      return { data, error: null };
    },
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: userId, email: userEmail } : null },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: authenticated ? { user: { id: userId, email: userEmail }, access_token: 'test-token' } : null,
        },
        error: null,
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(() => createQueryBuilder()),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

export function createUnauthenticatedMock() {
  return createMockSupabaseClient({ authenticated: false });
}
```

### Step 1.12: Create TipTap mock

Create `src/test-utils/tiptap-mock.ts`:

```typescript
import { vi } from 'vitest';

/**
 * Create a mock TipTap editor for unit tests.
 * Provides all common editor methods as vi.fn() mocks.
 */
export function createMockEditor() {
  const chainMethods = {
    focus: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleUnderline: vi.fn().mockReturnThis(),
    toggleStrike: vi.fn().mockReturnThis(),
    toggleHeading: vi.fn().mockReturnThis(),
    toggleBulletList: vi.fn().mockReturnThis(),
    toggleOrderedList: vi.fn().mockReturnThis(),
    toggleBlockquote: vi.fn().mockReturnThis(),
    toggleCodeBlock: vi.fn().mockReturnThis(),
    setTextAlign: vi.fn().mockReturnThis(),
    toggleHighlight: vi.fn().mockReturnThis(),
    setContent: vi.fn().mockReturnThis(),
    insertContent: vi.fn().mockReturnThis(),
    undo: vi.fn().mockReturnThis(),
    redo: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue(true),
  };

  return {
    chain: vi.fn(() => chainMethods),
    can: vi.fn(() => ({
      chain: vi.fn(() => ({
        ...chainMethods,
        run: vi.fn().mockReturnValue(true),
      })),
    })),
    isActive: vi.fn().mockReturnValue(false),
    isFocused: vi.fn().mockReturnValue(false),
    isEditable: vi.fn().mockReturnValue(true),
    isEmpty: vi.fn().mockReturnValue(false),
    getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
    getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
    getText: vi.fn().mockReturnValue('Test content'),
    setEditable: vi.fn(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    commands: chainMethods,
    state: {
      doc: {
        content: {
          size: 10,
          content: [{ type: { name: 'paragraph' }, content: { size: 10 } }],
        },
        textContent: 'Test content',
      },
      selection: {
        from: 0,
        to: 0,
        empty: true,
      },
    },
    storage: {
      characterCount: {
        words: vi.fn().mockReturnValue(2),
        characters: vi.fn().mockReturnValue(12),
      },
    },
    // Helper to update mock return values
    _setContent(html: string, text: string, json: object) {
      this.getHTML.mockReturnValue(html);
      this.getText.mockReturnValue(text);
      this.getJSON.mockReturnValue(json);
    },
    _setActive(type: string, isActive: boolean) {
      this.isActive.mockImplementation((t: string) => (t === type ? isActive : false));
    },
  };
}
```

### Step 1.13: Update test-utils barrel export

Update `src/test-utils/index.ts` to include new exports:

```typescript
export * from './render';
export * from './next-mocks';
export * from './factories';

// Phase 1 testing utilities
export { createMockSupabaseClient, createUnauthenticatedMock, type MockSupabaseOptions } from './supabase-mock';
export { createMockEditor } from './tiptap-mock';
```

### Step 1.14: Verify setup

```bash
# Verify pino works
pnpm exec tsc --noEmit src/lib/logger.ts

# Run existing tests to ensure nothing broke
pnpm test
```

**Expected:** TypeScript compiles, all existing tests pass

### Step 1.15: Commit

```bash
git add src/lib/constants src/lib/logger.ts src/lib/api src/test-utils
git commit -m "feat: add Phase 1 testing extensions (constants, logger, mocks, API utils)"
```

---

## Verification Checklist

- [ ] Dependencies installed (pino, pino-pretty, zod)
- [ ] Auth constants created (`src/lib/constants/auth.ts`)
- [ ] Editor constants created (`src/lib/constants/editor.ts`)
- [ ] Constants barrel export created
- [ ] Structured logger created (`src/lib/logger.ts`)
- [ ] API types file created
- [ ] API errors file created
- [ ] Zod error formatting utility created (`src/lib/api/format-errors.ts`)
- [ ] API error handler utility created (`src/lib/api/handle-error.ts`)
- [ ] API barrel export created (`src/lib/api/index.ts`)
- [ ] Supabase mock created (`src/test-utils/supabase-mock.ts`)
- [ ] TipTap mock created (`src/test-utils/tiptap-mock.ts`)
- [ ] test-utils barrel export updated
- [ ] Existing tests still pass
- [ ] Changes committed

---

## Usage Examples

### Using Supabase Mock (Unit Tests)

```typescript
import { createMockSupabaseClient } from '@/test-utils';

describe('ProjectService', () => {
  it('should fetch user projects', async () => {
    const mockClient = createMockSupabaseClient({ userId: 'user-123' });
    const queryBuilder = mockClient.from('projects');

    // Setup mock response
    queryBuilder.mockResolve([
      { id: 'proj-1', title: 'Project 1' },
      { id: 'proj-2', title: 'Project 2' },
    ]);

    // Test your service...
  });
});
```

### Using Real DB (Integration Tests)

```typescript
import { createTestClient, TestData } from '@/lib/supabase/test-utils';

describe('ProjectService Integration', () => {
  const testData = new TestData();

  afterAll(() => testData.cleanup());

  it('should persist project to database', async () => {
    const project = await testData.createProject(userId);
    // Project exists in real DB, will be cleaned up automatically
  });
});
```

### Using TipTap Mock

```typescript
import { createMockEditor } from '@/test-utils';

describe('EditorToolbar', () => {
  it('should toggle bold on click', () => {
    const editor = createMockEditor();

    // Simulate toolbar click
    editor.chain().toggleBold().run();

    expect(editor.chain().toggleBold).toHaveBeenCalled();
  });
});
```

---

## Next Steps

After this task, proceed to **[Task 2: TipTap Editor Setup](./03-tiptap-editor.md)**.
