# Task 0.6: Create Database Schema Migration

> **Phase 0** | [<- Supabase Local](./05-supabase-local.md) | [Next: TypeScript Types ->](./07-typescript-types.md)

---

## Context

**This task creates the initial database schema with all tables, RLS policies, and indexes.** The schema supports the complete Quill application including users, projects, documents, vault (file storage), citations, and AI operations.

### Prerequisites

- **Task 0.5** completed (Supabase local development running)

### What This Task Creates

- Database migration with all tables
- Row Level Security (RLS) policies
- Performance indexes
- Database functions and triggers
- Semantic search function for vault

### Tasks That Depend on This

- **Task 0.7** (TypeScript Types) - generates types from this schema

---

## Files to Create

- `supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql`

---

## Steps

### Step 1: Create migration file

```bash
pnpm exec supabase migration new initial_schema
```

This creates a timestamped file in `supabase/migrations/`.

### Step 2: Write schema migration

Edit the created migration file (e.g., `supabase/migrations/20260113120000_initial_schema.sql`):

```sql
-- Enable pgvector extension for semantic search
create extension if not exists vector with schema extensions;

-- ============================================
-- USERS / PROFILES
-- ============================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================
-- PROJECTS
-- ============================================

create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  status text check (status in ('draft', 'submitted', 'funded')) default 'draft',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.projects enable row level security;

create policy "Users can CRUD own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- Performance index
create index idx_projects_user_id on public.projects(user_id);

-- ============================================
-- DOCUMENTS
-- ============================================

create table public.documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  -- Default to valid empty TipTap/ProseMirror document structure
  content jsonb default '{"type": "doc", "content": []}',
  content_text text default '',
  sort_order integer default 0,
  version integer default 1,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.documents enable row level security;

create policy "Users can CRUD documents in own projects"
  on public.documents for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Performance indexes
create index idx_documents_project_id on public.documents(project_id);
create index idx_documents_content on public.documents using gin(content);

-- ============================================
-- VAULT ITEMS (uploaded files)
-- ============================================

create table public.vault_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  type text check (type in ('pdf', 'docx', 'url', 'text')) not null,
  filename text,
  storage_path text,
  file_size bigint,
  mime_type text,
  source_url text,
  extracted_text text,
  extraction_status text check (extraction_status in ('pending', 'success', 'partial', 'failed')) default 'pending',
  chunk_count integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.vault_items enable row level security;

create policy "Users can CRUD own vault items"
  on public.vault_items for all
  using (auth.uid() = user_id);

-- Performance index
create index idx_vault_items_project_id on public.vault_items(project_id);

-- ============================================
-- VAULT CHUNKS (for semantic search)
-- ============================================

create table public.vault_chunks (
  id uuid default gen_random_uuid() primary key,
  vault_item_id uuid references public.vault_items(id) on delete cascade not null,
  content text not null,
  -- NOTE: 1536 dimensions is for OpenAI text-embedding-ada-002/text-embedding-3-small.
  -- If switching to a different embedding model, update this dimension accordingly.
  embedding vector(1536),
  chunk_index integer not null,
  constraint unique_vault_chunk_index unique(vault_item_id, chunk_index),
  constraint positive_chunk_index check (chunk_index >= 0)
);

alter table public.vault_chunks enable row level security;

create policy "Users can access chunks of own vault items"
  on public.vault_chunks for all
  using (
    vault_item_id in (
      select id from public.vault_items where user_id = auth.uid()
    )
  );

-- Vector similarity search index
-- NOTE: Using HNSW instead of IVFFlat because IVFFlat requires training data
-- and will fail on empty tables. HNSW works without pre-existing data.
create index idx_vault_chunks_embedding on public.vault_chunks
  using hnsw (embedding vector_cosine_ops);

-- ============================================
-- CITATIONS
-- ============================================

create table public.citations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  authors text,
  year integer,
  journal text,
  doi text,
  url text,
  abstract text,
  source text check (source in ('user_added', 'ai_fetched')) default 'user_added',
  verified boolean default false,
  created_at timestamptz default now() not null
);

alter table public.citations enable row level security;

create policy "Users can CRUD citations in own projects"
  on public.citations for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Performance index
create index idx_citations_project_id on public.citations(project_id);

-- ============================================
-- CHAT HISTORY
-- ============================================

create table public.chat_history (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete set null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.chat_history enable row level security;

create policy "Users can CRUD chat in own projects"
  on public.chat_history for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Performance indexes
create index idx_chat_history_project_id on public.chat_history(project_id);
create index idx_chat_history_created_at on public.chat_history(created_at desc);

-- ============================================
-- AUDIT LOGS (for security and compliance)
-- ============================================

create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now() not null
);

alter table public.audit_logs enable row level security;

-- Only admins can view audit logs (for now, users can see their own)
create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

-- Performance indexes
create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index idx_audit_logs_action on public.audit_logs(action);

-- ============================================
-- AI OPERATIONS (for undo/history)
-- ============================================

create table public.ai_operations (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  -- Denormalized user_id for efficient RLS (avoids 3-table join)
  user_id uuid references public.profiles(id) on delete cascade not null,
  operation_type text check (operation_type in ('selection', 'cursor', 'global')) not null,
  input_summary text,
  output_content text,
  status text check (status in ('pending', 'accepted', 'rejected', 'partial')) default 'pending',
  snapshot_before jsonb,
  created_at timestamptz default now() not null
);

alter table public.ai_operations enable row level security;

-- NOTE: user_id is denormalized here for RLS performance.
-- Without it, the policy would require a 3-table join (ai_operations -> documents -> projects)
-- which can be slow at scale.
create policy "Users can CRUD own ai_operations"
  on public.ai_operations for all
  using (auth.uid() = user_id);

-- Performance indexes
create index idx_ai_operations_document_id on public.ai_operations(document_id);
create index idx_ai_operations_user_id on public.ai_operations(user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.vault_items
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- SEARCH FUNCTION (for semantic search)
-- ============================================

-- NOTE: This function uses SECURITY INVOKER (default) so RLS policies apply.
-- The user ownership check via vault_items.user_id ensures users can only
-- search their own vault content.
create or replace function search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
returns table (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text
)
language sql stable
as $$
  select
    vc.content,
    1 - (vc.embedding <=> query_embedding) as similarity,
    vc.vault_item_id,
    vi.filename
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and vi.user_id = auth.uid()  -- Explicit user ownership check
    and 1 - (vc.embedding <=> query_embedding) > match_threshold
  order by vc.embedding <=> query_embedding
  limit match_count;
$$;
```

### Step 3: Apply migration

```bash
pnpm exec supabase db reset
```

**Expected:** Migration applied, all tables created

### Step 4: Verify tables exist

```bash
pnpm exec supabase db dump --schema public | head -100
```

### Step 5: Commit

```bash
git add .
git commit -m "feat: add initial database schema with RLS policies"
```

---

## Schema Overview

| Table           | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `profiles`      | User profiles (linked to auth.users)             |
| `projects`      | Grant proposals                                  |
| `documents`     | Document sections within projects                |
| `vault_items`   | Uploaded reference files                         |
| `vault_chunks`  | Chunked text with embeddings for semantic search |
| `citations`     | Bibliography entries                             |
| `chat_history`  | AI conversation history                          |
| `audit_logs`    | Security audit trail for user actions            |
| `ai_operations` | AI edit operations for undo/history              |

---

## Verification Checklist

- [ ] Migration file created in `supabase/migrations/`
- [ ] `pnpm exec supabase db reset` succeeds
- [ ] All tables visible in Supabase Studio (http://localhost:54323)
- [ ] `pnpm exec supabase db dump --schema public` shows table definitions
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 0.7: Generate TypeScript Types](./07-typescript-types.md)**.
