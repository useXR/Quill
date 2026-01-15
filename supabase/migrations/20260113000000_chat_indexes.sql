-- =============================================================================
-- INDEXES FOR CHAT HISTORY
-- =============================================================================

-- Index for fetching chat history by document
CREATE INDEX IF NOT EXISTS idx_chat_history_document_id
  ON public.chat_history(document_id);

-- Composite index for pagination queries
CREATE INDEX IF NOT EXISTS idx_chat_history_project_created
  ON public.chat_history(project_id, created_at DESC);

-- =============================================================================
-- INDEXES FOR AI OPERATIONS
-- =============================================================================

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
