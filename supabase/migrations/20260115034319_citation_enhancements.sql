-- Add fields to citations table
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS paper_id text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS volume text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS pages text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS publication_date date;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}';
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS citation_count integer;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS notes text;
-- Soft delete support
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Unique index for duplicate detection (excludes soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS citations_paper_id_project_id_idx
  ON public.citations(paper_id, project_id)
  WHERE paper_id IS NOT NULL AND deleted_at IS NULL;

-- Update existing RLS policies
DROP POLICY IF EXISTS "Users can view own citations" ON public.citations;
DROP POLICY IF EXISTS "Users can manage own citations" ON public.citations;

-- RLS policy for SELECT - excludes soft-deleted
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

-- RLS policy for UPDATE
CREATE POLICY "Users can update own citations"
  ON public.citations FOR UPDATE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- RLS policy for DELETE
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

-- RLS for document_citations
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

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS citations_deleted_at_idx
  ON public.citations(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Index for common query pattern
CREATE INDEX IF NOT EXISTS citations_project_created_idx
  ON public.citations(project_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Function for permanent deletion of expired soft-deleted records
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
