import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from './errors';
import type { Json } from '@/lib/supabase/database.types';

/**
 * Database row type for AI operations table.
 */
export interface AIOperation {
  id: string;
  document_id: string;
  user_id: string;
  operation_type: string;
  input_summary: string | null;
  snapshot_before: Json | null;
  output_content: string | null;
  status: string | null;
  created_at: string;
}

/**
 * Input for creating a new AI operation.
 */
export interface CreateAIOperationInput {
  documentId: string;
  operationType: 'selection' | 'cursor' | 'global';
  inputSummary: string;
  snapshotBefore: { content: string; selection?: { from: number; to: number } };
}

/**
 * Creates a new AI operation record with pending status.
 *
 * @param data - The operation data
 * @returns The created AI operation
 */
export async function createAIOperation(data: CreateAIOperationInput): Promise<AIOperation> {
  const supabase = await createClient();

  // Verify user authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { data: operation, error } = await supabase
    .from('ai_operations')
    .insert({
      document_id: data.documentId,
      user_id: user.id,
      operation_type: data.operationType,
      input_summary: data.inputSummary,
      snapshot_before: data.snapshotBefore as unknown as Json,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return operation;
}

/**
 * Updates the status of an AI operation.
 *
 * @param id - The operation ID
 * @param status - The new status
 * @param outputContent - Optional output content (for accepted operations)
 * @returns The updated AI operation
 */
export async function updateAIOperationStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'partial',
  outputContent?: string
): Promise<AIOperation> {
  const supabase = await createClient();

  const updateData: { status: string; output_content?: string } = { status };
  if (outputContent !== undefined) {
    updateData.output_content = outputContent;
  }

  const { data, error } = await supabase.from('ai_operations').update(updateData).eq('id', id).select().single();

  if (error) throw error;
  return data;
}

/**
 * Fetches recent AI operations for a document.
 * Only returns accepted or partial operations.
 *
 * @param documentId - The document ID
 * @param limit - Maximum number of operations to return (default: 10)
 * @returns Array of recent AI operations
 */
export async function getRecentOperations(documentId: string, limit = 10): Promise<AIOperation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ai_operations')
    .select('*')
    .eq('document_id', documentId)
    .in('status', ['accepted', 'partial'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Fetches a single AI operation by ID.
 *
 * @param id - The operation ID
 * @returns The AI operation or null if not found
 */
export async function getOperationById(id: string): Promise<AIOperation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('ai_operations').select('*').eq('id', id).single();

  if (error) return null;
  return data;
}
