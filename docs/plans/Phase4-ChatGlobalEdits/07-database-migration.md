# Task 4.7: Database Migration

> **Phase 4** | [← API Routes](./06-api-routes.md) | [Next: ChatSidebar →](./08-chat-sidebar.md)

---

## Context

**This task creates database indexes for efficient chat and AI operations queries.** These indexes optimize pagination, lookup by document, and filtering by status.

### Prerequisites

- **Task 4.6** completed (API routes that will use these indexes)

### What This Task Creates

- `supabase/migrations/20260113000000_chat_indexes.sql` - Database indexes

### Tasks That Depend on This

- **Task 4.8** (ChatSidebar) - Uses optimized chat history queries
- **Task 4.9** (DiffPanel) - Uses optimized operations queries

---

## Files to Create/Modify

- `supabase/migrations/20260113000000_chat_indexes.sql` (create)

---

## Task 22: Database Migration for Chat Indexes

### Step 1: Create migration file

Create `supabase/migrations/20260113000000_chat_indexes.sql`:

```sql
-- =============================================================================
-- INDEXES FOR CHAT HISTORY
-- =============================================================================

-- Index for fetching chat history by project
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id
  ON public.chat_history(project_id);

-- Index for fetching chat history by document
CREATE INDEX IF NOT EXISTS idx_chat_history_document_id
  ON public.chat_history(document_id);

-- Composite index for pagination queries
CREATE INDEX IF NOT EXISTS idx_chat_history_project_created
  ON public.chat_history(project_id, created_at DESC);

-- =============================================================================
-- INDEXES FOR AI OPERATIONS
-- =============================================================================

-- Index for AI operations lookup
CREATE INDEX IF NOT EXISTS idx_ai_operations_document_id
  ON public.ai_operations(document_id);

-- Index for recent operations query
CREATE INDEX IF NOT EXISTS idx_ai_operations_document_created
  ON public.ai_operations(document_id, created_at DESC);

-- Index for status filtering (used by getRecentOperations)
CREATE INDEX IF NOT EXISTS idx_ai_operations_document_status
  ON public.ai_operations(document_id, status);

-- =============================================================================
-- RETENTION POLICY DOCUMENTATION
-- Per best practices: Define retention periods upfront
-- =============================================================================

-- Document retention periods for operations team
COMMENT ON TABLE public.chat_history IS
  'Retention: 90 days. Cleanup via scheduled job.';

COMMENT ON TABLE public.ai_operations IS
  'Retention: 90 days. Cleanup via scheduled job.';

-- =============================================================================
-- RETENTION CLEANUP FUNCTION
-- Call this from a scheduled job (e.g., pg_cron or external scheduler)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  retention_days CONSTANT integer := 90;
  cutoff_date timestamp with time zone;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::interval;

  -- Clean up old chat history
  DELETE FROM public.chat_history
  WHERE created_at < cutoff_date;

  -- Clean up old AI operations (keep rejected for audit trail shorter)
  DELETE FROM public.ai_operations
  WHERE created_at < cutoff_date;

  RAISE NOTICE 'Cleaned up records older than %', cutoff_date;
END;
$$;

-- Grant execute to service role for scheduled jobs
GRANT EXECUTE ON FUNCTION cleanup_old_records() TO service_role;
```

### Step 2: Apply migration

```bash
npx supabase db reset
```

**Expected:** Migration applies without errors

### Step 3: Verify indexes exist

```bash
npx supabase db dump --schema public | grep -i "idx_chat_history\|idx_ai_operations"
```

**Expected:** All 6 indexes listed (including new status index)

### Step 4: Commit

```bash
git add supabase/migrations/20260113000000_chat_indexes.sql
git commit -m "feat: add database indexes for chat and AI operations"
```

---

## Verification Checklist

- [ ] Migration file created with correct timestamp
- [ ] All 6 indexes defined (including status index)
- [ ] Retention policy comments added to tables
- [ ] Cleanup function created and granted to service_role
- [ ] Migration applies without errors
- [ ] Indexes appear in database dump
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 4.8: ChatSidebar](./08-chat-sidebar.md)**.
