import { createClient } from '@/lib/supabase/server';

/**
 * Database row type for type-safe queries.
 * Best Practice: Type database query results explicitly.
 */
interface ChatHistoryRow {
  id: string;
  project_id: string;
  document_id: string | null;
  role: string;
  content: string;
  created_at: string;
}

/**
 * A chat message in the conversation history.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

/**
 * Paginated result wrapper for chat history queries.
 */
export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Fetches paginated chat history for a project, optionally filtered by document.
 *
 * @param projectId - The project ID to fetch chat history for
 * @param documentId - Optional document ID to filter by
 * @param options - Pagination options (limit and cursor)
 * @returns Paginated chat messages
 */
export async function getChatHistory(
  projectId: string,
  documentId?: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedResult<ChatMessage>> {
  const { limit = 50, cursor } = options;
  const supabase = await createClient();

  // Build query with chainable methods
  // Note: .returns<T>() must be at the end of the chain for type inference
  let query = supabase
    .from('chat_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query.returns<ChatHistoryRow[]>();

  if (error) throw error;

  const hasMore = (data?.length || 0) > limit;
  const items = hasMore ? data!.slice(0, limit) : data || [];
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return {
    data: items.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: new Date(row.created_at),
    })),
    nextCursor,
    hasMore,
  };
}

/**
 * Saves a chat message to the database.
 *
 * @param data - The message data to save
 * @returns The saved chat message
 */
export async function saveChatMessage(data: {
  projectId: string;
  documentId?: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<ChatMessage> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('chat_history')
    .insert({
      project_id: data.projectId,
      document_id: data.documentId || null,
      role: data.role,
      content: data.content,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Clears chat history for a project, optionally filtered by document.
 *
 * @param projectId - The project ID to clear chat history for
 * @param documentId - Optional document ID to filter by
 */
export async function clearChatHistory(projectId: string, documentId?: string): Promise<void> {
  const supabase = await createClient();

  let query = supabase.from('chat_history').delete().eq('project_id', projectId);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { error } = await query;
  if (error) throw error;
}
