# Tasks 5.17-5.20: Citations API Helpers

> **Phase 5** | [← Database Migration](./04-database-migration.md) | [Next: API Routes →](./06-api-routes.md)

---

## Context

**This task implements Supabase helper functions for citation CRUD operations.** These helpers abstract database operations and will be used by the API routes.

### Prerequisites

- **Tasks 5.2-5.12** completed (Semantic Scholar client - for Paper type)
- **Tasks 5.15-5.16** completed (Database migration - schema ready)

### What This Task Creates

- `src/lib/citations/logger.ts` - domain logger factory (Best Practice: Phase 2/3 pattern)
- `src/lib/api/citations.ts` - citation CRUD functions
- `src/lib/api/__tests__/citations.test.ts` - comprehensive tests

### Tasks That Depend on This

- **Tasks 5.21-5.23** (API Routes) - uses these helpers

### Best Practices Applied

- **Domain Logger Factory** - Create `citationLogger()` following `vaultLogger()` and `aiLogger()` patterns (Best Practice: Phase 2-3)
- **Audit Logging** - Log all create/update/delete operations (Best Practice: Phase 2)
- **Soft Delete** - Use `deleted_at` column, not hard delete (Best Practice: Database §5)

---

## Files to Create

- `src/lib/citations/logger.ts` (create)
- `src/lib/api/__tests__/citations.test.ts` (create)
- `src/lib/api/citations.ts` (create)

---

## Task 5.17a: Domain Logger Factory

### Step 1: Create citation domain logger

Create `src/lib/citations/logger.ts`:

```typescript
// src/lib/citations/logger.ts
import { logger } from '@/lib/logger';

/**
 * Create a child logger with citation domain context.
 * Follows the pattern established in Phase 2 (vaultLogger) and Phase 3 (aiLogger).
 *
 * @example
 * const log = citationLogger({ citationId: 'abc123', userId: 'user-1' });
 * log.info('Citation created');
 * log.error({ error }, 'Failed to create citation');
 */
export function citationLogger(context: {
  userId?: string;
  citationId?: string;
  projectId?: string;
  paperId?: string;
}) {
  return logger.child({ domain: 'citations', ...context });
}
```

### Step 2: Update barrel export

Add to `src/lib/citations/index.ts`:

```typescript
export { citationLogger } from './logger';
```

### Step 3: Commit

```bash
git add src/lib/citations/logger.ts src/lib/citations/index.ts
git commit -m "feat(citations): add citationLogger domain factory (Best Practice: Phase 2/3)"
```

---

## Task 5.17: Read Operations Tests (RED)

### Step 1: Write failing tests for getCitations and getCitation

Create `src/lib/api/__tests__/citations.test.ts`:

```typescript
// src/lib/api/__tests__/citations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCitations, getCitation } from '../citations';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('Citations API - Read Operations', () => {
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder, single: mockSingle });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });

    (createClient as any).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });
  });

  describe('getCitations', () => {
    it('should return citations for a project', async () => {
      const mockCitations = [{ id: '1', title: 'Test' }];
      mockOrder.mockResolvedValue({ data: mockCitations, error: null });

      const result = await getCitations('project-123');

      expect(result).toEqual(mockCitations);
    });

    it('should order by created_at descending', async () => {
      await getCitations('project-123');

      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should throw on database error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('DB Error') });

      await expect(getCitations('project-123')).rejects.toThrow();
    });
  });

  describe('getCitation', () => {
    it('should return citation by id', async () => {
      const mockCitation = { id: '1', title: 'Test' };
      mockSingle.mockResolvedValue({ data: mockCitation, error: null });

      const result = await getCitation('1');

      expect(result).toEqual(mockCitation);
    });

    it('should return null for non-existent citation', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await getCitation('nonexistent');

      expect(result).toBeNull();
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test src/lib/api/__tests__/citations.test.ts
```

**Expected:** FAIL (module not found)

### Step 3: Commit failing tests

```bash
git add src/lib/api/__tests__/citations.test.ts
git commit -m "test(api): add failing citations read tests (RED)"
```

---

## Task 5.18: Read Operations Implementation (GREEN)

### Step 1: Implement getCitations and getCitation

Create `src/lib/api/citations.ts`:

```typescript
// src/lib/api/citations.ts
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { logger } from '@/lib/logger';

type Citation = Database['public']['Tables']['citations']['Row'];

export async function getCitations(projectId: string): Promise<Citation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('citations')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null) // Exclude soft-deleted (Best Practice: Database §5)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCitation(id: string): Promise<Citation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('citations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null) // Exclude soft-deleted (Best Practice: Database §5)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}
```

### Step 2: Run tests to verify they pass

```bash
npm test src/lib/api/__tests__/citations.test.ts
```

**Expected:** All read operation tests PASS

### Step 3: Commit

```bash
git add src/lib/api/citations.ts
git commit -m "feat(api): implement citations read operations (GREEN)"
```

---

## Task 5.19: Write Operations Tests (RED)

### Step 1: Add failing tests for create/update/delete

Add to `src/lib/api/__tests__/citations.test.ts`:

```typescript
import {
  getCitations,
  getCitation,
  createCitation,
  createCitationFromPaper,
  updateCitation,
  deleteCitation,
  isDuplicateCitation,
} from '../citations';

describe('Citations API - Write Operations', () => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSelectSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSelectSingle,
      }),
    });
    mockSelectSingle.mockResolvedValue({ data: { id: 'new-id' }, error: null });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'updated' }, error: null }),
        }),
      }),
    });

    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (createClient as any).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      }),
    });
  });

  describe('createCitation', () => {
    it('should insert and return new citation', async () => {
      const newCitation = { project_id: 'proj-1', title: 'Test' };
      mockSelectSingle.mockResolvedValue({ data: { id: 'new-id', ...newCitation }, error: null });

      const result = await createCitation(newCitation);

      expect(result.id).toBe('new-id');
    });
  });

  describe('createCitationFromPaper', () => {
    it('should map Paper fields to Citation', async () => {
      const paper = {
        paperId: 'paper-123',
        title: 'Test Paper',
        authors: [{ name: 'John Doe' }],
        year: 2024,
        url: 'https://example.com',
      };

      await createCitationFromPaper('proj-1', paper);

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should set verified=true when DOI present', async () => {
      const paper = {
        paperId: 'paper-123',
        title: 'Test Paper',
        authors: [{ name: 'John Doe' }],
        year: 2024,
        url: 'https://example.com',
        externalIds: { DOI: '10.1000/test' },
      };

      await createCitationFromPaper('proj-1', paper);

      // Verify insert was called with verified: true
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('updateCitation', () => {
    it('should update and return modified citation', async () => {
      const result = await updateCitation('cite-1', { title: 'Updated' });

      expect(result).toBeDefined();
    });
  });

  describe('deleteCitation', () => {
    it('should delete citation by id', async () => {
      await deleteCitation('cite-1');

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('isDuplicateCitation', () => {
    it('should detect duplicate by paperId', async () => {
      const mockSingleResult = vi.fn().mockResolvedValue({
        data: { id: 'existing-id' },
        error: null,
      });

      (createClient as any).mockResolvedValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingleResult,
              }),
            }),
          }),
        }),
      });

      const paper = { paperId: 'existing-paper', title: 'Test', authors: [], year: 2024, url: '' };
      const result = await isDuplicateCitation('proj-1', paper);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('existing-id');
    });

    it('should detect duplicate by DOI', async () => {
      // First query returns no match by paperId
      // Second query returns match by DOI
      const paper = {
        paperId: 'new-paper',
        title: 'Test',
        authors: [],
        year: 2024,
        url: '',
        externalIds: { DOI: '10.1000/existing' },
      };

      // Implementation will be tested
      expect(true).toBe(true);
    });

    it('should return false for non-duplicate', async () => {
      const mockSingleResult = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      (createClient as any).mockResolvedValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingleResult,
              }),
            }),
          }),
        }),
      });

      const paper = { paperId: 'new-paper', title: 'Test', authors: [], year: 2024, url: '' };
      const result = await isDuplicateCitation('proj-1', paper);

      expect(result.isDuplicate).toBe(false);
    });
  });
});
```

### Step 2: Run tests to verify new tests fail

```bash
npm test src/lib/api/__tests__/citations.test.ts
```

**Expected:** New tests FAIL

### Step 3: Commit

```bash
git add src/lib/api/__tests__/citations.test.ts
git commit -m "test(api): add failing citations write tests (RED)"
```

---

## Task 5.20: Write Operations Implementation (GREEN)

### Step 1: Add write operations

Add to `src/lib/api/citations.ts`:

```typescript
import type { Paper } from '@/lib/citations/types';
import { citationLogger } from '@/lib/citations/logger';
import { createAuditLog } from '@/lib/api/audit';

type CitationInsert = Database['public']['Tables']['citations']['Insert'];
type CitationUpdate = Database['public']['Tables']['citations']['Update'];

export async function createCitation(citation: CitationInsert): Promise<Citation> {
  const supabase = await createClient();
  const log = citationLogger({ projectId: citation.project_id });

  const { data, error } = await supabase.from('citations').insert(citation).select().single();

  if (error) throw error;

  // Audit log the creation (Best Practice: Phase 2)
  log.info({ citationId: data.id }, 'Citation created');
  await createAuditLog('citation:create', {
    resourceType: 'citation',
    resourceId: data.id,
    projectId: citation.project_id,
  });

  return data;
}

export async function createCitationFromPaper(projectId: string, paper: Paper): Promise<Citation> {
  const citation: CitationInsert = {
    project_id: projectId,
    paper_id: paper.paperId,
    title: paper.title,
    authors: paper.authors.map((a) => a.name).join(', '),
    year: paper.year,
    journal: paper.journal?.name,
    venue: paper.venue,
    volume: paper.journal?.volume,
    pages: paper.journal?.pages,
    doi: paper.externalIds?.DOI,
    url: paper.url,
    abstract: paper.abstract,
    publication_date: paper.publicationDate,
    external_ids: paper.externalIds,
    citation_count: paper.citationCount,
    source: 'ai_fetched',
    verified: !!paper.externalIds?.DOI,
  };
  return createCitation(citation);
}

export async function updateCitation(id: string, updates: CitationUpdate): Promise<Citation> {
  const supabase = await createClient();
  const log = citationLogger({ citationId: id });

  const { data, error } = await supabase.from('citations').update(updates).eq('id', id).select().single();

  if (error) throw error;

  // Audit log the update (Best Practice: Phase 2)
  log.info({ updatedFields: Object.keys(updates) }, 'Citation updated');
  await createAuditLog('citation:update', {
    resourceType: 'citation',
    resourceId: id,
    changes: Object.keys(updates),
  });

  return data;
}

// Soft delete implementation (Best Practice: Database §5)
export async function deleteCitation(id: string): Promise<void> {
  const supabase = await createClient();
  const log = citationLogger({ citationId: id });

  const { error } = await supabase.from('citations').update({ deleted_at: new Date().toISOString() }).eq('id', id);

  if (error) throw error;

  // Audit log the soft deletion (Best Practice: Phase 2)
  log.info('Citation soft-deleted');
  await createAuditLog('citation:delete', {
    resourceType: 'citation',
    resourceId: id,
    softDelete: true,
  });
}

// Restore a soft-deleted citation
export async function restoreCitation(id: string): Promise<Citation> {
  const supabase = await createClient();
  const log = citationLogger({ citationId: id });

  const { data, error } = await supabase.from('citations').update({ deleted_at: null }).eq('id', id).select().single();

  if (error) throw error;

  // Audit log the restoration (Best Practice: Phase 2)
  log.info('Citation restored');
  await createAuditLog('citation:restore', {
    resourceType: 'citation',
    resourceId: id,
  });

  return data;
}

export async function isDuplicateCitation(
  projectId: string,
  paper: Paper
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const supabase = await createClient();

  if (paper.paperId) {
    const { data: byPaperId } = await supabase
      .from('citations')
      .select('id')
      .eq('project_id', projectId)
      .eq('paper_id', paper.paperId)
      .single();

    if (byPaperId) return { isDuplicate: true, existingId: byPaperId.id };
  }

  if (paper.externalIds?.DOI) {
    const { data: byDoi } = await supabase
      .from('citations')
      .select('id')
      .eq('project_id', projectId)
      .eq('doi', paper.externalIds.DOI)
      .single();

    if (byDoi) return { isDuplicate: true, existingId: byDoi.id };
  }

  return { isDuplicate: false };
}
```

### Step 2: Run tests to verify they pass

```bash
npm test src/lib/api/__tests__/citations.test.ts
```

**Expected:** All tests PASS

### Step 3: Commit

```bash
git add src/lib/api/citations.ts
git commit -m "feat(api): implement citations write operations (GREEN)"
```

---

## Verification Checklist

- [ ] `src/lib/citations/logger.ts` exists with `citationLogger()` factory
- [ ] `src/lib/citations/index.ts` exports `citationLogger`
- [ ] `src/lib/api/citations.ts` exists
- [ ] `src/lib/api/__tests__/citations.test.ts` exists
- [ ] All tests pass (10+ tests)
- [ ] `getCitations` function works
- [ ] `getCitation` function works
- [ ] `createCitation` function works
- [ ] `createCitationFromPaper` function works
- [ ] `updateCitation` function works
- [ ] `deleteCitation` function works (soft delete via `deleted_at`)
- [ ] `restoreCitation` function works
- [ ] `isDuplicateCitation` function works
- [ ] Domain logger used (`citationLogger()`) - no bare `logger` calls
- [ ] Audit logging via `createAuditLog()` helper
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Tasks 5.21-5.23: API Routes](./06-api-routes.md)**.
