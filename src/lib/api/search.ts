import { createClient } from '@/lib/supabase/server';
import { vaultLogger } from '@/lib/logger';
import { getEmbedding } from '@/lib/extraction/embeddings';
import { ApiError, ErrorCodes } from './errors';
import type { SearchResult } from '@/lib/vault/types';

/**
 * Default threshold for semantic similarity matching.
 * Can be overridden via VAULT_SEARCH_THRESHOLD env var.
 */
const DEFAULT_THRESHOLD = parseFloat(process.env.VAULT_SEARCH_THRESHOLD || '0.7');

/**
 * Default number of results to return.
 */
const DEFAULT_LIMIT = 10;

/**
 * Response type from the search_vault_chunks RPC function.
 * Uses snake_case to match PostgreSQL naming conventions.
 */
interface SearchVaultChunksRow {
  content: string;
  similarity: number;
  vault_item_id: string;
  filename: string;
  chunk_index: number;
}

/**
 * Transforms snake_case database response to camelCase SearchResult.
 */
function transformToSearchResult(row: SearchVaultChunksRow): SearchResult {
  return {
    content: row.content,
    similarity: row.similarity,
    vaultItemId: row.vault_item_id,
    filename: row.filename,
    chunkIndex: row.chunk_index,
  };
}

/**
 * Searches vault chunks using semantic similarity.
 *
 * @param projectId - The project to search within
 * @param query - The search query text
 * @param limit - Maximum number of results to return (default: 10)
 * @param threshold - Minimum similarity threshold (default: 0.7 or VAULT_SEARCH_THRESHOLD env var)
 * @returns Array of search results sorted by similarity (highest first)
 */
export async function searchVault(
  projectId: string,
  query: string,
  limit: number = DEFAULT_LIMIT,
  threshold: number = DEFAULT_THRESHOLD
): Promise<SearchResult[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, projectId });

  // Get embedding for the search query
  const queryEmbedding = await getEmbedding(query);

  log.info({ query, limit, threshold }, 'Performing semantic search');

  // Call the RPC function
  const { data, error } = await supabase.rpc('search_vault_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: threshold,
    match_count: limit,
    p_project_id: projectId,
    p_user_id: user.id,
  });

  if (error) {
    log.error({ error }, 'Semantic search failed');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Search failed');
  }

  // Handle null or undefined data
  if (!data) {
    return [];
  }

  // Transform results to camelCase
  const results = (data as SearchVaultChunksRow[]).map(transformToSearchResult);

  log.info({ resultCount: results.length }, 'Semantic search completed');

  return results;
}
