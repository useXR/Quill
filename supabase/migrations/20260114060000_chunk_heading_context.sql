-- Add heading_context column to vault_chunks for section awareness
-- This stores the hierarchical heading path (e.g., "Methods > Participants")

ALTER TABLE vault_chunks
ADD COLUMN IF NOT EXISTS heading_context text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN vault_chunks.heading_context IS
  'Hierarchical heading path for this chunk (e.g., "Introduction" or "Methods > Participants")';

-- Create index for prefix searches on heading context
CREATE INDEX IF NOT EXISTS idx_vault_chunks_heading_context
ON vault_chunks (heading_context text_pattern_ops)
WHERE heading_context IS NOT NULL;
