import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { handleApiError, ApiError, ErrorCodes } from '@/lib/api';
import { getVaultItem } from '@/lib/api/vault';
import { processExtraction } from '@/lib/extraction';

const logger = createLogger({ module: 'api-vault-extract' });

/**
 * POST /api/vault/extract
 * Manually triggers extraction for a vault item.
 *
 * Body: { itemId: string }
 *
 * This endpoint allows manual re-extraction of a vault item,
 * useful for retrying failed extractions or updating content.
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

    // Parse request body
    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== 'string') {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'itemId is required and must be a string');
    }

    // Verify the vault item exists and belongs to the user
    const item = await getVaultItem(itemId);

    if (item.user_id !== user.id) {
      throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this vault item');
    }

    logger.info({ itemId, userId: user.id }, 'Starting manual extraction');

    // Process extraction
    const result = await processExtraction(itemId);

    if (result.success) {
      logger.info({ itemId, status: result.status, chunkCount: result.chunkCount }, 'Extraction completed');
    } else {
      logger.warn({ itemId, status: result.status, error: result.error }, 'Extraction failed or partial');
    }

    return NextResponse.json({
      success: result.success,
      status: result.status,
      chunkCount: result.chunkCount,
      error: result.error,
    });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to process extraction');
  }
}
