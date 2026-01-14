-- Vault enhancements migration: adds soft delete support and extended extraction statuses
-- This migration enhances the vault_items table created in the initial schema

-- ============================================
-- ADD SOFT DELETE SUPPORT
-- ============================================

-- Add deleted_at column for soft delete support
ALTER TABLE public.vault_items
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_vault_items_deleted_at
ON public.vault_items(deleted_at)
WHERE deleted_at IS NOT NULL;

-- ============================================
-- EXTEND EXTRACTION STATUS OPTIONS
-- ============================================

-- Update extraction_status check constraint to include extended statuses
-- First, drop the existing constraint
ALTER TABLE public.vault_items
DROP CONSTRAINT IF EXISTS vault_items_extraction_status_check;

-- Add the new constraint with extended statuses
ALTER TABLE public.vault_items
ADD CONSTRAINT vault_items_extraction_status_check
CHECK (extraction_status IN ('pending', 'downloading', 'extracting', 'chunking', 'embedding', 'success', 'partial', 'failed'));

-- ============================================
-- UPDATE RLS POLICIES FOR SOFT DELETE
-- ============================================

-- Drop existing policy and recreate with soft delete filter
DROP POLICY IF EXISTS "Users can CRUD own vault items" ON public.vault_items;

-- Split into separate policies for granular control
CREATE POLICY "Users can insert own vault items"
  ON public.vault_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own vault items"
  ON public.vault_items FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can update own vault items"
  ON public.vault_items FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can delete own vault items"
  ON public.vault_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- ADD CREATED_AT TO VAULT_CHUNKS
-- ============================================

-- Add created_at column to vault_chunks if missing
ALTER TABLE public.vault_chunks
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL;

-- ============================================
-- SOFT DELETE CLEANUP FUNCTION
-- ============================================

-- Function to permanently delete soft-deleted items after grace period (7 days)
-- Call this from a scheduled job (e.g., Supabase Edge Function cron or external scheduler)
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_vault_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted_items AS (
    DELETE FROM vault_items
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted_items;

  RETURN deleted_count;
END;
$$;

-- Grant execute permission to authenticated users (for admin functionality)
-- Note: The function is SECURITY DEFINER so it runs with owner privileges
COMMENT ON FUNCTION cleanup_soft_deleted_vault_items() IS
  'Permanently deletes vault items that were soft-deleted more than 7 days ago. Should be called by a scheduled job (cron) for automatic cleanup.';
