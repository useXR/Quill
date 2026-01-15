import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { handleApiError, ApiError, ErrorCodes } from '@/lib/api';

const logger = createLogger({ module: 'api-vault-chunks' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Verifies that the user owns the vault item through project ownership.
 */
async function verifyVaultItemAccess(vaultItemId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vault_items')
    .select('id, project_id, projects!inner(user_id)')
    .eq('id', vaultItemId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Vault item not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to verify vault item access');
  }

  const projectOwner = (data.projects as unknown as { user_id: string })?.user_id;
  if (projectOwner !== userId) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this vault item');
  }
}

export interface ChunkData {
  id: string;
  chunk_index: number;
  content: string;
  heading_context: string | null;
  has_embedding: boolean;
}

/**
 * GET /api/vault/[id]/chunks
 * Gets all chunks for a vault item, ordered by chunk_index.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    // Verify access
    await verifyVaultItemAccess(id, user.id);

    // Get chunks for this vault item
    const { data: chunks, error } = await supabase
      .from('vault_chunks')
      .select('id, chunk_index, content, heading_context, embedding')
      .eq('vault_item_id', id)
      .order('chunk_index', { ascending: true });

    if (error) {
      logger.error({ error, vaultItemId: id }, 'Failed to fetch chunks');
      throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch chunks');
    }

    // Transform to hide embedding vector but indicate if it exists
    const response: ChunkData[] = (chunks || []).map((chunk) => ({
      id: chunk.id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      heading_context: chunk.heading_context,
      has_embedding: chunk.embedding !== null,
    }));

    logger.info({ vaultItemId: id, chunkCount: response.length }, 'Chunks fetched');

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to fetch chunks');
  }
}
