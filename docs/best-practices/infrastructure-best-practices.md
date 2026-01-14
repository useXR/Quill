# Infrastructure & Docker Best Practices

Lessons learned from building and deploying a production TypeScript/React/Next.js application with Docker. These patterns apply to projects using containerized backends like Supabase, PostgreSQL, or similar services.

---

## Phase 0 Implementation Status

> **Note for Later Phases:** The following infrastructure items are **already fully implemented** in Phase 0 and do NOT need to be repeated. Later phases should leverage these existing foundations.

### ✅ Fully Implemented in Phase 0 (Do NOT Duplicate)

| Item                            | Location                                                   | Notes                                                                                                             |
| ------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Health Check Endpoint**       | `src/app/api/health/route.ts`                              | Complete `/api/health` endpoint with status, timestamp, version, database checks. Ready for Docker health checks. |
| **Standalone Output**           | `next.config.ts`                                           | `output: 'standalone'` configured - required for multi-stage Docker builds.                                       |
| **Port Isolation Strategy**     | Throughout                                                 | Dev: 3000, Test: 3088, Prod: internal only. Already enforced in Playwright config.                                |
| **Environment Files Pattern**   | Root                                                       | `.env.local`, `.env.local.example`, `.env.test` structure established.                                            |
| **LF Line Endings**             | `.gitattributes`                                           | `*.sh text eol=lf` and `*.sql text eol=lf` - prevents script failures.                                            |
| **Database RLS Policies**       | `supabase/migrations/`                                     | Row Level Security on all tables - database-level access control.                                                 |
| **Audit Logs Table**            | `supabase/migrations/`                                     | `audit_logs` table with indexes for security tracking.                                                            |
| **Typed Supabase Clients**      | `src/lib/supabase/`                                        | Type-safe browser and server clients with `<Database>` generic.                                                   |
| **Test Data Cleanup Utilities** | `src/lib/supabase/test-utils.ts`, `e2e/helpers/cleanup.ts` | `TestData` class and `TestDataCleanup` class for cleanup in reverse FK order.                                     |

### ⏳ Deferred Items (Implement When Needed)

| Item                        | Target Phase | This Document Section                                                              |
| --------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| Docker Compose files        | Deployment   | [Docker Compose Structure](#docker-compose-structure)                              |
| Dockerfile (multi-stage)    | Deployment   | [Dockerfile Patterns](#dockerfile-patterns)                                        |
| Resource limits             | Deployment   | [Resource Management](#resource-management)                                        |
| Backup/restore scripts      | Operations   | [Backup & Restore](#backup--restore)                                               |
| Deployment/rollback scripts | Deployment   | [Deployment Scripts](#deployment-scripts), [Rollback Strategy](#rollback-strategy) |
| Cloudflare Tunnel           | Deployment   | [Lessons Learned #15](#15-use-cloudflare-tunnel-for-zero-port-exposure)            |

---

## Phase 1 Implementation Status

> **Note for Later Phases:** The following infrastructure items are **implemented in Phase 1** and should be used by later phases.

### ✅ Implemented in Phase 1

| Item                                   | Location                     | Notes                                                                                                  |
| -------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Security Headers (CSP, HSTS, etc.)** | `next.config.ts`             | Full security header suite including Content-Security-Policy. CSP configured for Supabase connections. |
| **Rate Limiting**                      | `src/lib/auth/rate-limit.ts` | Database-backed rate limiting with fail-open behavior. Uses `auth_attempts` table from Phase 0.        |
| **Structured Logging (Pino)**          | `src/lib/logger.ts`          | JSON logging for production, pretty printing for development. Import from `@/lib/logger`.              |

### When to Use Phase 1 Utilities

**Structured Logger:**

```typescript
import { logger } from '@/lib/logger';

// Log with context
logger.info({ userId, action: 'login' }, 'User authenticated');
logger.error({ error, requestId }, 'Request failed');
logger.warn({ email }, 'Rate limit approaching');
```

**Rate Limiting (for new auth flows):**

```typescript
import { checkRateLimit, recordAuthAttempt } from '@/lib/auth';

const result = await checkRateLimit(email, ipAddress);
if (!result.allowed) {
  return { error: 'Too many attempts', retryAfter: result.retryAfter };
}
// ... perform auth
await recordAuthAttempt(email, ipAddress, success);
```

**Security Headers (CSP modifications):**
If you need to add external resources (fonts, analytics, CDN), update the CSP in `next.config.ts`:

```typescript
// Add to connect-src for new API endpoints
"connect-src 'self' https://*.supabase.co https://api.example.com",
// Add to script-src for analytics
"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://analytics.example.com",
```

### What Later Phases Should Do

1. **Use the logger** - Import from `@/lib/logger` for all logging needs
2. **Extend rate limiting** - Use the same pattern for new rate-limited endpoints
3. **Update CSP** - Modify `next.config.ts` when adding external resources
4. **Don't duplicate** - Don't create new logging or rate limiting utilities

---

## Phase 2 Implementation Status

> **Note for Later Phases:** The following infrastructure patterns are **implemented in Phase 2** and should be reused by later phases.

### ✅ Implemented in Phase 2

| Item                              | Location                                 | Notes                                                                      |
| --------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| **Module-specific Child Loggers** | `src/lib/logger.ts`                      | `vaultLogger` pattern for creating domain-specific loggers.                |
| **Soft Delete Pattern**           | `vault_items.deleted_at` column          | Recoverable deletes with 7-day grace period before permanent cleanup.      |
| **Soft Delete Cleanup Function**  | `cleanup_soft_deleted_vault_items()`     | Database function for scheduled permanent deletion.                        |
| **Audit Logging Helper**          | `src/lib/api/audit.ts`                   | `createAuditLog()` for tracking domain operations (create/delete/restore). |
| **Secure Filename Sanitizer**     | `src/lib/utils/filename.ts`              | `sanitizeFilename()` - handles path traversal, null bytes, special chars.  |
| **Test Fixtures Pattern**         | `src/lib/<module>/__tests__/fixtures.ts` | Factory functions like `createMockVaultItem()` for test data.              |
| **Barrel Exports**                | `src/lib/<module>/index.ts`              | Every module directory has an index.ts for clean imports.                  |
| **Request Cancellation**          | AbortController in components            | Pattern for cancelling stale API requests (search, autocomplete).          |
| **Optimistic Updates**            | `VaultPageClient.tsx`                    | Pattern for responsive UI with rollback on failure.                        |

### When to Use Phase 2 Patterns

**Module-specific Logger:**

```typescript
// In src/lib/logger.ts, add new domain loggers following this pattern:
export function aiLogger(context: { userId?: string; sessionId?: string }) {
  return logger.child({ module: 'ai', ...context });
}

export function chatLogger(context: { userId?: string; conversationId?: string }) {
  return logger.child({ module: 'chat', ...context });
}
```

**Soft Delete Pattern:**

```sql
-- Add to any table needing recoverable deletes:
ALTER TABLE your_table ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- RLS policy to exclude soft-deleted by default:
CREATE POLICY "Users can view own non-deleted items"
  ON your_table FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Cleanup function (customize table name and grace period):
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_your_table()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM your_table
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;
```

**Audit Logging:**

```typescript
import { createAuditLog } from '@/lib/api/audit';

// Log domain operations
await createAuditLog({
  userId: user.id,
  action: 'feature:create', // Use 'domain:action' format
  resourceType: 'your_resource',
  resourceId: item.id,
  metadata: {
    /* additional context */
  },
});
```

**Secure Filename Sanitizer:**

```typescript
import { sanitizeFilename } from '@/lib/utils/filename';

// Use for any user-provided filenames before storage
const safeName = sanitizeFilename(userProvidedFilename);
const path = `${userId}/${projectId}/${Date.now()}-${safeName}`;
```

**Test Fixtures Pattern:**

```typescript
// Create src/lib/yourmodule/__tests__/fixtures.ts
export const mockYourItem: YourType = {
  id: 'item-1',
  // ... default values
};

export function createMockYourItem(overrides: Partial<YourType> = {}): YourType {
  return { ...mockYourItem, ...overrides };
}

// In tests, always use the factory:
const item = createMockYourItem({ status: 'active' });
```

**Request Cancellation:**

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const handleSearch = async () => {
  // Cancel previous request
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  try {
    const response = await fetch('/api/search', {
      signal: abortControllerRef.current.signal,
    });
    // handle response
  } catch (error) {
    if ((error as Error).name === 'AbortError') return; // Ignore cancelled
    // handle real errors
  }
};
```

**Optimistic Updates:**

```typescript
const handleDelete = async (id: string) => {
  const previousItems = items; // Save for rollback
  setItems((prev) => prev.filter((item) => item.id !== id)); // Optimistic remove

  try {
    const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');
  } catch (error) {
    setItems(previousItems); // Rollback on failure
    setError('Failed to delete. Please try again.');
  }
};
```

### What Later Phases Should Do

1. **Create module-specific loggers** - Add `yourModuleLogger` to `src/lib/logger.ts` following the pattern
2. **Use soft delete for user data** - Any user-deletable content should use the soft delete pattern
3. **Audit important operations** - Log creates, deletes, restores, and significant state changes
4. **Sanitize user filenames** - Always use `sanitizeFilename()` before storing user-provided names
5. **Create test fixtures** - Every `src/lib/<module>/` should have `__tests__/fixtures.ts` with factories
6. **Add barrel exports** - Every `src/lib/<module>/` must have `index.ts`
7. **Cancel stale requests** - Use AbortController for search, autocomplete, and typeahead features
8. **Use optimistic updates** - For responsive delete/update UX with rollback on failure

---

## Phase 3 Implementation Status

> **Note for Later Phases:** The following infrastructure patterns are **implemented in Phase 3** and should be reused by later phases.

### ✅ Implemented in Phase 3

| Item                         | Location                           | Notes                                                   |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------- |
| **AI Domain Logger**         | `src/lib/ai/claude-cli.ts`         | `aiLogger` pattern for AI module logging.               |
| **SSE Streaming Endpoint**   | `src/app/api/ai/generate/route.ts` | Server-Sent Events pattern for streaming responses.     |
| **Provider Factory Pattern** | `src/lib/ai/index.ts`              | `createAIProvider()` enables swappable implementations. |
| **Rate Limiting for AI**     | `src/app/api/ai/generate/route.ts` | Rate limiting applied to expensive AI operations.       |
| **Streaming Cancellation**   | `src/app/api/ai/generate/route.ts` | AbortController + request.signal for SSE abort.         |
| **Stores Barrel Export**     | `src/lib/stores/index.ts`          | Barrel exports for Zustand stores.                      |

### When to Use Phase 3 Patterns

**SSE Streaming Endpoint:**
When you need to stream data from server to client (chat, real-time updates, progressive generation):

```typescript
// src/app/api/your-feature/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Authentication check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Handle client abort
      request.signal.addEventListener('abort', () => {
        controller.close();
      });

      // Stream data
      for await (const chunk of yourDataSource()) {
        if (request.signal.aborted) return;
        const data = JSON.stringify(chunk);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Signal completion
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Stream-Id': crypto.randomUUID(),
    },
  });
}
```

**Provider Factory Pattern:**
When you need swappable implementations (different backends, test vs production):

```typescript
// src/lib/your-feature/index.ts
import type { YourProvider } from './types';
import { DefaultProvider } from './default-provider';
import { AlternativeProvider } from './alternative-provider';

export function createYourProvider(): YourProvider {
  // Check for alternative implementation
  if (process.env.USE_ALTERNATIVE_PROVIDER) {
    return new AlternativeProvider();
  }
  return new DefaultProvider();
}

// Re-export types and utilities
export type { YourProvider } from './types';
```

**Rate Limiting for Expensive Operations:**
Apply rate limiting to any expensive or resource-intensive endpoints:

```typescript
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { YOUR_FEATURE } from '@/lib/constants/your-feature';

// In your API route
const rateLimit = await checkRateLimit(
  `feature:${user.id}`, // Unique identifier per user/feature
  clientIp,
  {
    maxAttempts: YOUR_FEATURE.RATE_LIMIT.MAX_REQUESTS_PER_MINUTE,
    windowMs: YOUR_FEATURE.RATE_LIMIT.WINDOW_MS,
  }
);

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', code: 'RATE_LIMITED', retryAfter: rateLimit.retryAfter },
    { status: 429 }
  );
}
```

**Streaming Cancellation Pattern:**
Always handle client disconnection for streaming endpoints:

```typescript
// In SSE endpoint
request.signal.addEventListener('abort', () => {
  log.info({ streamId }, 'Stream aborted by client');
  yourCleanupFunction(); // Cancel underlying operation
  controller.close();
});

// Check abort before each chunk
if (request.signal.aborted) return;
```

**Client-Side SSE Consumption:**
Pattern for consuming SSE streams with EventSource:

```typescript
// In React hook or component
const eventSource = new EventSource('/api/your-feature/stream');

eventSource.onmessage = (event) => {
  if (event.data === '[DONE]') {
    eventSource.close();
    return;
  }
  const chunk = JSON.parse(event.data);
  // Handle chunk
};

eventSource.onerror = () => {
  eventSource.close();
  // Handle error
};

// Cleanup on unmount
return () => eventSource.close();
```

### What Later Phases Should Do

1. **Use SSE for streaming** - For chat, real-time updates, or progressive generation
2. **Apply rate limiting** - To any expensive or resource-intensive endpoints
3. **Use provider pattern** - When implementation may change (different backends, APIs)
4. **Handle stream cancellation** - Always check `request.signal.aborted` and clean up
5. **Add feature-specific rate limit constants** - In your feature's constants file
6. **Follow domain logger pattern** - Create `yourFeatureLogger` following `aiLogger` pattern

### CSP Updates for External APIs

When adding external API connections (e.g., direct Anthropic API in future):

```typescript
// next.config.ts - update CSP connect-src
"connect-src 'self' https://*.supabase.co https://api.anthropic.com",
```

---

## Phase 4 Implementation Status

> **Note for Later Phases:** The following infrastructure patterns are **implemented in Phase 4** and should be reused by later phases.

### ✅ Implemented in Phase 4

| Item                       | Location                        | Notes                                                                                                   |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Error Response Helpers** | `src/lib/api/error-response.ts` | Standardized `unauthorizedError()`, `validationError()`, `rateLimitError()`, `serverError()` functions. |
| **CLI Input Sanitization** | `src/lib/ai/sanitize.ts`        | `sanitizePrompt()` and `sanitizeContext()` for subprocess security.                                     |
| **Simple Rate Limiter**    | `src/lib/rate-limit.ts`         | In-memory rate limiter with configurable limits. Production should use Redis.                           |
| **Chat Domain Logger**     | API routes                      | `chatLogger` pattern for chat-specific logging.                                                         |
| **AI Audit Events**        | API routes                      | `ai:chat`, `ai:global-edit`, `ai:operation-status` audit actions.                                       |
| **Database Retention**     | `cleanup_old_records()`         | 90-day retention with scheduled cleanup function.                                                       |

### When to Use Phase 4 Patterns

**Error Response Helpers:**
Use standardized error responses for consistent API error formatting:

```typescript
import { unauthorizedError, validationError, rateLimitError, serverError } from '@/lib/api/error-response';

// In API route handlers
if (!user) {
  return unauthorizedError();
}

if (!parsed.success) {
  return validationError(parsed.error);
}

if (!rateLimitResult.success) {
  return rateLimitError(rateLimitResult.retryAfter!);
}

// For unexpected errors
return serverError('Operation failed');
```

**CLI Input Sanitization:**
Always sanitize user input before passing to subprocess (Claude CLI):

```typescript
import { sanitizePrompt, sanitizeContext, SanitizationError } from '@/lib/ai/sanitize';

try {
  const safePrompt = sanitizePrompt(userInput);
  const safeContext = sanitizeContext(documentContent);
  // Now safe to pass to CLI
} catch (error) {
  if (error instanceof SanitizationError) {
    return new Response(JSON.stringify({ error: 'Invalid input', code: 'SANITIZATION_ERROR' }), { status: 400 });
  }
  throw error;
}
```

**Simple Rate Limiter:**
For custom rate limiting beyond auth endpoints:

```typescript
import { rateLimit } from '@/lib/rate-limit';

// Create a rate limiter (100 requests per 60 seconds)
const myRateLimiter = rateLimit({ limit: 100, window: 60 });

// In your API route
const result = await myRateLimiter(`feature:${user.id}`);
if (!result.success) {
  return rateLimitError(result.retryAfter!);
}
```

> **Production Note:** The in-memory rate limiter works for single-instance deployments. For multi-instance deployments, use Redis-backed rate limiting.

**AI Audit Events:**
Use the `ai:` prefix for AI-specific audit events:

```typescript
import { createAuditLog } from '@/lib/api/audit';

// For chat operations
await createAuditLog('ai:chat', {
  userId: user.id,
  documentId,
  mode: 'discussion',
});

// For global edits
await createAuditLog('ai:global-edit', {
  userId: user.id,
  documentId,
  operationId,
});

// For status changes
await createAuditLog('ai:operation-status', {
  userId: user.id,
  operationId,
  status: 'accepted',
});
```

**Next.js 15 Async Params (Dynamic Routes):**
In Next.js 15 App Router, dynamic route params are now a Promise:

```typescript
// src/app/api/resource/[id]/route.ts
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Await the params
  // ...
}
```

### What Later Phases Should Do

1. **Use error response helpers** - Import from `@/lib/api/error-response` for consistent API errors
2. **Sanitize CLI inputs** - Always use `sanitizePrompt()` and `sanitizeContext()` before subprocess calls
3. **Create domain loggers** - Add `yourFeatureLogger` following the `aiLogger` and `chatLogger` patterns
4. **Audit AI operations** - Use `ai:action` format for AI-related audit events
5. **Await dynamic params** - Use Next.js 15 async params pattern in dynamic routes
6. **Define retention policies** - Add table comments and cleanup functions for new tables

---

## Phase 5 Implementation Status

> **Note for Later Phases:** The following infrastructure patterns are **implemented in Phase 5** and should be reused by later phases.

### ✅ Implemented in Phase 5

| Item                                   | Location                                | Notes                                                                                |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| **External API Client Pattern**        | `src/lib/citations/semantic-scholar.ts` | Server-side caching, client-side rate limiting, custom error class with typed codes. |
| **Citation Domain Logger**             | `src/lib/citations/logger.ts`           | `citationLogger()` following Phase 2/3 pattern.                                      |
| **Junction Table with Auto-numbering** | `document_citations` table              | Pattern for ordered many-to-many relationships.                                      |
| **Partial Index for Soft Delete**      | `citations_project_created_idx`         | Efficient queries excluding soft-deleted rows.                                       |
| **Server-Side Rate Limiting**          | Citation search route                   | API protection using `rateLimit()` from Phase 4.                                     |

### When to Use Phase 5 Patterns

**External API Client Pattern:**
When integrating with third-party APIs (data providers, external services, etc.):

```typescript
// src/lib/your-service/client.ts
import { YOUR_SERVICE } from '@/lib/constants/your-service';

// Custom error class with typed codes
export class YourServiceError extends Error {
  constructor(
    public code: 'RATE_LIMITED' | 'NOT_FOUND' | 'SERVICE_ERROR' | 'NETWORK_ERROR',
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'YourServiceError';
  }
}

// In-memory cache with TTL
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = YOUR_SERVICE.CACHE_TTL_MS;

// Client-side rate limiting (sliding window)
const requestQueue: number[] = [];
const RATE_LIMIT = YOUR_SERVICE.RATE_LIMIT_MAX_REQUESTS;
const RATE_WINDOW_MS = YOUR_SERVICE.RATE_LIMIT_WINDOW_MS;

function checkRateLimit(): void {
  const now = Date.now();
  // Remove expired requests from queue
  while (requestQueue.length > 0 && requestQueue[0] < now - RATE_WINDOW_MS) {
    requestQueue.shift();
  }
  if (requestQueue.length >= RATE_LIMIT) {
    const waitTime = requestQueue[0] + RATE_WINDOW_MS - now;
    throw new YourServiceError(
      'RATE_LIMITED',
      `Rate limit exceeded. Retry in ${Math.ceil(waitTime / 1000)}s`,
      Math.ceil(waitTime / 1000)
    );
  }
  requestQueue.push(now);
}

export async function fetchFromService(query: string): Promise<YourData[]> {
  checkRateLimit();

  let response: Response;
  try {
    response = await fetch(`${YOUR_SERVICE.API_BASE}/endpoint?q=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.YOUR_SERVICE_API_KEY && {
          'x-api-key': process.env.YOUR_SERVICE_API_KEY,
        }),
      },
    });
  } catch (error) {
    throw new YourServiceError('NETWORK_ERROR', (error as Error).message);
  }

  // Handle rate limiting from external API
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
    throw new YourServiceError('RATE_LIMITED', 'External rate limit', retryAfter);
  }

  if (!response.ok) {
    throw new YourServiceError('SERVICE_ERROR', `API error: ${response.status}`);
  }

  return response.json();
}

// Cached version for repeated queries
export async function fetchWithCache(query: string): Promise<YourData[]> {
  const cacheKey = query;
  const cached = cache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.data as YourData[];
  }

  const data = await fetchFromService(query);
  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

export function clearCache(): void {
  cache.clear();
}

export function resetRateLimitState(): void {
  requestQueue.length = 0;
}
```

**Junction Table with Auto-numbering:**
For many-to-many relationships requiring ordering (document-citations, playlist-songs, etc.):

```sql
-- Junction table with ordering support
CREATE TABLE IF NOT EXISTS public.parent_children (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE NOT NULL,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  order_number integer,  -- For display ordering
  position jsonb,        -- Optional: additional position metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(parent_id, child_id)
);

-- Function for auto-numbering within parent
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_parent_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(MAX(order_number), 0) + 1
  FROM public.parent_children
  WHERE parent_id = p_parent_id;
$$ LANGUAGE sql STABLE;

-- Usage in application:
-- const nextNumber = await supabase.rpc('get_next_order_number', { p_parent_id: parentId });
```

**Partial Index for Soft Delete Queries:**
Optimize queries that filter out soft-deleted records:

```sql
-- Index for common query: active items by parent, ordered by creation
CREATE INDEX IF NOT EXISTS items_parent_created_idx
  ON public.items(parent_id, created_at DESC)
  WHERE deleted_at IS NULL;  -- Partial index excludes soft-deleted

-- Index for cleanup queries (finding soft-deleted records)
CREATE INDEX IF NOT EXISTS items_deleted_at_idx
  ON public.items(deleted_at)
  WHERE deleted_at IS NOT NULL;  -- Only index soft-deleted rows

-- Unique index that ignores soft-deleted (prevent duplicates among active only)
CREATE UNIQUE INDEX IF NOT EXISTS items_unique_key_idx
  ON public.items(unique_key, parent_id)
  WHERE deleted_at IS NULL;
```

### What Later Phases Should Do

1. **Use External API Client Pattern** - For any third-party API integration, follow the caching + rate limiting + custom error pattern
2. **Use Junction Tables with Auto-numbering** - For ordered many-to-many relationships
3. **Create Partial Indexes** - For soft delete tables, index with `WHERE deleted_at IS NULL`
4. **Define API Constants** - Create `src/lib/constants/your-feature.ts` with rate limits, TTLs, and API settings
5. **Handle External Rate Limits** - Check for `429` status and `Retry-After` header from external APIs
6. **Provide Cache Control** - Export `clearCache()` and `resetRateLimitState()` for testing

---

## Phase 6 Implementation Status

> **Note for Later Phases:** The following infrastructure patterns are **implemented in Phase 6** and should be reused by later phases.

### ✅ Implemented in Phase 6

| Item                     | Location                  | Notes                                                    |
| ------------------------ | ------------------------- | -------------------------------------------------------- |
| **Export Domain Logger** | `src/lib/logger.ts`       | `exportLogger()` following vaultLogger/aiLogger pattern. |
| **Export Module Barrel** | `src/lib/export/index.ts` | Barrel export for DOCX/PDF export functions.             |
| **Toast Store Barrel**   | `src/lib/stores/index.ts` | Re-exports `useToast` from hooks.                        |
| **Export Audit Events**  | API routes                | `export:docx`, `export:pdf` audit actions.               |

### When to Use Phase 6 Patterns

**Export Domain Logger:**

```typescript
import { exportLogger } from '@/lib/logger';

// In export API routes
const log = exportLogger({ userId: user.id, documentId, format: 'docx' });
log.info({ documentTitle: doc.title }, 'Document exported successfully');
log.warn('Document not found for export');
```

**Export Audit Events:**

```typescript
import { createAuditLog } from '@/lib/api/audit';

// Use 'export:format' pattern for export operations
await createAuditLog('export:docx', {
  userId: user.id,
  documentId,
  documentTitle: doc.title,
});

await createAuditLog('export:pdf', {
  userId: user.id,
  documentId,
  documentTitle: doc.title,
});
```

**Adding New Export Formats:**
When adding new export formats (e.g., Markdown, LaTeX):

1. Create `src/lib/export/<format>.ts` with export function
2. Add types to `src/lib/export/types.ts`
3. Update barrel export in `src/lib/export/index.ts`
4. Create API route at `src/app/api/export/<format>/route.ts`
5. Use `exportLogger` with `format: '<format>'`
6. Add audit event `export:<format>`

### What Later Phases Should Do

1. **Use exportLogger** - For any document export or file generation operations
2. **Use export module** - Import from `@/lib/export` for export functions
3. **Follow export API pattern** - Validation → Auth → Logger → Fetch → Authorize → Export → Audit
4. **Add export audit events** - Use `export:<format>` pattern for new export types

---

## Table of Contents

1. [Phase 0 Implementation Status](#phase-0-implementation-status)
2. [Phase 1 Implementation Status](#phase-1-implementation-status)
3. [Phase 2 Implementation Status](#phase-2-implementation-status)
4. [Phase 3 Implementation Status](#phase-3-implementation-status)
5. [Phase 4 Implementation Status](#phase-4-implementation-status)
6. [Phase 5 Implementation Status](#phase-5-implementation-status)
7. [Phase 6 Implementation Status](#phase-6-implementation-status)
8. [Docker Compose Structure](#docker-compose-structure)
9. [Dockerfile Patterns](#dockerfile-patterns)
10. [Environment Isolation](#environment-isolation)
11. [Health Checks](#health-checks)
12. [Logging Configuration](#logging-configuration)
13. [Resource Management](#resource-management)
14. [Backup & Restore](#backup--restore)
15. [Deployment Scripts](#deployment-scripts)
16. [Rollback Strategy](#rollback-strategy)
17. [Security Hardening](#security-hardening)
18. [Lessons Learned](#lessons-learned)

---

## Docker Compose Structure

> **⏳ Deferred:** Create these files when setting up Docker deployment. Phase 0 has already established the port isolation strategy (dev: 3000, test: 3088, prod: internal).

### Use Separate Compose Files for Each Environment

Maintain distinct configurations for development, testing, and production:

```
docker-compose.dev.yml    # Development with hot reload, exposed ports
docker-compose.test.yml   # Testing with isolated database, minimal services
docker-compose.prod.yml   # Production with security, resource limits
```

### Production Compose Template

```yaml
# docker-compose.prod.yml
services:
  # Database service
  database:
    image: postgres:16-alpine # Pin specific version
    container_name: myapp-database
    restart: unless-stopped
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER} -d ${DB_NAME}']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - internal
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
        compress: 'true'
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  # Application service
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    image: myapp:${APP_VERSION:-latest}
    container_name: myapp-app
    restart: unless-stopped
    expose:
      - '3000' # Internal only, not exposed to host
    depends_on:
      database:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://127.0.0.1:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - internal
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
        compress: 'true'
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  # Reverse proxy (Caddy/Nginx)
  proxy:
    image: caddy:2.7-alpine # Pin version
    container_name: myapp-proxy
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      app:
        condition: service_healthy
    networks:
      - internal
    deploy:
      resources:
        limits:
          memory: 256M

networks:
  internal:
    driver: bridge

volumes:
  db_data:
  caddy_data:
  caddy_config:
```

### Development Compose Differences

```yaml
# docker-compose.dev.yml
services:
  app:
    build:
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000' # Expose for direct access
    volumes:
      - .:/app # Mount source for hot reload
      - /app/node_modules # Exclude node_modules
      - /app/.next # Exclude build output
    environment:
      - NODE_ENV=development
      - WATCHPACK_POLLING=true # Enable polling for file changes

  # Local email testing
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - '1025:1025' # SMTP
      - '8025:8025' # Web UI
```

### Test Compose Minimal Setup

```yaml
# docker-compose.test.yml
services:
  database-test:
    image: postgres:16-alpine
    container_name: myapp-database-test
    ports:
      - '5433:5432' # Different port than dev
    volumes:
      - test_db_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=test_user
      - POSTGRES_PASSWORD=test_password
      - POSTGRES_DB=test_db
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  test_db_data:
```

---

## Dockerfile Patterns

> **⏳ Deferred:** Create Dockerfiles when setting up containerized deployment. **Prerequisite from Phase 0:** `output: 'standalone'` is already configured in `next.config.ts` - required for the multi-stage build below.

### Multi-Stage Production Build

```dockerfile
# Build stage - includes devDependencies
FROM node:20-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Build arguments for NEXT_PUBLIC_* (embedded at build time)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL

# Set as environment for the build
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copy package files first (layer caching)
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage - minimal runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Key Patterns

1. **Pin specific versions** - Use `node:20-alpine`, not `node:alpine` or `node:latest`
2. **Multi-stage builds** - Separate build and runtime stages
3. **Non-root user** - Create and run as a dedicated user
4. **Layer caching** - Copy package files before source code
5. **Frozen lockfile** - Use `--frozen-lockfile` to ensure reproducible builds
6. **Build args for public vars** - `NEXT_PUBLIC_*` must be available at build time

### Development Dockerfile

```dockerfile
# Dockerfile.dev - simpler for development
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (for caching)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install

# Copy source code
COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]
```

---

## Environment Isolation

> **✅ Phase 0 Status:** Port strategy and environment files are already implemented. See `playwright.config.ts` (port 3088), `.env.local.example`, and `.env.test`.

### Port Strategy

Use different ports for each environment to avoid conflicts:

| Environment | App Port | Database Port | Notes              |
| ----------- | -------- | ------------- | ------------------ |
| Development | 3000     | 5432          | Standard ports     |
| Test        | 3088     | 5433          | Non-conflicting    |
| Production  | Internal | Internal      | Only proxy exposed |

### Directory Strategy

Use separate build directories:

```bash
# Development
.next/           # Dev build output

# Test
.next-test/      # Test build output

# Production
# Built into Docker image, no local directory
```

### Environment Files

```
.env              # Development (gitignored)
.env.example      # Template (committed)
.env.test         # Test environment (gitignored or committed with safe values)
.env.production   # Production template (secrets in deployment system)
```

---

## Health Checks

> **✅ Phase 0 Status:** Health endpoint is fully implemented at `src/app/api/health/route.ts`. It returns status, timestamp, version, and database connectivity checks. Ready for Docker container health checks.

### Container Health Check Pattern

```yaml
healthcheck:
  test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://127.0.0.1:3000/api/health']
  interval: 30s # Time between checks
  timeout: 10s # Max time for check to complete
  retries: 3 # Failures before unhealthy
  start_period: 60s # Grace period for startup
```

### Application Health Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    external: await checkExternalServices(),
  };

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  const anyDegraded = Object.values(checks).some((c) => c.status === 'degraded');

  const status = allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy';

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || 'unknown',
      checks,
    },
    { status: status === 'unhealthy' ? 503 : 200 }
  );
}

async function checkDatabase(): Promise<{ status: string; latency?: number }> {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    return { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

### Health Check Best Practices

1. **Use lightweight checks** - Don't do expensive operations
2. **Include latency metrics** - Helps identify slow dependencies
3. **Distinguish degraded from unhealthy** - Partial failures vs complete outages
4. **Include version info** - Helps debug deployment issues
5. **Use appropriate timeouts** - Match container health check settings

---

## Logging Configuration

> **⏳ Deferred:** Implement structured logging (Pino) in Phase 1-2 when you need JSON logs for production. Docker logging limits apply when creating Docker Compose files.

### Docker Logging Limits

Prevent logs from consuming all disk space:

```yaml
logging:
  driver: 'json-file'
  options:
    max-size: '10m' # Max size per log file
    max-file: '3' # Keep 3 rotated files
    compress: 'true' # Compress rotated files
```

### Structured Logging

```typescript
// Use a structured logger like pino
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Add request ID, user context, etc.
});

// Log with context
logger.info({ userId, action: 'login' }, 'User authenticated');
logger.error({ error, requestId }, 'Request failed');
```

### Viewing Logs

```bash
# Follow all logs
docker compose -f docker-compose.prod.yml logs -f

# Follow specific service
docker compose -f docker-compose.prod.yml logs -f app

# Show last N lines
docker compose -f docker-compose.prod.yml logs --tail 100

# Filter by pattern
docker logs myapp-app 2>&1 | grep "error"
```

---

## Resource Management

> **⏳ Deferred:** Apply these limits when creating Docker Compose files for deployment.

### Memory Limits

Set both limits and reservations:

```yaml
deploy:
  resources:
    limits:
      memory: 1G # Hard limit
      cpus: '1.0' # CPU limit
    reservations:
      memory: 512M # Guaranteed minimum
```

### Recommended Limits by Service Type

| Service           | Memory Limit | Memory Reserved |
| ----------------- | ------------ | --------------- |
| Next.js App       | 1G           | 512M            |
| PostgreSQL        | 512M         | 256M            |
| Redis             | 256M         | 128M            |
| Caddy/Nginx       | 256M         | 128M            |
| Cloudflare Tunnel | 128M         | 64M             |

### Monitoring Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats myapp-app

# Resource usage per service
docker compose -f docker-compose.prod.yml stats
```

---

## Backup & Restore

> **⏳ Deferred:** Implement these patterns when setting up production operations. The `audit_logs` table from Phase 0 can help track backup/restore operations.

### Backup Script Pattern

```bash
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.tar.gz"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Creating backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# For SQLite-based systems: checkpoint WAL before backup
if docker ps --format '{{.Names}}' | grep -q "myapp-database"; then
    docker exec myapp-database sqlite3 /data/database.db "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
fi

# Find the data volume
VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep "myapp.*data" | head -1)

if [ -z "$VOLUME_NAME" ]; then
    echo -e "${RED}Error: Data volume not found${NC}"
    exit 1
fi

# Create backup using temporary container
docker run --rm \
    -v "$VOLUME_NAME:/data:ro" \
    -v "$BACKUP_DIR:/backup" \
    alpine \
    tar czf "/backup/$BACKUP_FILE" -C /data .

# Generate checksum
sha256sum "$BACKUP_DIR/$BACKUP_FILE" > "$BACKUP_DIR/${BACKUP_FILE}.sha256"

echo -e "${GREEN}Backup created: $BACKUP_FILE${NC}"

# Optional: Upload to S3
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/backups/"
    aws s3 cp "$BACKUP_DIR/${BACKUP_FILE}.sha256" "s3://$BACKUP_S3_BUCKET/backups/"
    echo -e "${GREEN}Uploaded to S3${NC}"
fi
```

### Restore Script Pattern

```bash
#!/bin/bash
set -euo pipefail

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

# Verify checksum if available
if [ -f "${BACKUP_FILE}.sha256" ]; then
    if sha256sum -c "${BACKUP_FILE}.sha256" --quiet; then
        echo "Checksum verified"
    else
        echo "Checksum failed! Backup may be corrupted."
        exit 1
    fi
fi

# Confirmation
read -p "This will REPLACE all data. Continue? (y/N) " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Find volume
VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep "myapp.*data" | head -1)

# Stop services
docker compose -f docker-compose.prod.yml down

# Create pre-restore backup (safety net)
PRE_RESTORE="pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz"
docker run --rm \
    -v "$VOLUME_NAME:/data:ro" \
    -v "$(pwd)/backups:/backup" \
    alpine \
    tar czf "/backup/$PRE_RESTORE" -C /data .

# Clear and restore
docker run --rm -v "$VOLUME_NAME:/data" alpine sh -c "rm -rf /data/*"
docker run --rm \
    -v "$VOLUME_NAME:/data" \
    -v "$(dirname "$BACKUP_FILE"):/backup:ro" \
    alpine \
    tar xzf "/backup/$(basename "$BACKUP_FILE")" -C /data

# Restart services
docker compose -f docker-compose.prod.yml up -d

echo "Restore complete!"
echo "Pre-restore backup saved: $PRE_RESTORE"
```

### Retention Policy

```bash
# Keep: 7 daily, 4 weekly, 3 monthly
BACKUP_KEEP_DAILY=7
BACKUP_KEEP_WEEKLY=4
BACKUP_KEEP_MONTHLY=3

# Run cleanup after backup
./scripts/backup.sh && ./scripts/backup-cleanup.sh
```

### Cron Schedule

```bash
# Daily backup at 3 AM with cleanup
0 3 * * * /path/to/myapp/scripts/backup.sh >> /var/log/myapp-backup.log 2>&1

# Weekly integrity check (restore to temp and verify)
0 4 * * 0 /path/to/myapp/scripts/verify-backup.sh >> /var/log/myapp-backup.log 2>&1
```

---

## Deployment Scripts

> **⏳ Deferred:** Implement when setting up production deployment. The `/api/health` endpoint from Phase 0 is ready for these scripts to use.

### Update Script Pattern

```bash
#!/bin/bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

echo "Starting update..."

# Step 1: Pre-update backup
echo "Creating backup..."
./scripts/backup.sh || { echo "Backup failed!"; exit 1; }

# Step 2: Pull latest code
if [ -d .git ]; then
    git fetch origin
    CURRENT=$(git rev-parse HEAD)
    LATEST=$(git rev-parse origin/main)

    if [ "$CURRENT" != "$LATEST" ]; then
        echo "Changes available:"
        git log --oneline "$CURRENT..$LATEST"
        read -p "Pull changes? (y/N) " -r
        [[ $REPLY =~ ^[Yy]$ ]] && git pull origin main
    fi
fi

# Step 3: Pull Docker images
docker compose -f "$COMPOSE_FILE" pull

# Step 4: Rebuild app
docker compose -f "$COMPOSE_FILE" build app

# Step 5: Stop and restart
docker compose -f "$COMPOSE_FILE" down
docker compose -f "$COMPOSE_FILE" up -d

# Step 6: Health check
MAX_RETRIES=24
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "http://localhost:3000/api/health" > /dev/null; then
        echo "Application is healthy!"
        exit 0
    fi
    echo "Waiting for application... ($i/$MAX_RETRIES)"
    sleep 5
done

echo "Health check failed!"
echo "Consider rolling back: ./scripts/rollback.sh"
exit 1
```

---

## Rollback Strategy

> **⏳ Deferred:** Implement when setting up production deployment and backup/restore.

### Rollback Script Pattern

```bash
#!/bin/bash
set -euo pipefail

echo "ROLLBACK PROCEDURE"
echo "=================="

# Step 1: Select backup
echo "Available backups:"
ls -lht backups/*.tar.gz | head -10

read -p "Enter backup filename (or 'latest'): " BACKUP_INPUT
if [ "$BACKUP_INPUT" = "latest" ]; then
    BACKUP_FILE=$(ls -t backups/*.tar.gz | head -1)
else
    BACKUP_FILE="backups/$BACKUP_INPUT"
fi

# Step 2: Select code version (optional)
if [ -d .git ]; then
    echo "Recent versions:"
    git log --oneline -5
    read -p "Enter version (or 'skip'): " VERSION_INPUT
fi

# Step 3: Confirm
echo "This will:"
echo "  - Restore database from: $(basename "$BACKUP_FILE")"
[ -n "${VERSION_INPUT:-}" ] && [ "$VERSION_INPUT" != "skip" ] && \
    echo "  - Revert code to: $VERSION_INPUT"

read -p "Type 'ROLLBACK' to confirm: " CONFIRM
[ "$CONFIRM" != "ROLLBACK" ] && exit 0

# Step 4: Execute rollback
docker compose -f docker-compose.prod.yml down

# Restore database
./scripts/restore.sh "$BACKUP_FILE"

# Revert code if specified
if [ -n "${VERSION_INPUT:-}" ] && [ "$VERSION_INPUT" != "skip" ]; then
    git checkout "$VERSION_INPUT"
    docker compose -f docker-compose.prod.yml build app
fi

# Restart
docker compose -f docker-compose.prod.yml up -d

echo "Rollback complete!"
```

### Rollback Best Practices

1. **Always backup before update** - Makes rollback possible
2. **Tag releases** - Easy to identify what to rollback to
3. **Keep last N images** - Don't immediately prune old images
4. **Test rollback procedure** - Practice before you need it
5. **Document what changed** - Know what the rollback affects

---

## Security Hardening

> **✅ Phase 0 Status:** Database-level security is implemented via RLS policies on all tables. The `audit_logs` table is ready for security tracking. Container-level security (non-root user, read-only filesystem) should be applied when creating Dockerfiles.

### Container Security

```dockerfile
# Run as non-root
RUN addgroup --system app && adduser --system --group app
USER app

# Read-only filesystem where possible
# In docker-compose.yml:
# read_only: true
# tmpfs:
#   - /tmp
```

### Network Security

```yaml
# Production: don't expose ports to host
services:
  app:
    expose:
      - '3000' # Internal only
    # NOT: ports: - "3000:3000"

  proxy:
    ports:
      - '80:80'
      - '443:443'
```

### Secrets Management

```yaml
# Use environment variables for secrets
environment:
  - DATABASE_URL=${DATABASE_URL}

# Or Docker secrets (swarm mode)
secrets:
  db_password:
    external: true
```

### Volume Security

```yaml
volumes:
  # Read-only where possible
  - ./config:/app/config:ro
  - ./migrations:/migrations:ro
```

---

## Lessons Learned

> **✅ Phase 0 Status:** Several lessons are already applied: LF line endings (#8) via `.gitattributes`, health verification (#10) via `/api/health` endpoint.

### 1. Pin All Image Versions

```yaml
# WRONG - unpredictable updates
image: caddy:alpine

# CORRECT - reproducible builds
image: caddy:2.7.6-alpine
```

### 2. Use `expose` Not `ports` for Internal Services

```yaml
# WRONG - exposes to host
ports:
  - '3000:3000'

# CORRECT - internal only
expose:
  - '3000'
```

### 3. Always Set Resource Limits

Without limits, one container can consume all system resources.

### 4. Use Health Check Dependencies

```yaml
depends_on:
  database:
    condition: service_healthy # Not just service_started
```

### 5. Checkpoint SQLite Before Backup

For SQLite databases, checkpoint the WAL before backup:

```bash
sqlite3 /data/database.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### 6. Create Pre-Operation Backups

Always backup before updates, restores, or any destructive operation.

### 7. Generate Checksums for Backups

Verify integrity before restore:

```bash
sha256sum backup.tar.gz > backup.tar.gz.sha256
sha256sum -c backup.tar.gz.sha256  # Verify
```

### 8. Keep Unix Line Endings in Scripts ✅ (Done in Phase 0)

> **Already implemented:** `.gitattributes` configured in Phase 0 Task 0.1.

Windows CRLF breaks bash scripts:

```bash
# Fix in .gitattributes
*.sh text eol=lf

# Or manually
sed -i 's/\r$//' script.sh
```

### 9. Use Colored Output in Scripts

Improves readability:

```bash
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Success${NC}"
echo -e "${RED}Error${NC}"
```

### 10. Verify Health After Every Operation ✅ (Endpoint Ready from Phase 0)

> **Already implemented:** `/api/health` endpoint created in Phase 0 Task 0.10. The verification pattern below can be used immediately.

```bash
# Wait for health check
MAX_RETRIES=24
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "http://localhost:3000/api/health" > /dev/null; then
        echo "Healthy!"
        exit 0
    fi
    sleep 5
done
echo "Health check failed!"
exit 1
```

### 11. Log Container Startup Clearly

```bash
echo "================================"
echo "Starting MyApp"
echo "Timestamp: $(date)"
echo "Version: ${APP_VERSION:-unknown}"
echo "================================"
```

### 12. Provide Clear Error Messages

```bash
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Error: docker-compose.prod.yml not found${NC}"
    echo "Make sure you're in the project root directory"
    exit 1
fi
```

### 13. Use Confirmation Prompts for Destructive Operations

```bash
echo -e "${RED}WARNING: This will DELETE all data!${NC}"
read -p "Type 'DELETE' to confirm: " CONFIRM
[ "$CONFIRM" != "DELETE" ] && exit 0
```

### 14. Document the Full Recovery Procedure

Create a step-by-step disaster recovery guide and test it regularly.

### 15. Use Cloudflare Tunnel for Zero-Port Exposure

```yaml
# No ports exposed to internet
cloudflared:
  image: cloudflare/cloudflared:2024.12.2
  command: tunnel run
  volumes:
    - ./cloudflared-config.yml:/etc/cloudflared/config.yml:ro
```

---

## Quick Reference

### Common Commands

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Check health
curl http://localhost:3000/api/health

# Resource usage
docker stats

# Enter container shell
docker exec -it myapp-app sh

# Rebuild single service
docker compose -f docker-compose.prod.yml build app

# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Clean up unused resources
docker system prune -f
```

### Deployment Workflow

```bash
# 1. Backup
./scripts/backup.sh

# 2. Pull and update
git pull origin main
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml build app

# 3. Restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# 4. Verify
curl http://localhost:3000/api/health

# 5. If issues, rollback
./scripts/rollback.sh
```
