import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { ApiError, ErrorCodes } from './errors';
import { extractTextFromTipTap } from '@/lib/editor/extract-text';
import type { Document } from '@/lib/supabase/types';
import type { CreateDocumentInput, UpdateDocumentInput } from './schemas/document';

const logger = createLogger({ module: 'documents-api' });

/**
 * Get all documents for a project, ordered by sort_order.
 */
export async function getDocuments(projectId: string): Promise<Document[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    logger.error({ error, projectId, userId: user.id }, 'Failed to fetch documents');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch documents');
  }

  return data || [];
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id: string): Promise<Document> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
    }
    logger.error({ error, documentId: id, userId: user.id }, 'Failed to fetch document');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch document');
  }

  return data;
}

/**
 * Create a new document for a project.
 * Automatically assigns the next sort_order value.
 */
export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  // Get the current max sort_order for this project
  const { data: maxSortDoc } = await supabase
    .from('documents')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxSortDoc?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: input.project_id,
      title: input.title,
      sort_order: nextSortOrder,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error, projectId: input.project_id, userId: user.id }, 'Failed to create document');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to create document');
  }

  logger.info({ documentId: data.id, projectId: input.project_id, userId: user.id }, 'Document created');

  return data;
}

/**
 * Update an existing document.
 * Supports optimistic concurrency control via expectedVersion.
 */
export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<Document> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  // Check version if expectedVersion is provided
  if (input.expectedVersion !== undefined) {
    const { data: current, error: versionError } = await supabase
      .from('documents')
      .select('version')
      .eq('id', id)
      .single();

    if (versionError) {
      if (versionError.code === 'PGRST116') {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
      }
      logger.error({ error: versionError, documentId: id, userId: user.id }, 'Failed to check document version');
      throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to check document version');
    }

    if (current && current.version !== input.expectedVersion) {
      throw new ApiError(409, ErrorCodes.CONFLICT, 'Version conflict detected');
    }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    updateData.title = input.title;
  }

  if (input.content !== undefined) {
    updateData.content = input.content;
    // Auto-extract plain text for AI chat context
    updateData.content_text = extractTextFromTipTap(input.content);
  }

  // Allow explicit content_text override if provided
  if (input.content_text !== undefined) {
    updateData.content_text = input.content_text;
  }

  // Increment version if expectedVersion was provided
  if (input.expectedVersion !== undefined) {
    updateData.version = input.expectedVersion + 1;
  }

  const { data, error } = await supabase.from('documents').update(updateData).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
    }
    logger.error({ error, documentId: id, userId: user.id }, 'Failed to update document');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to update document');
  }

  logger.info({ documentId: id, userId: user.id }, 'Document updated');

  return data;
}

/**
 * Delete a document by ID.
 */
export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
    }
    logger.error({ error, documentId: id, userId: user.id }, 'Failed to delete document');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to delete document');
  }

  logger.info({ documentId: id, userId: user.id }, 'Document deleted');
}
