import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { Paper } from '@/lib/citations/types';
import { citationLogger } from '@/lib/citations/logger';

type Citation = Database['public']['Tables']['citations']['Row'];
type CitationInsert = Database['public']['Tables']['citations']['Insert'];
type CitationUpdate = Database['public']['Tables']['citations']['Update'];

// Extended types to include columns from migration that aren't in database.types yet
type CitationRow = Citation & {
  paper_id?: string | null;
  deleted_at?: string | null;
};

type CitationInsertExtended = CitationInsert & {
  paper_id?: string | null;
};

/**
 * Get all citations for a project.
 */
export async function getCitations(projectId: string): Promise<CitationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('citations')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CitationRow[];
}

/**
 * Get a single citation by ID.
 */
export async function getCitation(id: string): Promise<CitationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('citations').select('*').eq('id', id).is('deleted_at', null).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as CitationRow;
}

/**
 * Create a new citation.
 */
export async function createCitation(citation: CitationInsertExtended): Promise<CitationRow> {
  const supabase = await createClient();
  const log = citationLogger({ projectId: citation.project_id });
  const { data, error } = await supabase.from('citations').insert(citation).select().single();
  if (error) throw error;
  log.info({ citationId: data.id }, 'Citation created');
  return data as CitationRow;
}

/**
 * Create a citation from a Semantic Scholar paper.
 */
export async function createCitationFromPaper(projectId: string, paper: Paper): Promise<CitationRow> {
  const citation: CitationInsertExtended = {
    project_id: projectId,
    paper_id: paper.paperId,
    title: paper.title,
    authors: paper.authors.map((a) => a.name).join(', '),
    year: paper.year,
    journal: paper.journal?.name,
    doi: paper.externalIds?.DOI,
    url: paper.url,
    abstract: paper.abstract,
    source: 'ai_fetched',
    verified: !!paper.externalIds?.DOI,
  };
  return createCitation(citation);
}

/**
 * Update an existing citation.
 */
export async function updateCitation(id: string, updates: CitationUpdate): Promise<CitationRow> {
  const supabase = await createClient();
  const log = citationLogger({ citationId: id });
  const { data, error } = await supabase.from('citations').update(updates).eq('id', id).select().single();
  if (error) throw error;
  log.info({ updatedFields: Object.keys(updates) }, 'Citation updated');
  return data as CitationRow;
}

/**
 * Soft delete a citation.
 */
export async function deleteCitation(id: string): Promise<void> {
  const supabase = await createClient();
  const log = citationLogger({ citationId: id });
  const { error } = await supabase
    .from('citations')
    .update({ deleted_at: new Date().toISOString() } as CitationUpdate)
    .eq('id', id);
  if (error) throw error;
  log.info('Citation soft-deleted');
}

/**
 * Check if a citation already exists for a paper in a project.
 */
export async function isDuplicateCitation(
  projectId: string,
  paper: Paper
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const supabase = await createClient();

  // Check by paper_id first
  if (paper.paperId) {
    const { data: byPaperId } = await supabase
      .from('citations')
      .select('id')
      .eq('project_id', projectId)
      .eq('paper_id', paper.paperId)
      .is('deleted_at', null)
      .single();
    if (byPaperId) return { isDuplicate: true, existingId: byPaperId.id };
  }

  // Check by DOI if available
  if (paper.externalIds?.DOI) {
    const { data: byDoi } = await supabase
      .from('citations')
      .select('id')
      .eq('project_id', projectId)
      .eq('doi', paper.externalIds.DOI)
      .is('deleted_at', null)
      .single();
    if (byDoi) return { isDuplicate: true, existingId: byDoi.id };
  }

  return { isDuplicate: false };
}
