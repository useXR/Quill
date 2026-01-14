# Task 3.10: SSE API Route

> **Phase 3** | [← useAIStream Hook](./09-use-ai-stream-hook.md) | [Next: Context Builder →](./11-context-builder.md)

---

## Context

**This task creates the SSE streaming API endpoint that bridges the client and Claude CLI.** This server-side route handles authentication, spawns streaming operations, and delivers chunks via Server-Sent Events.

### Prerequisites

- **Task 3.7** completed (Streaming Module) - provides `ClaudeStream`
- **Task 3.8** completed (AI State Store) - provides state types

### What This Task Creates

- `src/lib/ai/index.ts` - Provider factory and re-exports
- `src/app/api/ai/generate/route.ts` - SSE streaming endpoint
- `src/app/api/ai/generate/__tests__/route.test.ts` - Route tests

### Tasks That Depend on This

- **Task 3.13** (Selection Toolbar) - calls this endpoint
- **Task 3.14** (E2E Tests) - mocks this endpoint

### Design System: API Error Responses

API error responses should provide enough context for UI components to display errors according to the [Quill Design System](../../design-system.md):

| HTTP Status | Error Code         | UI Display                                                         |
| ----------- | ------------------ | ------------------------------------------------------------------ |
| `401`       | `AUTH_REQUIRED`    | Redirect to login or show info alert with `bg-info-light`          |
| `400`       | `VALIDATION_ERROR` | Inline error with `text-error` styling                             |
| `429`       | `RATE_LIMITED`     | Warning alert with `bg-warning-light`, show `retryAfter` countdown |
| `500`       | `SERVER_ERROR`     | Error alert with `bg-error-light`, offer retry                     |

**Rate limit UI pattern:**

```tsx
{
  error.code === 'RATE_LIMITED' && (
    <div role="alert" className="flex items-start gap-3 p-4 bg-warning-light border border-warning/20 rounded-lg">
      <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-ui text-sm font-medium text-warning-dark">Rate limit reached</p>
        <p className="font-ui text-sm text-ink-secondary mt-1">
          Please wait {Math.ceil(error.retryAfter / 1000)} seconds before trying again.
        </p>
      </div>
    </div>
  );
}
```

---

## Files to Create/Modify

- `src/lib/ai/index.ts` (create)
- `src/app/api/ai/generate/route.ts` (create)
- `src/app/api/ai/generate/__tests__/route.test.ts` (create)

---

## Steps

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

**Note:** Per Phase 1-2 best practices, use established mock utilities from `@/test-utils` instead of inline mocks.

```typescript
// src/app/api/ai/generate/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient, createUnauthenticatedMock } from '@/test-utils/supabase-mock';
import { createMockStreamChunk } from '@/test-utils/factories';

// Use established Supabase mock pattern from Phase 1
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  ClaudeStream: vi.fn().mockImplementation(() => ({
    stream: vi.fn().mockImplementation((prompt, callbacks) => {
      callbacks.onChunk(createMockStreamChunk({ content: 'Test' }));
      callbacks.onComplete();
    }),
    cancel: vi.fn(),
  })),
}));

vi.mock('@/lib/api/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Domain logger mocking pattern from Phase 2 best practices
vi.mock('@/lib/ai/claude-cli', () => ({
  aiLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

// Rate limiting mock (per Phase 1 infrastructure patterns)
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/api/audit';
import { checkRateLimit } from '@/lib/auth/rate-limit';

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    // Use established unauthenticated mock from Phase 1
    vi.mocked(createClient).mockResolvedValue(createUnauthenticatedMock());

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('should return 400 if prompt missing (Zod validation)', async () => {
    // Use established authenticated mock from Phase 1
    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 if prompt exceeds max length', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'x'.repeat(60000) }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return SSE stream with correct headers', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Stream-Id')).toBeDefined();
  });

  it('should call audit log on successful request', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', operationType: 'selection' }),
    });

    await POST(request);

    expect(createAuditLog).toHaveBeenCalledWith(
      'ai:generate',
      expect.objectContaining({
        userId: 'user-1',
        operationType: 'selection',
      })
    );
  });

  it('should verify aiLogger is called with correct context', async () => {
    // Verify domain logger pattern per Phase 2 best practices
    const { aiLogger } = await import('@/lib/ai/claude-cli');

    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    await POST(request);

    expect(aiLogger).toHaveBeenCalled();
  });

  it('should return 429 if rate limited (per Phase 1 patterns)', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    // Mock rate limit exceeded
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      retryAfter: 30000,
    });

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.retryAfter).toBe(30000);
  });

  it('should call checkRateLimit with user identifier', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabaseClient({ userId: 'user-1' }));

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    await POST(request);

    expect(checkRateLimit).toHaveBeenCalledWith(
      'ai:user-1',
      '192.168.1.1',
      expect.objectContaining({
        maxAttempts: expect.any(Number),
        windowMs: expect.any(Number),
      })
    );
  });
});
```

### Step 3: Run test to verify it fails

```bash
npm test src/app/api/ai/generate/__tests__/route.test.ts
```

**Expected:** FAIL (module not found)

### Step 4: Create Zod schema for validation

First, create the request schema per best practices:

```typescript
// src/lib/api/schemas/ai-generate.ts
import { z } from 'zod';
import { AI } from '@/lib/constants/ai';

export const generateRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(AI.MAX_PROMPT_LENGTH, `Prompt exceeds ${AI.MAX_PROMPT_LENGTH} characters`),
  documentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  operationType: z.enum(['selection', 'cursor', 'global', 'chat']).default('selection'),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
```

### Step 5: Implement the route with proper error handling

```typescript
// src/app/api/ai/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ClaudeStream, StreamChunk } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
import { generateRequestSchema } from '@/lib/api/schemas/ai-generate';
import { formatZodError, handleApiError } from '@/lib/api';
import { createAuditLog } from '@/lib/api/audit';
import { aiLogger } from '@/lib/ai/claude-cli';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { AI } from '@/lib/constants/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const log = aiLogger({});

  try {
    // Authentication check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    // Rate limiting check (per Phase 1 infrastructure patterns)
    const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rateLimit = await checkRateLimit(`ai:${user.id}`, clientIp, {
      maxAttempts: AI.RATE_LIMIT.MAX_REQUESTS_PER_MINUTE,
      windowMs: AI.RATE_LIMIT.WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      log.warn({ userId: user.id }, 'AI rate limit exceeded');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 }
      );
    }

    // Parse and validate request body with Zod
    const body = await request.json();
    const result = generateRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { prompt, documentId, projectId, operationType } = result.data;
    const streamId = crypto.randomUUID();

    // Audit log the AI operation per Phase 2 patterns
    await createAuditLog('ai:generate', {
      userId: user.id,
      streamId,
      documentId,
      projectId,
      operationType,
      promptLength: prompt.length,
    });

    log.info({ streamId, userId: user.id, operationType }, 'Starting AI generation');

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const claudeStream = new ClaudeStream();

        request.signal.addEventListener('abort', () => {
          log.info({ streamId }, 'Stream aborted by client');
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
              log.info({ streamId }, 'AI generation completed');
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          },
          onError: (error) => {
            if (!request.signal.aborted) {
              log.error({ streamId, error }, 'AI generation error');
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
  } catch (error) {
    // Use standard error handler per best practices
    return handleApiError(error, log, 'Failed to generate AI response');
  }
}
```

### Step 6: Run test to verify it passes

```bash
npm test src/app/api/ai/generate/__tests__/route.test.ts
```

**Expected:** PASS

### Step 7: Commit

```bash
git add src/lib/ai/index.ts src/lib/api/schemas/ai-generate.ts src/app/api/ai/generate/route.ts src/app/api/ai/generate/__tests__/route.test.ts
git commit -m "feat(api): add SSE streaming endpoint with Zod validation and audit logging"
```

---

### E2E Tests

Create `e2e/ai/ai-api.spec.ts` to verify API error responses end-to-end:

```typescript
// e2e/ai/ai-api.spec.ts
import { test, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

test.describe('AI API Error Responses', () => {
  test('authenticated user can call endpoint (200)', async ({ request }) => {
    // Uses authenticated context from auth.setup.ts
    const response = await request.post('/api/ai/generate', {
      data: { prompt: 'Test prompt', operationType: 'selection' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');
  });

  test('unauthenticated user gets 401', async ({ request }) => {
    // Create new context without authentication
    const response = await request.post('/api/ai/generate', {
      data: { prompt: 'Test prompt' },
      headers: { Cookie: '' }, // Clear auth cookies
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  test('rate limited user gets 429 with retryAfter header', async ({ request }) => {
    // Trigger rate limit by making rapid requests
    const requests = Array.from({ length: 15 }, () =>
      request.post('/api/ai/generate', {
        data: { prompt: 'Rate limit test' },
      })
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponse = responses.find((r) => r.status() === 429);

    expect(rateLimitedResponse).toBeDefined();
    if (rateLimitedResponse) {
      const body = await rateLimitedResponse.json();
      expect(body.code).toBe('RATE_LIMITED');
      expect(body.retryAfter).toBeGreaterThan(0);
    }
  });

  test('invalid request gets 400 validation error', async ({ request }) => {
    const response = await request.post('/api/ai/generate', {
      data: {
        /* missing required prompt */
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('prompt exceeding max length gets 400', async ({ request }) => {
    const response = await request.post('/api/ai/generate', {
      data: { prompt: 'x'.repeat(60000) },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
```

### E2E Verification

Before proceeding to the next task, ensure:

```bash
# Run API E2E tests
npx playwright test e2e/ai/ai-api.spec.ts

# Expected results:
# - All 5 tests pass
# - 401 returned for unauthenticated requests
# - 429 returned with retryAfter for rate-limited requests
# - 400 returned for validation errors
# - 200 with SSE headers for valid authenticated requests
```

- [ ] `e2e/ai/ai-api.spec.ts` exists and all tests pass
- [ ] API returns correct error codes for each scenario

---

## Verification Checklist

### Files

- [ ] `src/lib/ai/index.ts` exists with exports
- [ ] `src/lib/api/schemas/ai-generate.ts` exists with Zod schema
- [ ] `src/app/api/ai/generate/route.ts` exists
- [ ] `src/app/api/ai/generate/__tests__/route.test.ts` exists
- [ ] `e2e/ai/ai-api.spec.ts` exists

### Tests

- [ ] Unit tests pass: `npm test src/app/api/ai/generate/__tests__/route.test.ts`
- [ ] E2E tests pass: `npx playwright test e2e/ai/ai-api.spec.ts`

### API Behavior

- [ ] 401 returned for unauthenticated requests
- [ ] 400 returned for validation errors (Zod)
- [ ] 429 returned when rate limit exceeded (per Phase 1 patterns)
- [ ] Correct SSE headers set
- [ ] Abort signal handled

### Infrastructure Patterns (per Phase 1-2)

- [ ] Rate limiting uses `checkRateLimit` from `@/lib/auth/rate-limit`
- [ ] Rate limit constants from `AI.RATE_LIMIT` (not hardcoded)
- [ ] Audit logging captures AI operations via `createAuditLog`
- [ ] Structured logging via `aiLogger` (not console.log)

### Complete

- [ ] Changes committed

---

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/ai/ai-api.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 3.11.

---

## Next Steps

After this task, proceed to **[Task 3.11: Context Builder](./11-context-builder.md)**.
