import { createClient } from '@/lib/supabase/server';
import { vaultLogger } from '@/lib/logger';
import { getEmbedding } from '@/lib/extraction/embeddings';
import { ApiError, ErrorCodes } from './errors';
import type { SearchResult } from '@/lib/vault/types';

/**
 * Search mode for vault queries.
 * - 'semantic': Uses embedding similarity (meaning-based)
 * - 'keyword': Uses exact text matching (phrase-based)
 * - 'hybrid': Combines both methods, merging and re-ranking results
 */
export type SearchMode = 'semantic' | 'keyword' | 'hybrid';

/**
 * Default threshold for semantic similarity matching.
 * Can be overridden via VAULT_SEARCH_THRESHOLD env var.
 */
const DEFAULT_THRESHOLD = parseFloat(process.env.VAULT_SEARCH_THRESHOLD || '0.5');

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
  heading_context: string | null;
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
    headingContext: row.heading_context,
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

  // DEBUG: Check how many chunks exist for this project
  const { data: chunkStats, error: statsError } = await supabase
    .from('vault_chunks')
    .select('id, vault_item_id, embedding')
    .eq('vault_item_id', projectId);

  // Get chunks via vault_items join to check project ownership
  const { data: vaultItems } = await supabase
    .from('vault_items')
    .select('id, filename, chunk_count, extraction_status')
    .eq('project_id', projectId)
    .eq('user_id', user.id);

  log.info(
    {
      vaultItems: vaultItems?.map((v) => ({
        id: v.id,
        filename: v.filename,
        chunkCount: v.chunk_count,
        status: v.extraction_status,
      })),
      directChunkQuery: { count: chunkStats?.length, error: statsError?.message },
    },
    'DEBUG: Vault items and chunks for project'
  );

  // Check if any vault items have chunks with embeddings
  if (vaultItems && vaultItems.length > 0) {
    for (const item of vaultItems) {
      const { data: itemChunks, error: chunkError } = await supabase
        .from('vault_chunks')
        .select('id, chunk_index, embedding')
        .eq('vault_item_id', item.id)
        .limit(3);

      log.info(
        {
          vaultItemId: item.id,
          filename: item.filename,
          chunksFound: itemChunks?.length ?? 0,
          chunkError: chunkError?.message,
          sampleChunks: itemChunks?.map((c) => ({
            id: c.id,
            index: c.chunk_index,
            hasEmbedding: c.embedding !== null,
            embeddingPreview: c.embedding ? `${String(c.embedding).substring(0, 50)}...` : null,
          })),
        },
        'DEBUG: Chunks for vault item'
      );
    }
  }

  // Get embedding for the search query
  const queryEmbedding = await getEmbedding(query);

  log.info(
    {
      query,
      limit,
      threshold,
      embeddingLength: queryEmbedding.length,
      embeddingPreview: `[${queryEmbedding.slice(0, 3).join(', ')}...]`,
    },
    'Performing semantic search'
  );

  // Call the RPC function
  // Note: pgvector expects embeddings as JSON string format '[0.1,0.2,...]'
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

  // DEBUG: If no results, try with threshold 0 to see actual similarity scores
  if (!data || data.length === 0) {
    log.info('No results with current threshold, checking with threshold=0');

    const { data: debugData, error: debugError } = await supabase.rpc('search_vault_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0,
      match_count: 5,
      p_project_id: projectId,
      p_user_id: user.id,
    });

    log.info(
      {
        debugError: debugError?.message,
        debugResults: debugData?.map((r: { similarity: number; filename: string; content: string }) => ({
          similarity: r.similarity,
          filename: r.filename,
          contentPreview: r.content?.substring(0, 100),
        })),
      },
      'DEBUG: Search results with threshold=0'
    );
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

/**
 * Response type from the search_vault_chunks_keyword RPC function.
 */
interface SearchVaultChunksKeywordRow {
  content: string;
  vault_item_id: string;
  filename: string;
  chunk_index: number;
  match_rank: number;
  heading_context: string | null;
}

/**
 * Searches vault chunks using exact keyword/phrase matching.
 *
 * @param projectId - The project to search within
 * @param query - The search query text (exact phrase to match)
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Array of search results sorted by match rank (most occurrences first)
 */
export async function searchVaultKeyword(
  projectId: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResult[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, projectId });

  log.info({ query, limit }, 'Performing keyword search');

  const { data, error } = await supabase.rpc('search_vault_chunks_keyword', {
    search_query: query,
    match_count: limit,
    p_project_id: projectId,
    p_user_id: user.id,
  });

  if (error) {
    log.error({ error }, 'Keyword search failed');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Search failed');
  }

  if (!data) {
    return [];
  }

  // Transform results, using match_rank as a normalized similarity score
  const maxRank = Math.max(...(data as SearchVaultChunksKeywordRow[]).map((r) => r.match_rank), 1);
  const results: SearchResult[] = (data as SearchVaultChunksKeywordRow[]).map((row) => ({
    content: row.content,
    similarity: row.match_rank / maxRank, // Normalize to 0-1 range
    vaultItemId: row.vault_item_id,
    filename: row.filename,
    chunkIndex: row.chunk_index,
    headingContext: row.heading_context,
  }));

  log.info({ resultCount: results.length }, 'Keyword search completed');

  return results;
}

/**
 * Performs a hybrid search combining semantic and keyword matching.
 * Results from both methods are merged and re-ranked.
 *
 * @param projectId - The project to search within
 * @param query - The search query text
 * @param limit - Maximum number of results to return (default: 10)
 * @param threshold - Minimum similarity threshold for semantic search (default: 0.5)
 * @returns Array of search results with combined scoring
 */
export async function searchVaultHybrid(
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

  log.info({ query, limit, threshold }, 'Performing hybrid search');

  // Run both searches in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    searchVault(projectId, query, limit, threshold),
    searchVaultKeyword(projectId, query, limit),
  ]);

  // Merge results using a map keyed by vaultItemId + chunkIndex
  const resultMap = new Map<string, SearchResult & { semanticScore: number; keywordScore: number }>();

  // Add semantic results
  for (const result of semanticResults) {
    const key = `${result.vaultItemId}-${result.chunkIndex}`;
    resultMap.set(key, {
      ...result,
      semanticScore: result.similarity,
      keywordScore: 0,
    });
  }

  // Merge keyword results
  for (const result of keywordResults) {
    const key = `${result.vaultItemId}-${result.chunkIndex}`;
    const existing = resultMap.get(key);
    if (existing) {
      // Chunk found in both - boost the score
      existing.keywordScore = result.similarity;
    } else {
      // Keyword-only result
      resultMap.set(key, {
        ...result,
        semanticScore: 0,
        keywordScore: result.similarity,
      });
    }
  }

  // Calculate combined score and sort
  // Weight: keyword matches are boosted because they indicate exact phrase presence
  const SEMANTIC_WEIGHT = 0.4;
  const KEYWORD_WEIGHT = 0.6;

  const mergedResults = Array.from(resultMap.values())
    .map((r) => ({
      content: r.content,
      vaultItemId: r.vaultItemId,
      filename: r.filename,
      chunkIndex: r.chunkIndex,
      headingContext: r.headingContext,
      similarity: r.semanticScore * SEMANTIC_WEIGHT + r.keywordScore * KEYWORD_WEIGHT,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  log.info(
    {
      semanticCount: semanticResults.length,
      keywordCount: keywordResults.length,
      mergedCount: mergedResults.length,
    },
    'Hybrid search completed'
  );

  return mergedResults;
}

/**
 * Unified search function that supports multiple search modes.
 *
 * @param projectId - The project to search within
 * @param query - The search query text
 * @param options - Search options including mode, limit, and threshold
 * @returns Array of search results
 */
export async function search(
  projectId: string,
  query: string,
  options: {
    mode?: SearchMode;
    limit?: number;
    threshold?: number;
  } = {}
): Promise<SearchResult[]> {
  const { mode = 'hybrid', limit = DEFAULT_LIMIT, threshold = DEFAULT_THRESHOLD } = options;

  switch (mode) {
    case 'semantic':
      return searchVault(projectId, query, limit, threshold);
    case 'keyword':
      return searchVaultKeyword(projectId, query, limit);
    case 'hybrid':
      return searchVaultHybrid(projectId, query, limit, threshold);
    default:
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `Invalid search mode: ${mode}`);
  }
}
