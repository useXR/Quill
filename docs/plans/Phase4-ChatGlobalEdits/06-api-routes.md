# Task 4.6: API Routes

> **Phase 4** | [← API Helpers](./05-api-helpers.md) | [Next: Database Migration →](./07-database-migration.md)

---

## Context

**This task creates the API routes for chat, streaming, global edits, and AI operations.** These Next.js API routes handle authentication, validation, rate limiting, and SSE streaming.

### Prerequisites

- **Task 4.5** completed (API helpers)

### Rate Limiting Requirements

Per security best practices, these endpoints require rate limiting:

| Endpoint                     | Limit        | Window              |
| ---------------------------- | ------------ | ------------------- |
| `/api/chat/history` (GET)    | 100 requests | Per minute per user |
| `/api/chat/history` (DELETE) | 10 requests  | Per minute per user |
| `/api/ai/chat`               | 20 requests  | Per minute per user |
| `/api/ai/global-edit`        | 10 requests  | Per minute per user |
| `/api/ai/operations`         | 100 requests | Per minute per user |

### What This Task Creates

- `src/app/api/chat/history/route.ts` - Chat history CRUD
- `src/app/api/ai/chat/route.ts` - Streaming chat endpoint
- `src/app/api/ai/global-edit/route.ts` - Global edit with diff
- `src/app/api/ai/operations/route.ts` - Operations list
- `src/app/api/ai/operations/[id]/route.ts` - Operation update
- Test files for each route

### Tasks That Depend on This

- **Task 4.7** (Database Migration) - Indexes for routes
- **Task 4.8** (ChatSidebar) - Calls chat routes
- **Task 4.9** (DiffPanel) - Calls operations routes

---

## Files to Create/Modify

- `src/lib/api/error-response.ts` (create) - Standardized error formatting
- `src/app/api/chat/history/route.ts` (create)
- `src/app/api/chat/history/__tests__/route.test.ts` (create)
- `src/app/api/ai/chat/route.ts` (create)
- `src/app/api/ai/chat/__tests__/route.test.ts` (create)
- `src/app/api/ai/global-edit/route.ts` (create)
- `src/app/api/ai/global-edit/__tests__/route.test.ts` (create)
- `src/app/api/ai/operations/route.ts` (create)
- `src/app/api/ai/operations/__tests__/route.test.ts` (create)
- `src/app/api/ai/operations/[id]/route.ts` (create)
- `src/app/api/ai/operations/[id]/__tests__/route.test.ts` (create)

---

## Pre-Task: Create Standardized Error Response Helper

Before creating routes, create a standardized error response helper (Best Practice: Consistent error formatting).

Create `src/lib/api/error-response.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
  retryAfter?: number;
}

export function errorResponse(
  message: string,
  status: number,
  options?: { code?: string; details?: unknown; retryAfter?: number }
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: message,
      code: options?.code,
      details: options?.details,
      retryAfter: options?.retryAfter,
    },
    { status }
  );
}

export function validationError(error: ZodError): NextResponse<ApiError> {
  return errorResponse('Validation failed', 400, {
    code: 'VALIDATION_ERROR',
    details: error.flatten(),
  });
}

export function unauthorizedError(): NextResponse<ApiError> {
  return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
}

export function rateLimitError(retryAfter: number): NextResponse<ApiError> {
  return errorResponse('Too many requests', 429, {
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter,
  });
}

export function serverError(message = 'Internal server error'): NextResponse<ApiError> {
  return errorResponse(message, 500, { code: 'SERVER_ERROR' });
}
```

Also create `src/lib/rate-limit.ts` for the rate limiting implementation:

```typescript
interface RateLimitConfig {
  limit: number;
  window: number; // seconds
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter?: number;
}

// Simple in-memory rate limiter
// NOTE: For production multi-instance deployment, use Redis (see Production Considerations)
const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  return async (identifier: string): Promise<RateLimitResult> => {
    const now = Date.now();
    const windowMs = config.window * 1000;
    const key = identifier;

    let record = requests.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      requests.set(key, record);
    }

    record.count++;

    if (record.count > config.limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { success: false, remaining: 0, retryAfter };
    }

    return { success: true, remaining: config.limit - record.count };
  };
}
```

Also create `src/lib/ai/sanitize.ts` for CLI input sanitization (Best Practice: CLI Input Sanitization from Phase 3):

```typescript
import { AI } from '@/lib/constants/ai';

export class SanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizationError';
  }
}

export function sanitizePrompt(prompt: string): string {
  // Remove control characters
  let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Escape shell metacharacters
  sanitized = sanitized.replace(/[`$(){}[\]\\]/g, '\\$&');

  // Prevent CLI flag injection
  if (/^-{1,2}\w/.test(sanitized.trim())) {
    throw new SanitizationError('Prompt cannot start with CLI flags');
  }

  // Enforce length limits
  if (sanitized.length > AI.MAX_PROMPT_LENGTH) {
    throw new SanitizationError(`Prompt exceeds ${AI.MAX_PROMPT_LENGTH} characters`);
  }

  return sanitized;
}

export function sanitizeContext(context: string): string {
  // Remove control characters
  let sanitized = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Enforce length limits for context
  if (sanitized.length > AI.MAX_CONTEXT_LENGTH) {
    sanitized = sanitized.slice(0, AI.MAX_CONTEXT_LENGTH);
  }

  return sanitized;
}
```

---

## Task 18: Chat History API Route

### Step 1: Write failing test for chat history route

Create `src/app/api/chat/history/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/chat', () => ({
  getChatHistory: vi.fn(() => ({ data: [], hasMore: false, nextCursor: null })),
  clearChatHistory: vi.fn(),
}));

describe('Chat History API Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });

    const request = new NextRequest('http://localhost/api/chat/history?projectId=123');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid projectId', async () => {
    const request = new NextRequest('http://localhost/api/chat/history?projectId=invalid');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should return chat history for valid request', async () => {
    const request = new NextRequest('http://localhost/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/app/api/chat/history/__tests__/route.test.ts
```

**Expected:** FAIL with "Cannot find module '../route'"

### Step 3: Create the route file

Create `src/app/api/chat/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatHistory, clearChatHistory } from '@/lib/api/chat';
import { rateLimit } from '@/lib/rate-limit';
import { unauthorizedError, validationError, rateLimitError, serverError } from '@/lib/api/error-response';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Domain logger for chat operations (Best Practice: Domain child loggers)
const chatLogger = (context: { userId?: string; projectId?: string }) => logger.child({ domain: 'chat', ...context });

// Rate limit: 100 requests per minute for GET, 10 for DELETE
const rateLimitGet = rateLimit({ limit: 100, window: 60 });
const rateLimitDelete = rateLimit({ limit: 10, window: 60 });

const querySchema = z.object({
  projectId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  const log = chatLogger({ userId: user.id });

  // Rate limit check
  const rateLimitResult = await rateLimitGet(user.id);
  if (!rateLimitResult.success) {
    log.warn('Rate limit exceeded for chat history GET');
    return rateLimitError(rateLimitResult.retryAfter!);
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: searchParams.get('projectId'),
    documentId: searchParams.get('documentId'),
    limit: searchParams.get('limit'),
    cursor: searchParams.get('cursor'),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const result = await getChatHistory(parsed.data.projectId, parsed.data.documentId, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });
    log.info({ projectId: parsed.data.projectId }, 'Chat history fetched');
    return NextResponse.json(result);
  } catch (error) {
    log.error({ error }, 'Failed to fetch chat history');
    return serverError('Failed to fetch chat history');
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  const log = chatLogger({ userId: user.id });

  // Rate limit check for DELETE
  const rateLimitResult = await rateLimitDelete(user.id);
  if (!rateLimitResult.success) {
    log.warn('Rate limit exceeded for chat history DELETE');
    return rateLimitError(rateLimitResult.retryAfter!);
  }

  const { projectId, documentId } = await request.json();

  if (!projectId) {
    return validationError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['projectId'],
          message: 'projectId is required',
        },
      ])
    );
  }

  try {
    await clearChatHistory(projectId, documentId);
    log.info({ projectId, documentId }, 'Chat history cleared');
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error, projectId }, 'Failed to clear chat history');
    return serverError('Failed to clear chat history');
  }
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/app/api/chat/history/__tests__/route.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/app/api/chat/history/route.ts src/app/api/chat/history/__tests__/route.test.ts
git commit -m "feat: add chat history API route with tests"
```

---

## Task 19: Streaming Chat API Route

### Step 1: Write failing test for streaming chat route

Create `src/app/api/ai/chat/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/chat', () => ({
  saveChatMessage: vi.fn(),
}));

vi.mock('@/lib/ai/streaming', () => ({
  streamClaude: vi.fn((prompt, onChunk, onComplete) => {
    onChunk('Hello');
    onComplete();
    return () => {};
  }),
}));

describe('Streaming Chat API Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ content: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return SSE stream for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/app/api/ai/chat/__tests__/route.test.ts
```

**Expected:** FAIL with "Cannot find module '../route'"

### Step 3: Create the streaming chat route

Create `src/app/api/ai/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
import { saveChatMessage } from '@/lib/api/chat';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizePrompt } from '@/lib/ai/sanitize';
import { createAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/logger';
import { AI } from '@/lib/constants/ai';
import { z } from 'zod';

// Domain logger for AI chat operations (Best Practice: AI Domain Logger from Phase 3)
const aiLogger = (context: { userId?: string; operationId?: string }) => logger.child({ domain: 'ai', ...context });

// Rate limit: 20 AI chat requests per minute per user
const rateLimitChat = rateLimit({ limit: 20, window: 60 });

const requestSchema = z.object({
  content: z.string().min(1).max(AI.MAX_PROMPT_LENGTH),
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  mode: z.enum(['discussion', 'global_edit', 'research']).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const operationId = crypto.randomUUID();
  const log = aiLogger({ userId: user.id, operationId });

  // Rate limit check
  const rateLimitResult = await rateLimitChat(user.id);
  if (!rateLimitResult.success) {
    log.warn('Rate limit exceeded for AI chat');
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { content, documentId, projectId, mode } = parsed.data;

  // Sanitize user input before passing to CLI (Best Practice: CLI Input Sanitization)
  let sanitizedContent: string;
  try {
    sanitizedContent = sanitizePrompt(content);
  } catch (error) {
    log.warn({ error }, 'Input sanitization failed');
    return new Response(JSON.stringify({ error: 'Invalid input', code: 'SANITIZATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Audit log the AI operation (Best Practice: AI Audit Events with ai: prefix)
  await createAuditLog('ai:chat', {
    userId: user.id,
    documentId,
    projectId,
    mode,
    operationId,
  });

  log.info({ documentId, projectId, mode }, 'Starting AI chat stream');

  await saveChatMessage({ projectId, documentId, role: 'user', content: sanitizedContent });

  let systemPrompt = 'You are a helpful AI assistant for academic grant writing.';
  if (mode === 'global_edit') {
    systemPrompt += ' The user wants to make changes to their document.';
  } else if (mode === 'research') {
    systemPrompt += ' Help find relevant research and citations.';
  }

  const fullPrompt = `${systemPrompt}\n\nUser: ${sanitizedContent}`;
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = streamClaude(
        fullPrompt,
        (chunk) => {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
        },
        async () => {
          await saveChatMessage({ projectId, documentId, role: 'assistant', content: fullResponse });
          log.info({ documentId }, 'AI chat stream completed');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        },
        (error) => {
          log.error({ error }, 'AI chat stream error');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`));
          controller.close();
        }
      );

      request.signal.addEventListener('abort', () => {
        log.info('AI chat stream aborted by client');
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Operation-Id': operationId,
    },
  });
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/app/api/ai/chat/__tests__/route.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/app/api/ai/chat/route.ts src/app/api/ai/chat/__tests__/route.test.ts
git commit -m "feat: add streaming chat API route with tests"
```

---

## Task 20: Global Edit API Route

### Step 1: Write failing test for global edit route

Create `src/app/api/ai/global-edit/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn() })) })),
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  createAIOperation: vi.fn(() => ({ id: 'op-1' })),
}));

vi.mock('@/lib/ai/streaming', () => ({
  streamClaude: vi.fn((prompt, onChunk, onComplete) => {
    onChunk('Modified content');
    onComplete();
    return () => {};
  }),
}));

vi.mock('@/lib/ai/diff-generator', () => ({
  generateDiff: vi.fn(() => [{ type: 'add', value: 'Modified', lineNumber: 1 }]),
}));

describe('Global Edit API Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });

    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Test',
        currentContent: 'Content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing instruction', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({ currentContent: 'Content' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return SSE stream for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/app/api/ai/global-edit/__tests__/route.test.ts
```

**Expected:** FAIL with "Cannot find module '../route'"

### Step 3: Create the global edit route

Create `src/app/api/ai/global-edit/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
import { createAIOperation } from '@/lib/api/ai-operations';
import { generateDiff } from '@/lib/ai/diff-generator';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizePrompt, sanitizeContext } from '@/lib/ai/sanitize';
import { createAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/logger';
import { AI } from '@/lib/constants/ai';
import { z } from 'zod';

// Domain logger for AI global edit operations (Best Practice: AI Domain Logger from Phase 3)
const aiLogger = (context: { userId?: string; operationId?: string }) =>
  logger.child({ domain: 'ai', operation: 'global-edit', ...context });

// Rate limit: 10 global edit requests per minute per user (expensive operation)
const rateLimitGlobalEdit = rateLimit({ limit: 10, window: 60 });

const requestSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  instruction: z.string().min(1).max(AI.MAX_PROMPT_LENGTH),
  currentContent: z.string().max(AI.MAX_CONTEXT_LENGTH), // Use constant from Phase 3
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const operationId = crypto.randomUUID();
  const log = aiLogger({ userId: user.id, operationId });

  // Rate limit check (more restrictive for expensive global edits)
  const rateLimitResult = await rateLimitGlobalEdit(user.id);
  if (!rateLimitResult.success) {
    log.warn('Rate limit exceeded for global edit');
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { documentId, projectId, instruction, currentContent } = parsed.data;

  // Sanitize user input before passing to CLI (Best Practice: CLI Input Sanitization)
  let sanitizedInstruction: string;
  let sanitizedContent: string;
  try {
    sanitizedInstruction = sanitizePrompt(instruction);
    sanitizedContent = sanitizeContext(currentContent);
  } catch (error) {
    log.warn({ error }, 'Input sanitization failed');
    return new Response(JSON.stringify({ error: 'Invalid input', code: 'SANITIZATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Audit log the global edit operation (Best Practice: AI Audit Events with ai: prefix)
  await createAuditLog('ai:global-edit', {
    userId: user.id,
    documentId,
    projectId,
    operationId,
    instructionLength: sanitizedInstruction.length,
    contentLength: sanitizedContent.length,
  });

  log.info({ documentId, projectId }, 'Starting global edit operation');

  const operation = await createAIOperation({
    documentId,
    operationType: 'global',
    inputSummary: sanitizedInstruction,
    snapshotBefore: { content: sanitizedContent },
  });

  const prompt = `You are an expert editor. Apply the following instruction to the document.

INSTRUCTION: ${sanitizedInstruction}

CURRENT DOCUMENT:
${sanitizedContent}

Respond ONLY with the complete edited document. No explanations.`;

  const encoder = new TextEncoder();
  let fullContent = '';

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = streamClaude(
        prompt,
        (chunk) => {
          fullContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
        },
        async () => {
          const diff = generateDiff(sanitizedContent, fullContent);

          await supabase.from('ai_operations').update({ output_content: fullContent }).eq('id', operation.id);

          log.info({ documentId, operationId: operation.id, diffCount: diff.length }, 'Global edit completed');

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                operationId: operation.id,
                modifiedContent: fullContent,
                diff,
              })}\n\n`
            )
          );
          controller.close();
        },
        (error) => {
          log.error({ error, operationId: operation.id }, 'Global edit stream error');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`));
          controller.close();
        }
      );

      request.signal.addEventListener('abort', () => {
        log.info({ operationId: operation.id }, 'Global edit aborted by client');
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Operation-Id': operationId,
    },
  });
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/app/api/ai/global-edit/__tests__/route.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/app/api/ai/global-edit/route.ts src/app/api/ai/global-edit/__tests__/route.test.ts
git commit -m "feat: add global edit API route with tests"
```

---

## Task 21a: AI Operations List API Route

### Step 1: Write failing test for operations list route

Create `src/app/api/ai/operations/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  getRecentOperations: vi.fn(() => [{ id: 'op-1', status: 'accepted' }]),
}));

describe('AI Operations List Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });
    const request = new NextRequest('http://localhost/api/ai/operations?documentId=doc-1');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 when documentId missing', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should return operations for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations?documentId=doc-1');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/app/api/ai/operations/__tests__/route.test.ts
```

**Expected:** FAIL with "Cannot find module '../route'"

### Step 3: Create operations list route

Create `src/app/api/ai/operations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentOperations } from '@/lib/api/ai-operations';
import { unauthorizedError, validationError, serverError } from '@/lib/api/error-response';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Domain logger for AI operations (Best Practice: Domain child loggers)
const aiLogger = (context: { userId?: string }) =>
  logger.child({ domain: 'ai', operation: 'list-operations', ...context });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  const log = aiLogger({ userId: user.id });

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!documentId) {
    return validationError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['documentId'],
          message: 'documentId is required',
        },
      ])
    );
  }

  try {
    const operations = await getRecentOperations(documentId, limit);
    log.info({ documentId, count: operations.length }, 'Fetched AI operations');
    return NextResponse.json(operations);
  } catch (error) {
    log.error({ error, documentId }, 'Failed to fetch operations');
    return serverError('Failed to fetch operations');
  }
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/app/api/ai/operations/__tests__/route.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/app/api/ai/operations/route.ts src/app/api/ai/operations/__tests__/route.test.ts
git commit -m "feat: add AI operations list route with tests"
```

---

## Task 21b: AI Operations Update API Route

### Step 1: Write failing test for operation update route

Create `src/app/api/ai/operations/[id]/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  updateAIOperationStatus: vi.fn(() => ({ id: 'op-1', status: 'accepted' })),
}));

describe('AI Operations Update Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: { id: 'op-1' } });
    expect(response.status).toBe(401);
  });

  it('should update operation status', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: { id: 'op-1' } });
    expect(response.status).toBe(200);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/app/api/ai/operations/[id]/__tests__/route.test.ts
```

**Expected:** FAIL with "Cannot find module '../route'"

### Step 3: Create operation update route

Create `src/app/api/ai/operations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateAIOperationStatus } from '@/lib/api/ai-operations';
import { createAuditLog } from '@/lib/api/audit';
import { unauthorizedError, serverError } from '@/lib/api/error-response';
import { logger } from '@/lib/logger';

// Domain logger for AI operations (Best Practice: Domain child loggers)
const aiLogger = (context: { userId?: string; operationId?: string }) =>
  logger.child({ domain: 'ai', operation: 'update-operation', ...context });

// Next.js 15 dynamic route params pattern (Best Practice: Await params in App Router)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  const log = aiLogger({ userId: user.id, operationId: id });

  const { status, outputContent } = await request.json();

  try {
    const operation = await updateAIOperationStatus(id, status, outputContent);

    // Audit log status changes (Best Practice: AI Audit Events)
    await createAuditLog('ai:operation-status', {
      userId: user.id,
      operationId: id,
      status,
      hasOutputContent: !!outputContent,
    });

    log.info({ status }, 'AI operation status updated');
    return NextResponse.json(operation);
  } catch (error) {
    log.error({ error }, 'Failed to update operation');
    return serverError('Failed to update operation');
  }
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/app/api/ai/operations/[id]/__tests__/route.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/app/api/ai/operations/[id]/route.ts src/app/api/ai/operations/[id]/__tests__/route.test.ts
git commit -m "feat: add AI operations update route with tests"
```

---

## Verification Checklist

- [ ] Chat history route returns 401 for unauthenticated
- [ ] Chat history route validates projectId as UUID
- [ ] Streaming chat returns SSE stream
- [ ] Global edit creates operation and returns diff
- [ ] Operations list requires documentId
- [ ] Operations update modifies status
- [ ] All routes handle errors gracefully
- [ ] All tests pass
- [ ] Changes committed (5 commits for Tasks 18-21b)

---

## Next Steps

After this task, proceed to **[Task 4.7: Database Migration](./07-database-migration.md)**.
