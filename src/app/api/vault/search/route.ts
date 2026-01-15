import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { handleApiError, ApiError, ErrorCodes, formatZodError } from '@/lib/api';
import { search, type SearchMode } from '@/lib/api/search';

const logger = createLogger({ module: 'api-vault-search' });

/**
 * Zod schema for search request validation.
 */
const SearchRequestSchema = z.object({
  projectId: z.string().uuid('projectId must be a valid UUID'),
  query: z.string().min(1, 'Query must be at least 1 character').max(1000, 'Query must be at most 1000 characters'),
  limit: z.number().int().min(1).max(100).optional(),
  threshold: z.number().min(0).max(1).optional(),
  mode: z.enum(['semantic', 'keyword', 'hybrid']).optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * Verifies that the user owns the project.
 */
async function verifyProjectOwnership(projectId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('projects').select('id, user_id').eq('id', projectId).single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to verify project ownership');
  }

  if (data.user_id !== userId) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this project');
  }
}

/**
 * POST /api/vault/search
 * Performs search across vault chunks for a project.
 *
 * Request body:
 * - projectId: UUID of the project to search
 * - query: Search query text (1-1000 characters)
 * - limit?: Maximum number of results (1-100, default: 10)
 * - threshold?: Minimum similarity threshold for semantic search (0-1, default: 0.5)
 * - mode?: Search mode - 'semantic', 'keyword', or 'hybrid' (default: 'hybrid')
 *
 * Returns:
 * - results: Array of SearchResult objects sorted by relevance
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    // Parse and validate request body
    const body = await request.json();

    const validation = SearchRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { projectId, query, limit, threshold, mode } = validation.data;

    // Verify project ownership
    await verifyProjectOwnership(projectId, user.id);

    // Perform search with specified mode (defaults to hybrid)
    const results = await search(projectId, query, { mode: mode as SearchMode, limit, threshold });

    logger.info(
      { projectId, userId: user.id, mode: mode ?? 'hybrid', resultCount: results.length },
      'Search completed'
    );

    return NextResponse.json({ results, mode: mode ?? 'hybrid' });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to perform search');
  }
}
