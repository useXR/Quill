import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { handleApiError, ApiError, ErrorCodes } from '@/lib/api';
import { getVaultItem, softDeleteVaultItem } from '@/lib/api/vault';

const logger = createLogger({ module: 'api-vault-item' });

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

  // Check if the user owns the project
  const projectOwner = (data.projects as unknown as { user_id: string })?.user_id;
  if (projectOwner !== userId) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this vault item');
  }
}

/**
 * GET /api/vault/[id]
 * Gets a single vault item by ID.
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

    // Get vault item
    const item = await getVaultItem(id);

    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get vault item');
  }
}

/**
 * DELETE /api/vault/[id]
 * Soft-deletes a vault item.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    // Soft delete
    await softDeleteVaultItem(id);

    logger.info({ vaultItemId: id, userId: user.id }, 'Vault item deleted');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to delete vault item');
  }
}
