-- Create vault-files storage bucket for uploaded documents

-- ============================================
-- CREATE STORAGE BUCKET
-- ============================================

-- Create vault-files storage bucket (private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault-files', 'vault-files', false)
ON CONFLICT DO NOTHING;

-- ============================================
-- RLS POLICIES FOR STORAGE
-- ============================================

-- Users can only upload to their own folder (path starts with their user_id)
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vault-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only read files in their own folder
CREATE POLICY "Users can read their own files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'vault-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete files in their own folder
CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'vault-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files (for resumable uploads)
CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'vault-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
