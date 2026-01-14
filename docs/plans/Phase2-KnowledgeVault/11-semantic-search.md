# Task 2.10: Semantic Search (TDD)

> **Phase 2** | [← Extraction Processor](./10-extraction-processor.md) | [Next: VaultSearch Component →](./12-vault-search-component.md)

---

## Context

**This task creates the semantic search functionality using pgvector.** It includes a database function for efficient similarity search and an API with Zod validation.

> **Design System:** This task is backend search. The VaultSearch component that consumes this API follows the "Scholarly Craft" aesthetic documented in [`docs/design-system.md`](../../design-system.md).

### Prerequisites

- **Task 2.9** completed (chunks are embedded and stored)

### What This Task Creates

- `supabase/migrations/YYYYMMDDHHMMSS_search_function.sql` - pgvector search function
- `src/lib/api/__tests__/search.test.ts` - 2 unit tests
- `src/lib/api/search.ts` - Search API helper
- `src/app/api/vault/search/route.ts` - Search endpoint with Zod

### Tasks That Depend on This

- **Task 2.11** (VaultSearch Component) - uses this API

---

## Files to Create/Modify

- `supabase/migrations/YYYYMMDDHHMMSS_search_function.sql` (create)
- `src/lib/api/__tests__/search.test.ts` (create)
- `src/lib/api/search.ts` (create)
- `src/app/api/vault/search/route.ts` (create)

---

## Steps

### Step 1: Create search database function with user check

Create `supabase/migrations/YYYYMMDDHHMMSS_search_function.sql`:

```sql
-- Create semantic search function with user ownership check
create or replace function search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid,
  p_user_id uuid
)
returns table (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text,
  chunk_index int
)
language sql stable
security definer
as $$
  select
    vc.content,
    (1 - (vc.embedding <=> query_embedding))::float as similarity,
    vc.vault_item_id,
    vi.filename,
    vc.chunk_index
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and vi.user_id = p_user_id
    and (1 - (vc.embedding <=> query_embedding)) > match_threshold
  order by vc.embedding <=> query_embedding
  limit match_count;
$$;

comment on function search_vault_chunks is 'Semantic search over vault chunks with user ownership verification';
```

---

### Step 2: Apply migration

```bash
npx supabase db reset
```

**Expected:** Migration applies successfully

---

### Step 3: Generate types

```bash
npm run db:types
```

**Expected:** Types regenerated

---

### Step 4: Write failing tests for search

Create `src/lib/api/__tests__/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchVault } from '../search';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          content: 'Relevant content about the topic',
          similarity: 0.85,
          vault_item_id: 'item-1',
          filename: 'research.pdf',
          chunk_index: 0,
        },
      ],
      error: null,
    }),
  })),
}));

vi.mock('@/lib/extraction/embeddings', () => ({
  getEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
}));

describe('Vault Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns search results with correct structure', async () => {
    const results = await searchVault('project-1', 'machine learning');

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('content');
    expect(results[0]).toHaveProperty('similarity');
    expect(results[0]).toHaveProperty('vaultItemId');
    expect(results[0]).toHaveProperty('filename');
    expect(results[0]).toHaveProperty('chunkIndex');
  });

  it('returns empty array for no matches', async () => {
    vi.mocked((await import('@/lib/supabase/server')).createClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }) },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const results = await searchVault('project-1', 'obscure query');
    expect(results).toEqual([]);
  });
});
```

---

### Step 5: Run tests to verify they fail

```bash
npm test src/lib/api/__tests__/search.test.ts
```

**Expected:** FAIL - Cannot find module '../search'

---

### Step 6: Implement search API

Create `src/lib/api/search.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/extraction/embeddings';
import { vaultLogger } from '@/lib/logger';
import type { SearchResult } from '@/lib/vault/types';

// Type for the RPC function response
interface SearchVaultChunksRow {
  content: string;
  similarity: number;
  vault_item_id: string;
  filename: string;
  chunk_index: number;
}

export async function searchVault(
  projectId: string,
  query: string,
  limit = 5,
  threshold = parseFloat(process.env.VAULT_SEARCH_THRESHOLD || '0.7')
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const log = vaultLogger({ userId: user.id, projectId });
  log.info({ query: query.substring(0, 50), limit, threshold }, 'Executing vault search');

  const queryEmbedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('search_vault_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    p_project_id: projectId,
    p_user_id: user.id,
  });

  if (error) {
    log.error({ error }, 'Search failed');
    throw new Error(`Search failed: ${error.message}`);
  }

  const results = ((data as SearchVaultChunksRow[]) || []).map((row) => ({
    content: row.content,
    similarity: row.similarity,
    vaultItemId: row.vault_item_id,
    filename: row.filename,
    chunkIndex: row.chunk_index,
  }));

  log.info({ resultCount: results.length }, 'Search completed');
  return results;
}
```

---

### Step 7: Run tests to verify they pass

```bash
npm test src/lib/api/__tests__/search.test.ts
```

**Expected:** PASS - 2 tests passed

---

### Step 8: Create search API route with Zod validation

Create `src/app/api/vault/search/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { searchVault } from '@/lib/api/search';
import { handleApiError } from '@/lib/api';
import { vaultLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const searchSchema = z.object({
  projectId: z.string().uuid(),
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

const logger = vaultLogger({});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = searchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request', details: parseResult.error.flatten() }, { status: 400 });
    }

    const { projectId, query, limit, threshold } = parseResult.data;

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const results = await searchVault(projectId, query, limit, threshold);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error, logger, 'Search route error');
  }
}
```

---

### Step 9: Install Zod if not present

```bash
npm install zod
```

**Expected:** Package installed (or already present)

---

### Step 10: Commit search functionality

```bash
git add supabase/migrations/ src/lib/api/ src/app/api/vault/search/
git commit -m "feat: add semantic search with Zod validation and user ownership (TDD)"
```

---

## Verification Checklist

- [ ] Migration created and applied
- [ ] Types regenerated
- [ ] `src/lib/api/__tests__/search.test.ts` exists with 2 tests
- [ ] `src/lib/api/search.ts` exists
- [ ] `src/app/api/vault/search/route.ts` exists
- [ ] All tests pass
- [ ] Search function includes user ownership check
- [ ] API route validates input with Zod
- [ ] API route uses `handleApiError` pattern
- [ ] Threshold configurable via `VAULT_SEARCH_THRESHOLD` env var
- [ ] RPC response properly typed (no `any`)
- [ ] Uses structured logger (pino) instead of console.log
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.11: VaultSearch Component](./12-vault-search-component.md)**.
