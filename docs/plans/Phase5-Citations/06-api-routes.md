# Tasks 5.21-5.23: API Routes

> **Phase 5** | [← Citations API Helpers](./05-citations-api-helpers.md) | [Next: UI Components →](./07-ui-components.md)

---

## Context

**This task creates Next.js API routes for citation operations.** These routes expose the citation helpers as HTTP endpoints.

### Prerequisites

- **Tasks 5.17-5.20** completed (Citations API helpers)

### What This Task Creates

- `src/app/api/citations/route.ts` - list/create endpoints
- `src/app/api/citations/[id]/route.ts` - single citation CRUD
- `src/app/api/citations/search/route.ts` - paper search endpoint
- `src/app/api/citations/__tests__/route.test.ts` - route tests

### Tasks That Depend on This

- **Tasks 5.24-5.32** (UI Components) - call these endpoints

### Best Practices Applied

- **Next.js 16 Async Params** - Route params are `Promise<{}>` and must be awaited (Best Practice: Phase 4)
- **Error Response Helpers** - Use `validationError()`, `serverError()` etc. from `@/lib/api/error-response` (Best Practice: Phase 4)
- **handleApiError Pattern** - Use established error handler in catch blocks (Best Practice: Phase 1)
- **Server-Side Rate Limiting** - Use `@/lib/rate-limit` for API protection (Best Practice: Phase 4)

### Design System Context

API responses are consumed by UI components that follow the Scholarly Craft design system:

| Endpoint                   | UI Consumer        | Design System Application                                |
| -------------------------- | ------------------ | -------------------------------------------------------- |
| GET /api/citations         | `CitationList`     | Cards with `bg-surface`, `border-ink-faint`, `shadow-sm` |
| GET /api/citations/search  | `CitationSearch`   | Results grid with `gap-4`, card hover states             |
| POST /api/citations        | Toast notification | `bg-success-light text-success` for success              |
| DELETE /api/citations/[id] | `ConfirmDialog`    | Uses `bg-error`, destructive button variant              |

Error responses (400, 429, 500) trigger alert components styled with `bg-error-light border-error text-error-dark`.

---

## Files to Create

- `src/app/api/citations/__tests__/route.test.ts` (create)
- `src/app/api/citations/route.ts` (create)
- `src/app/api/citations/[id]/route.ts` (create)
- `src/app/api/citations/search/route.ts` (create)

---

## Task 5.21: Citations List Tests (RED)

### Step 1: Write failing route handler tests

Create `src/app/api/citations/__tests__/route.test.ts`:

```typescript
// src/app/api/citations/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';

vi.mock('@/lib/api/citations', () => ({
  getCitations: vi.fn(),
  createCitation: vi.fn(),
  createCitationFromPaper: vi.fn(),
  isDuplicateCitation: vi.fn(),
}));

import { getCitations, createCitation, createCitationFromPaper, isDuplicateCitation } from '@/lib/api/citations';

describe('GET /api/citations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when projectId missing', async () => {
    const request = new Request('http://localhost/api/citations');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('projectId');
  });

  it('should return citations for valid projectId', async () => {
    const mockCitations = [{ id: '1', title: 'Test' }];
    (getCitations as any).mockResolvedValue(mockCitations);

    const request = new Request('http://localhost/api/citations?projectId=proj-1');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockCitations);
  });

  it('should return 500 on database error', async () => {
    (getCitations as any).mockRejectedValue(new Error('DB Error'));

    const request = new Request('http://localhost/api/citations?projectId=proj-1');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe('POST /api/citations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when projectId missing', async () => {
    const request = new Request('http://localhost/api/citations', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 409 for duplicate citation', async () => {
    (isDuplicateCitation as any).mockResolvedValue({
      isDuplicate: true,
      existingId: 'existing-123',
    });

    const request = new Request('http://localhost/api/citations', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'proj-1',
        paper: { paperId: 'existing', title: 'Test', authors: [], year: 2024, url: '' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.existingId).toBe('existing-123');
  });

  it('should return 201 with created citation', async () => {
    (isDuplicateCitation as any).mockResolvedValue({ isDuplicate: false });
    (createCitationFromPaper as any).mockResolvedValue({ id: 'new-id', title: 'Test' });

    const request = new Request('http://localhost/api/citations', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'proj-1',
        paper: { paperId: 'new', title: 'Test', authors: [], year: 2024, url: '' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test src/app/api/citations/__tests__/route.test.ts
```

**Expected:** FAIL (route not found)

### Step 3: Commit

```bash
git add src/app/api/citations/__tests__/route.test.ts
git commit -m "test(api): add failing citations route tests (RED)"
```

---

## Task 5.22: Citations List Implementation (GREEN)

### Step 1: Implement route handlers

Create `src/app/api/citations/route.ts`:

```typescript
// src/app/api/citations/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCitations, createCitation, createCitationFromPaper, isDuplicateCitation } from '@/lib/api/citations';
import { createCitationRequestSchema } from '@/lib/citations/schemas';
import { citationLogger } from '@/lib/citations/logger';
import { validationError, serverError } from '@/lib/api/error-response';
import { handleApiError } from '@/lib/api/handle-error';

const log = citationLogger({});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return validationError({ fieldErrors: { projectId: ['projectId is required'] } });
  }

  // Validate projectId is a valid UUID (Best Practice: Validation §3)
  const uuidSchema = z.string().uuid();
  const uuidResult = uuidSchema.safeParse(projectId);
  if (!uuidResult.success) {
    return validationError(uuidResult.error);
  }

  try {
    const citations = await getCitations(projectId);
    return NextResponse.json(citations);
  } catch (error) {
    return handleApiError(error, log, 'Failed to fetch citations');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body with Zod (Best Practice: Validation §3)
    const validationResult = createCitationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const { projectId, paper, ...manualCitation } = validationResult.data;

    if (paper) {
      const { isDuplicate, existingId } = await isDuplicateCitation(projectId, paper);
      if (isDuplicate) {
        return NextResponse.json({ error: 'Citation already exists', code: 'DUPLICATE', existingId }, { status: 409 });
      }
      const citation = await createCitationFromPaper(projectId, paper);
      log.info({ citationId: citation.id, projectId }, 'Citation created from paper');
      return NextResponse.json(citation, { status: 201 });
    }

    const citation = await createCitation({
      project_id: projectId,
      ...manualCitation,
      source: 'user_added',
      verified: !!manualCitation.doi,
    });
    log.info({ citationId: citation.id, projectId }, 'Manual citation created');
    return NextResponse.json(citation, { status: 201 });
  } catch (error) {
    return handleApiError(error, log, 'Failed to create citation');
  }
}
```

### Step 2: Run tests to verify they pass

```bash
npm test src/app/api/citations/__tests__/route.test.ts
```

**Expected:** All tests PASS

### Step 3: Commit

```bash
git add src/app/api/citations/route.ts
git commit -m "feat(api): implement citations list endpoint (GREEN)"
```

---

## Task 5.23: Single Citation & Search Routes

### Step 1: Implement single citation route

Create `src/app/api/citations/[id]/route.ts`:

```typescript
// src/app/api/citations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCitation, updateCitation, deleteCitation } from '@/lib/api/citations';
import { updateCitationRequestSchema } from '@/lib/citations/schemas';
import { citationLogger } from '@/lib/citations/logger';
import { validationError, notFoundError } from '@/lib/api/error-response';
import { handleApiError } from '@/lib/api/handle-error';

// Validate UUID parameter (Best Practice: Validation §3)
const uuidSchema = z.string().uuid();

// IMPORTANT: Next.js 16 requires params to be a Promise (Best Practice: Phase 4)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Must await params in Next.js 16
  const log = citationLogger({ citationId: id });

  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return validationError(idResult.error);
  }

  try {
    const citation = await getCitation(id);
    if (!citation) {
      return notFoundError('Citation');
    }
    return NextResponse.json(citation);
  } catch (error) {
    return handleApiError(error, log, 'Failed to fetch citation');
  }
}

// IMPORTANT: Next.js 16 requires params to be a Promise (Best Practice: Phase 4)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Must await params in Next.js 16
  const log = citationLogger({ citationId: id });

  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return validationError(idResult.error);
  }

  try {
    const body = await request.json();

    // Validate updates with Zod (Best Practice: Validation §3)
    const validationResult = updateCitationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const citation = await updateCitation(id, validationResult.data);
    log.info({ updates: Object.keys(validationResult.data) }, 'Citation updated');
    return NextResponse.json(citation);
  } catch (error) {
    return handleApiError(error, log, 'Failed to update citation');
  }
}

// IMPORTANT: Next.js 16 requires params to be a Promise (Best Practice: Phase 4)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Must await params in Next.js 16
  const log = citationLogger({ citationId: id });

  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return validationError(idResult.error);
  }

  try {
    await deleteCitation(id);
    log.info('Citation soft-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, log, 'Failed to delete citation');
  }
}
```

### Step 2: Implement search route

Create `src/app/api/citations/search/route.ts`:

```typescript
// src/app/api/citations/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchPapersWithCache } from '@/lib/citations/semantic-scholar';
import { SemanticScholarError } from '@/lib/citations/types';
import { searchQuerySchema } from '@/lib/citations/schemas';
import { citationLogger } from '@/lib/citations/logger';
import { rateLimit } from '@/lib/rate-limit';
import { validationError, rateLimitError } from '@/lib/api/error-response';
import { handleApiError } from '@/lib/api/handle-error';
import { createClient } from '@/lib/supabase/server';

const log = citationLogger({});

// Server-side rate limiting (Best Practice: Phase 4)
// 30 requests per minute per user, separate from Semantic Scholar's limits
const rateLimitSearch = rateLimit({ limit: 30, window: 60 });

export async function GET(request: NextRequest) {
  // Get user for rate limiting (anonymous users use IP-based limiting)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rateLimitKey = user?.id || request.headers.get('x-forwarded-for') || 'anonymous';

  // Check server-side rate limit first (Best Practice: Phase 4)
  const rateLimitResult = await rateLimitSearch(rateLimitKey);
  if (!rateLimitResult.success) {
    return rateLimitError(rateLimitResult.retryAfter!);
  }

  const { searchParams } = new URL(request.url);

  // Validate query parameters with Zod (Best Practice: Validation §3)
  const validationResult = searchQuerySchema.safeParse({
    q: searchParams.get('q'),
    limit: searchParams.get('limit'),
  });

  if (!validationResult.success) {
    return validationError(validationResult.error);
  }

  const { q: query, limit } = validationResult.data;

  try {
    const papers = await searchPapersWithCache(query, limit);
    log.info({ query, resultCount: papers.length }, 'Citation search completed');
    return NextResponse.json({ papers, total: papers.length });
  } catch (error) {
    // Handle Semantic Scholar rate limiting separately
    if (error instanceof SemanticScholarError && error.code === 'RATE_LIMITED') {
      return rateLimitError(error.retryAfter || 60);
    }
    return handleApiError(error, log, 'Citation search failed');
  }
}
```

### Step 3: Commit

```bash
git add src/app/api/citations/[id]/route.ts src/app/api/citations/search/route.ts
git commit -m "feat(api): add single citation and search endpoints"
```

---

## API Reference

### GET /api/citations

List all citations for a project.

**Query Parameters:**

- `projectId` (required) - Project UUID

**Response:** `Citation[]`

### POST /api/citations

Create a new citation.

**Body:**

```json
{
  "projectId": "uuid",
  "paper": {
    /* Paper object for AI-fetched */
  },
  // OR manual fields:
  "title": "string",
  "authors": "string",
  "year": 2024,
  "doi": "string"
}
```

**Response:** `Citation` (201 Created)

### GET /api/citations/[id]

Get a single citation.

**Response:** `Citation` or 404

### PATCH /api/citations/[id]

Update a citation.

**Body:** Partial citation fields

**Response:** `Citation`

### DELETE /api/citations/[id]

Delete a citation.

**Response:** `{ success: true }`

### GET /api/citations/search

Search Semantic Scholar.

**Query Parameters:**

- `q` (required) - Search query
- `limit` (optional, default: 10)

**Response:** `{ papers: Paper[], total: number }`

---

## E2E Tests

> **IMPORTANT**: API routes should be tested with E2E tests to verify authentication, authorization, and real database interactions.

### Step 1: Create API E2E tests

Create `e2e/citations/citations-api.spec.ts`:

```typescript
// e2e/citations/citations-api.spec.ts
// CRITICAL: Import from test-fixtures, NOT from @playwright/test (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citations API', () => {
  test.describe('Authentication', () => {
    test('GET /api/citations returns 401 for unauthenticated requests', async ({ request }) => {
      const response = await request.get('/api/citations?projectId=test-uuid');
      expect(response.status()).toBe(401);
    });

    test('POST /api/citations returns 401 for unauthenticated requests', async ({ request }) => {
      const response = await request.post('/api/citations', {
        data: { projectId: 'test-uuid', title: 'Test' },
      });
      expect(response.status()).toBe(401);
    });

    test('DELETE /api/citations/[id] returns 401 for unauthenticated requests', async ({ request }) => {
      const response = await request.delete('/api/citations/test-uuid');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('CRUD Operations', () => {
    test('user can create and retrieve citation', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Create citation via API
      const createResponse = await page.request.post('/api/citations', {
        data: {
          projectId: workerCtx.projectId,
          title: 'E2E Test Citation',
          authors: 'Test Author',
          year: 2024,
        },
      });
      expect(createResponse.ok()).toBe(true);
      const created = await createResponse.json();
      expect(created.id).toBeDefined();

      // Retrieve citation
      const getResponse = await page.request.get(`/api/citations/${created.id}`);
      expect(getResponse.ok()).toBe(true);
      const retrieved = await getResponse.json();
      expect(retrieved.title).toBe('E2E Test Citation');
    });

    test('user can update citation', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Create then update
      const createResponse = await page.request.post('/api/citations', {
        data: {
          projectId: workerCtx.projectId,
          title: 'Original Title',
          authors: 'Author',
          year: 2024,
        },
      });
      const created = await createResponse.json();

      const updateResponse = await page.request.patch(`/api/citations/${created.id}`, {
        data: { title: 'Updated Title' },
      });
      expect(updateResponse.ok()).toBe(true);
      const updated = await updateResponse.json();
      expect(updated.title).toBe('Updated Title');
    });

    test('user can delete citation (soft delete)', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Create then delete
      const createResponse = await page.request.post('/api/citations', {
        data: {
          projectId: workerCtx.projectId,
          title: 'To Delete',
          authors: 'Author',
          year: 2024,
        },
      });
      const created = await createResponse.json();

      const deleteResponse = await page.request.delete(`/api/citations/${created.id}`);
      expect(deleteResponse.ok()).toBe(true);

      // Should not appear in list after soft delete
      const listResponse = await page.request.get(`/api/citations?projectId=${workerCtx.projectId}`);
      const list = await listResponse.json();
      expect(list.find((c: any) => c.id === created.id)).toBeUndefined();
    });
  });

  test.describe('Rate Limiting', () => {
    test('search endpoint returns 429 after too many requests', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Make many rapid requests to trigger rate limit
      const requests = [];
      for (let i = 0; i < 35; i++) {
        requests.push(page.request.get(`/api/citations/search?q=test${i}`));
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some((r) => r.status() === 429);

      // At least one request should be rate limited
      expect(rateLimited).toBe(true);
    });
  });
});
```

### Step 2: Run E2E tests

```bash
npm run test:e2e e2e/citations/citations-api.spec.ts
```

### Step 3: Commit

```bash
git add e2e/citations/citations-api.spec.ts
git commit -m "test(e2e): add citations API E2E tests"
```

---

## E2E Verification

Before proceeding to the next task, ensure these E2E tests pass:

```bash
npm run test:e2e e2e/citations/citations-api.spec.ts
```

**Expected Results:**

- [ ] All authentication tests pass (401 for unauthenticated)
- [ ] CRUD operations work correctly with authenticated user
- [ ] Rate limiting triggers 429 response
- [ ] No test failures or timeouts

---

### Additional E2E Tests - Authorization

Add to `e2e/citations/citations-api.spec.ts`:

```typescript
test.describe('Authorization', () => {
  test('user cannot GET another user citations', async ({ request, workerCtx }) => {
    // Create citation as user A
    // Try to access as user B
    // Verify 403 forbidden
  });

  test('user cannot DELETE another user citation', async ({ request, workerCtx }) => {
    // Similar pattern
  });

  test('duplicate citation returns 409 with existingId', async ({ request, workerCtx }) => {
    // Create citation
    // Try to create same citation again
    // Verify 409 with existingId in response
  });
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/citations/citations-api.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 5.7.

---

## Verification Checklist

- [ ] `src/app/api/citations/route.ts` exists
- [ ] `src/app/api/citations/[id]/route.ts` exists
- [ ] `src/app/api/citations/search/route.ts` exists
- [ ] All route tests pass
- [ ] GET /api/citations works
- [ ] POST /api/citations works
- [ ] GET /api/citations/[id] works
- [ ] PATCH /api/citations/[id] works
- [ ] DELETE /api/citations/[id] works
- [ ] GET /api/citations/search works
- [ ] Server-side rate limiting returns 429
- [ ] Zod validation on all endpoints
- [ ] Uses `validationError()`, `notFoundError()`, `rateLimitError()` helpers
- [ ] Uses `handleApiError()` pattern in catch blocks
- [ ] Uses `citationLogger()` domain logger
- [ ] Next.js 16 async params pattern used (params awaited)
- [ ] **E2E Tests**: `e2e/citations/citations-api.spec.ts` exists and passes
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Tasks 5.24-5.32: UI Components](./07-ui-components.md)**.
