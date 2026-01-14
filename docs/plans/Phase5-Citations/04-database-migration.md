# Tasks 5.15-5.16: Database Migration

> **Phase 5** | [← TipTap Extension](./03-tiptap-extension.md) | [Next: Citations API Helpers →](./05-citations-api-helpers.md)

---

## Context

**This task creates database schema enhancements for citations.** It adds new fields to the citations table and creates a junction table for document-citation relationships.

### Design System Note

While this task is backend-focused, the schema fields directly support UI rendering in the Scholarly Craft design:

| DB Column        | UI Purpose   | Design Token Mapping                                                             |
| ---------------- | ------------ | -------------------------------------------------------------------------------- |
| `title`          | Card heading | `font-display text-ink-primary`                                                  |
| `authors`        | Author line  | `font-ui text-ink-secondary`                                                     |
| `verified`       | DOI badge    | `bg-success-light text-success` (true) / `bg-warning-light text-warning` (false) |
| `citation_count` | Metric badge | `bg-bg-secondary text-ink-secondary`                                             |
| `deleted_at`     | Soft delete  | No UI display (filtered by RLS)                                                  |

### Prerequisites

- **Task 5.1** completed (Paper types defined - schema mirrors type structure)

### What This Task Creates

- `supabase/migrations/YYYYMMDDHHMMSS_citation_enhancements.sql` - migration file
- Updated `src/lib/supabase/database.types.ts` - regenerated types
- `src/lib/api/__tests__/citation-db.integration.test.ts` - integration test scaffold

### Tasks That Depend on This

- **Tasks 5.17-5.20** (Citations API Helpers) - uses new schema
- All database operations for citations

### Parallel Tasks

This task can be done in parallel with:

- **Tasks 5.2-5.12** (Semantic Scholar Client)
- **Tasks 5.13-5.14** (TipTap Extension)

---

## Files to Create/Modify

- `supabase/migrations/YYYYMMDDHHMMSS_citation_enhancements.sql` (create)
- `src/lib/supabase/database.types.ts` (regenerate)
- `src/lib/api/__tests__/citation-db.integration.test.ts` (create)

---

## Task 5.15: Database Migration

### Step 1: Create migration file

```bash
npx supabase migration new citation_enhancements
```

### Step 2: Write migration SQL

Edit the created migration file:

```sql
-- Add fields to citations table
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS paper_id text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS volume text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS pages text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS publication_date date;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}';
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS citation_count integer;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS notes text;
-- Soft delete support (Best Practice: Database & Performance §5)
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Unique index for duplicate detection (excludes soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS citations_paper_id_project_id_idx
  ON public.citations(paper_id, project_id)
  WHERE paper_id IS NOT NULL AND deleted_at IS NULL;

-- Update existing RLS policy to exclude soft-deleted records (Best Practice: Database §5)
-- Drop existing policy if it exists, then recreate with soft delete filter
DROP POLICY IF EXISTS "Users can view own citations" ON public.citations;
DROP POLICY IF EXISTS "Users can manage own citations" ON public.citations;

-- RLS policy for SELECT - excludes soft-deleted (Best Practice: Phase 2)
CREATE POLICY "Users can view own non-deleted citations"
  ON public.citations FOR SELECT
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- RLS policy for INSERT
CREATE POLICY "Users can create citations in own projects"
  ON public.citations FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- RLS policy for UPDATE - allows updating including soft delete
CREATE POLICY "Users can update own citations"
  ON public.citations FOR UPDATE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- RLS policy for DELETE (hard delete - only for cleanup functions)
CREATE POLICY "Users can delete own citations"
  ON public.citations FOR DELETE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- Junction table for document-citation relationships
CREATE TABLE IF NOT EXISTS public.document_citations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  citation_id uuid REFERENCES public.citations(id) ON DELETE CASCADE NOT NULL,
  citation_number integer,
  position jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(document_id, citation_id)
);

ALTER TABLE public.document_citations ENABLE ROW LEVEL SECURITY;

-- RLS for document_citations (Best Practice: Security §4)
CREATE POLICY "Users can manage document_citations in own projects"
  ON public.document_citations FOR ALL
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.projects p ON d.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Function for auto-numbering
CREATE OR REPLACE FUNCTION public.get_next_citation_number(p_document_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(MAX(citation_number), 0) + 1
  FROM public.document_citations
  WHERE document_id = p_document_id;
$$ LANGUAGE sql STABLE;

-- Index for soft delete queries (Best Practice: Database & Performance §5)
CREATE INDEX IF NOT EXISTS citations_deleted_at_idx
  ON public.citations(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Index for common query pattern: project citations ordered by creation
CREATE INDEX IF NOT EXISTS citations_project_created_idx
  ON public.citations(project_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Function for permanent deletion of expired soft-deleted records
-- Default grace period: 30 days (from CITATIONS.SOFT_DELETE_GRACE_PERIOD_DAYS)
CREATE OR REPLACE FUNCTION public.cleanup_expired_citations(grace_period_days integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.citations
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (grace_period_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: Apply migration

```bash
npx supabase db reset
```

**Note:** This resets the local database. For production, use `npx supabase db push`.

### Step 4: Regenerate types

```bash
npm run db:types
```

### Step 5: Commit

```bash
git add supabase/migrations/*_citation_enhancements.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): add citation schema enhancements"
```

---

## Task 5.16: Database Migration Integration Test

### Step 1: Write integration test scaffold

Create `src/lib/api/__tests__/citation-db.integration.test.ts`:

```typescript
// src/lib/api/__tests__/citation-db.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Skip in CI without database
const shouldSkip = !process.env.SUPABASE_URL;

describe.skipIf(shouldSkip)('Citation DB Integration', () => {
  it('get_next_citation_number returns 1 for empty document', async () => {
    // This test requires a real Supabase connection
    // Implementation depends on test setup
    expect(true).toBe(true); // Placeholder
  });

  it('document_citations enforces unique constraint', async () => {
    // Test that same citation can't be added twice to same document
    expect(true).toBe(true); // Placeholder
  });

  it('citations_paper_id_project_id_idx prevents duplicates', async () => {
    // Test unique index on paper_id + project_id
    expect(true).toBe(true); // Placeholder
  });

  it('RLS policy restricts access to own projects', async () => {
    // Test row-level security
    expect(true).toBe(true); // Placeholder
  });
});
```

### Step 2: Commit

```bash
git add src/lib/api/__tests__/citation-db.integration.test.ts
git commit -m "test(db): add citation DB integration test scaffold"
```

---

## Schema Reference

### citations table (enhanced)

| Column           | Type        | Description                           |
| ---------------- | ----------- | ------------------------------------- |
| id               | uuid        | Primary key                           |
| project_id       | uuid        | Foreign key to projects               |
| paper_id         | text        | Semantic Scholar paper ID             |
| title            | text        | Paper title                           |
| authors          | text        | Comma-separated authors               |
| year             | integer     | Publication year                      |
| journal          | text        | Journal name                          |
| venue            | text        | Conference/venue                      |
| volume           | text        | Journal volume                        |
| pages            | text        | Page range                            |
| doi              | text        | DOI identifier                        |
| url              | text        | Paper URL                             |
| abstract         | text        | Paper abstract                        |
| publication_date | date        | Full publication date                 |
| external_ids     | jsonb       | DOI, PubMed, ArXiv, etc.              |
| citation_count   | integer     | Number of citations                   |
| source           | text        | 'ai_fetched', 'user_added'            |
| verified         | boolean     | Has DOI verification                  |
| notes            | text        | User notes                            |
| deleted_at       | timestamptz | Soft delete timestamp (null = active) |
| created_at       | timestamptz | Creation timestamp                    |
| updated_at       | timestamptz | Last update timestamp                 |

### document_citations table (new)

| Column          | Type        | Description                |
| --------------- | ----------- | -------------------------- |
| id              | uuid        | Primary key                |
| document_id     | uuid        | Foreign key to documents   |
| citation_id     | uuid        | Foreign key to citations   |
| citation_number | integer     | Display number in document |
| position        | jsonb       | Position metadata          |
| created_at      | timestamptz | Creation timestamp         |

---

## Verification Checklist

- [ ] Migration file created
- [ ] `npx supabase db reset` succeeds
- [ ] `npm run db:types` regenerates types
- [ ] `database.types.ts` includes new fields
- [ ] `document_citations` table exists
- [ ] `get_next_citation_number` function exists
- [ ] `cleanup_expired_citations` function exists
- [ ] `deleted_at` column added to citations table
- [ ] RLS policies created with soft delete filter:
  - [ ] `Users can view own non-deleted citations` (SELECT with `deleted_at IS NULL`)
  - [ ] `Users can create citations in own projects` (INSERT)
  - [ ] `Users can update own citations` (UPDATE)
  - [ ] `Users can delete own citations` (DELETE)
- [ ] Indexes created:
  - [ ] `citations_paper_id_project_id_idx` (unique, excludes soft-deleted)
  - [ ] `citations_deleted_at_idx` (for cleanup queries)
  - [ ] `citations_project_created_idx` (for listing queries)
- [ ] Integration test scaffold created
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Tasks 5.17-5.20: Citations API Helpers](./05-citations-api-helpers.md)**.

**Important:** Wait for all parallel tracks (5.2-5.12, 5.13-5.14, 5.15-5.16) to complete before starting Task 5.17.
