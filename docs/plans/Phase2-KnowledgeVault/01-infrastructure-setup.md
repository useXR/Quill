# Task 2.0: Infrastructure Setup

> **Phase 2** | [← Overview](./00-overview.md) | [Next: VaultUpload Component →](./02-vault-upload-component.md)

---

## Context

**This task establishes the database schema, storage bucket, and shared utilities for the Knowledge Vault.** Everything in Phase 2 depends on this infrastructure.

> **Design System:** This task is backend infrastructure. UI components that consume these types follow the "Scholarly Craft" aesthetic documented in [`docs/design-system.md`](../../design-system.md).

### Prerequisites

- **Phase 0 and Phase 1** completed
- Supabase running locally
- `OPENAI_API_KEY` in `.env.local`

### What This Task Creates

- Test fixtures (`fixtures/sample.txt`, `e2e/fixtures/test.txt`)
- Shared test mock data (`src/lib/vault/__tests__/fixtures.ts`)
- Vault constants (`src/lib/vault/constants.ts`)
- Vault types (`src/lib/vault/types.ts`)
- Database migrations for `vault_items` and `vault_chunks` tables
- Storage bucket migration for `vault-files`
- pgvector extension and HNSW index

### Tasks That Depend on This

- **All subsequent Phase 2 tasks** depend on this infrastructure
- Components need types, API helpers need tables, extraction needs storage

---

## Files to Create/Modify

- `fixtures/sample.txt` (create)
- `e2e/fixtures/test.txt` (create)
- `src/lib/vault/__tests__/fixtures.ts` (create)
- `src/lib/vault/constants.ts` (create)
- `src/lib/vault/types.ts` (create)
- `supabase/migrations/YYYYMMDDHHMMSS_vault_tables.sql` (create)
- `supabase/migrations/YYYYMMDDHHMMSS_storage_bucket.sql` (create)

---

## Steps

### Step 1: Create test fixtures directories

```bash
mkdir -p fixtures e2e/fixtures
```

**Expected:** Both directories exist

---

### Step 2a: Create unit test fixture

Create `fixtures/sample.txt`:

```
This is a sample text file for testing the Knowledge Vault extraction pipeline.
It contains multiple sentences to test chunking behavior.
The content should be extracted and embedded correctly.
```

---

### Step 2b: Create E2E test fixture

Create `e2e/fixtures/test.txt`:

```
Test document for E2E testing.
This file validates the complete upload and extraction flow.
Search queries should find this content.
```

---

### Step 2c: Create shared test mock data

Create `src/lib/vault/__tests__/fixtures.ts`:

```typescript
import type { VaultItem, VaultChunk } from '../types';

export const mockVaultItem: VaultItem = {
  id: 'vault-item-1',
  user_id: 'user-1',
  project_id: 'project-1',
  type: 'pdf',
  filename: 'research-paper.pdf',
  storage_path: 'user-1/project-1/research-paper.pdf',
  extracted_text: 'Sample extracted text from PDF document.',
  extraction_status: 'success',
  chunk_count: 5,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockVaultChunk: VaultChunk = {
  id: 'chunk-1',
  vault_item_id: 'vault-item-1',
  content: 'This is the first chunk of text from the document.',
  embedding: null, // Usually a 1536-dimension vector
  chunk_index: 0,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockVaultItems: VaultItem[] = [
  mockVaultItem,
  { ...mockVaultItem, id: 'vault-item-2', filename: 'notes.txt', type: 'txt' },
  { ...mockVaultItem, id: 'vault-item-3', filename: 'report.docx', type: 'docx', extraction_status: 'pending' },
];

export function createMockVaultItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return { ...mockVaultItem, ...overrides };
}
```

---

### Step 3: Create vault constants file

Create `src/lib/vault/constants.ts`:

```typescript
export const FILE_SIZE_LIMITS = {
  pdf: 100 * 1024 * 1024, // 100 MB
  docx: 50 * 1024 * 1024, // 50 MB
  txt: 10 * 1024 * 1024, // 10 MB
} as const;

export const TOTAL_STORAGE_PER_USER = 1024 * 1024 * 1024; // 1 GB
export const TOTAL_STORAGE_PER_PROJECT = 500 * 1024 * 1024; // 500 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const FILE_TYPE_MAP: Record<string, keyof typeof FILE_SIZE_LIMITS> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
};

export const CHUNK_CONFIG = {
  maxSize: 2000, // chars per chunk (optimized for academic text)
  overlap: 200, // 10% overlap for context preservation
  minSize: 50, // minimum chunk size to avoid empty chunks
} as const;

export const EXTRACTION_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 2000,
  maxRetryDelayMs: 30000, // Cap exponential backoff at 30s
  timeoutMs: 120000, // 2 minutes max per file
} as const;

export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
  maxTokensPerChunk: 8191,
} as const;

export type FileType = keyof typeof FILE_SIZE_LIMITS;

export const RETENTION = {
  SOFT_DELETE_GRACE_PERIOD_DAYS: 7,
  AUDIT_LOGS_DAYS: 90,
} as const;
```

---

### Step 3b: Extend existing logger with vaultLogger

> **Note:** The structured logger (`src/lib/logger.ts`) was already created in Phase 1. Add the `vaultLogger` helper to the existing file.

Add to `src/lib/logger.ts`:

```typescript
// Typed logger for vault operations (add to existing logger.ts from Phase 1)
export function vaultLogger(context: { userId?: string; itemId?: string; projectId?: string }) {
  return logger.child({ module: 'vault', ...context });
}
```

---

### Step 4: Create vault types file

Create `src/lib/vault/types.ts`:

> **Note:** A barrel export (`index.ts`) will be created in Step 4b after the types file.

```typescript
import type { Database } from '@/lib/supabase/database.types';

export type VaultItem = Database['public']['Tables']['vault_items']['Row'];
export type VaultChunk = Database['public']['Tables']['vault_chunks']['Row'];

export type ExtractionStatus =
  | 'pending'
  | 'downloading'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'success'
  | 'partial'
  | 'failed';

// Discriminated union for type-safe extraction progress
export type ExtractionProgress =
  | { status: 'pending' | 'downloading' | 'extracting' | 'chunking' | 'embedding'; progress: number }
  | { status: 'success'; chunksProcessed: number; totalChunks: number }
  | { status: 'failed'; error: string }
  | { status: 'partial'; chunksProcessed: number; error?: string };

export interface SearchResult {
  content: string;
  similarity: number;
  vaultItemId: string;
  filename: string;
  chunkIndex: number;
}

export interface UploadResult {
  success: boolean;
  item?: VaultItem;
  error?: string;
}

// Zod schema types for API validation
export interface VaultSearchParams {
  projectId: string;
  query: string;
  limit?: number;
  threshold?: number;
}
```

---

### Step 4b: Create vault barrel export

Create `src/lib/vault/index.ts`:

```typescript
// Barrel export for vault module
// Following best practices: every src/lib/<module>/ should have an index.ts
export * from './constants';
export * from './types';
```

---

### Step 5: Create vault tables migration

Create `supabase/migrations/YYYYMMDDHHMMSS_vault_tables.sql` (replace timestamp with current date):

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Create vault_items table
create table vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  type text not null check (type in ('pdf', 'docx', 'txt')),
  filename text not null,
  storage_path text,
  extracted_text text,
  extraction_status text default 'pending' check (extraction_status in ('pending', 'downloading', 'extracting', 'chunking', 'embedding', 'success', 'partial', 'failed')),
  chunk_count integer default 0,
  created_at timestamptz default now(),
  deleted_at timestamptz default null  -- Soft delete support
);

-- Create vault_chunks table with vector embedding
create table vault_chunks (
  id uuid primary key default gen_random_uuid(),
  vault_item_id uuid references vault_items(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table vault_items enable row level security;
alter table vault_chunks enable row level security;

-- RLS policies for vault_items (exclude soft-deleted by default)
create policy "Users can insert own vault items"
  on vault_items for insert
  with check (auth.uid() = user_id);

create policy "Users can view own vault items"
  on vault_items for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "Users can update own vault items"
  on vault_items for update
  using (auth.uid() = user_id and deleted_at is null);

create policy "Users can delete own vault items"
  on vault_items for delete
  using (auth.uid() = user_id);

-- RLS policies for vault_chunks (inherit from vault_items ownership)
create policy "Users can view chunks of own items"
  on vault_chunks for select
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_chunks.vault_item_id
      and vault_items.user_id = auth.uid()
    )
  );

create policy "Users can insert chunks for own items"
  on vault_chunks for insert
  with check (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_chunks.vault_item_id
      and vault_items.user_id = auth.uid()
    )
  );

create policy "Users can delete chunks of own items"
  on vault_chunks for delete
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_chunks.vault_item_id
      and vault_items.user_id = auth.uid()
    )
  );

-- Create HNSW index for fast similarity search
-- Note: HNSW is preferred over IVFFlat as it doesn't require data to build effective centroids
create index vault_chunks_embedding_idx on vault_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Index for common queries
create index vault_items_user_project_idx on vault_items(user_id, project_id);
create index vault_items_status_idx on vault_items(extraction_status) where extraction_status in ('pending', 'downloading', 'extracting', 'chunking', 'embedding');
create index vault_items_deleted_at_idx on vault_items(deleted_at) where deleted_at is not null;

-- Function to permanently delete soft-deleted items after grace period (7 days)
-- Call this from a scheduled job (e.g., Supabase Edge Function cron or external scheduler)
create or replace function cleanup_soft_deleted_vault_items()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  with deleted_items as (
    delete from vault_items
    where deleted_at is not null
      and deleted_at < now() - interval '7 days'
    returning id
  )
  select count(*) into deleted_count from deleted_items;

  return deleted_count;
end;
$$;
```

---

### Step 6: Create storage bucket migration

Create `supabase/migrations/YYYYMMDDHHMMSS_storage_bucket.sql` (timestamp after vault_tables):

```sql
-- Create vault-files storage bucket
insert into storage.buckets (id, name, public)
values ('vault-files', 'vault-files', false)
on conflict do nothing;

-- RLS policies for vault-files bucket
-- Users can only upload to their own folder (path starts with their user_id)
create policy "Users can upload to their own folder"
  on storage.objects
  for insert
  with check (
    bucket_id = 'vault-files' AND
    auth.uid() is not null AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only read files in their own folder
create policy "Users can read their own files"
  on storage.objects
  for select
  using (
    bucket_id = 'vault-files' AND
    auth.uid() is not null AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete files in their own folder
create policy "Users can delete their own files"
  on storage.objects
  for delete
  using (
    bucket_id = 'vault-files' AND
    auth.uid() is not null AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

### Step 7: Apply migrations

```bash
npx supabase db reset
```

**Expected:** All migrations apply successfully

---

### Step 8: Generate types

```bash
npm run db:types
```

**Expected:** Types regenerated with vault_items and vault_chunks tables

---

### Step 9: Verify environment variables

Ensure `.env.local` contains:

```
OPENAI_API_KEY=sk-...
```

Verify:

```bash
grep OPENAI_API_KEY .env.local
```

**Expected:** Line with API key (value redacted)

---

### Step 10: Commit infrastructure setup

```bash
git add .
git commit -m "chore: add Phase 2 infrastructure (tables, storage, constants, types, fixtures)"
```

---

## Verification Checklist

- [ ] `fixtures/sample.txt` exists
- [ ] `e2e/fixtures/test.txt` exists
- [ ] `src/lib/vault/__tests__/fixtures.ts` exists
- [ ] `src/lib/vault/constants.ts` exists with all config (including RETENTION)
- [ ] `src/lib/vault/types.ts` exists with all types
- [ ] `src/lib/vault/index.ts` exists (barrel export)
- [ ] `src/lib/logger.ts` exists with pino logger (from Phase 1 - verify `vaultLogger` is available)
- [ ] Migrations applied without errors
- [ ] `vault_items` table has `deleted_at` column for soft delete
- [ ] `cleanup_soft_deleted_vault_items` function exists
- [ ] `npm run db:types` regenerates types successfully
- [ ] `OPENAI_API_KEY` is set in `.env.local`
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.1: VaultUpload Component](./02-vault-upload-component.md)**.

You can also start these tasks in parallel:

- **[Task 2.2: VaultItemCard Component](./03-vault-item-card-component.md)**
- **[Task 2.4: Vault API Helpers](./05-vault-api-helpers.md)**
- **[Task 2.6: Text Extraction](./07-text-extraction.md)**
- **[Task 2.7: Text Chunker](./08-text-chunker.md)**
- **[Task 2.8: OpenAI Embeddings](./09-openai-embeddings.md)**
