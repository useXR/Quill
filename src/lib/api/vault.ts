import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { vaultLogger } from '@/lib/logger';
import { ApiError, ErrorCodes } from './errors';
import { createAuditLog } from './audit';
import type { VaultItem, ExtractionStatus } from '@/lib/vault/types';

export interface CreateVaultItemInput {
  projectId: string;
  filename: string;
  storagePath: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  sourceUrl?: string;
}

/**
 * Creates a new vault item for file storage and text extraction.
 * Initializes with 'pending' extraction status.
 */
export async function createVaultItem(input: CreateVaultItemInput): Promise<VaultItem> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, projectId: input.projectId });

  const { data, error } = await supabase
    .from('vault_items')
    .insert({
      user_id: user.id,
      project_id: input.projectId,
      filename: input.filename,
      storage_path: input.storagePath,
      type: input.fileType,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      source_url: input.sourceUrl ?? null,
      extraction_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    log.error({ error }, 'Failed to create vault item');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to create vault item');
  }

  log.info({ itemId: data.id, filename: input.filename }, 'Vault item created');

  // Create audit log (fire and forget - don't block on audit)
  void createAuditLog({
    action: 'vault:create',
    resourceType: 'vault_item',
    resourceId: data.id,
    userId: user.id,
    changes: { filename: input.filename, fileType: input.fileType },
  });

  return data;
}

/**
 * Gets all vault items for a project, excluding soft-deleted items.
 */
export async function getVaultItems(projectId: string): Promise<VaultItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, projectId });

  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    log.error({ error }, 'Failed to fetch vault items');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch vault items');
  }

  return data || [];
}

/**
 * Gets a single vault item by ID.
 */
export async function getVaultItem(id: string): Promise<VaultItem> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, itemId: id });

  const { data, error } = await supabase.from('vault_items').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Vault item not found');
    }
    log.error({ error }, 'Failed to fetch vault item');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch vault item');
  }

  return data;
}

/**
 * Updates the extraction status of a vault item.
 */
export async function updateVaultItemStatus(
  id: string,
  status: ExtractionStatus,
  additionalData?: Partial<{
    extractedText: string;
    chunkCount: number;
    error: string;
  }>
): Promise<VaultItem> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, itemId: id });

  const updateData: Record<string, unknown> = {
    extraction_status: status,
    updated_at: new Date().toISOString(),
  };

  if (additionalData?.extractedText !== undefined) {
    updateData.extracted_text = additionalData.extractedText;
  }

  if (additionalData?.chunkCount !== undefined) {
    updateData.chunk_count = additionalData.chunkCount;
  }

  // Explicitly filter by user_id to ensure RLS check passes
  const { data, error } = await supabase
    .from('vault_items')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Vault item not found');
    }
    log.error({ error }, 'Failed to update vault item status');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to update vault item status');
  }

  log.info({ status }, 'Vault item status updated');

  // Create audit log for extraction completion/failure
  if (status === 'success') {
    void createAuditLog({
      action: 'vault:extraction_complete',
      resourceType: 'vault_item',
      resourceId: id,
      userId: user.id,
      changes: { chunkCount: additionalData?.chunkCount },
    });
  } else if (status === 'failed') {
    void createAuditLog({
      action: 'vault:extraction_failed',
      resourceType: 'vault_item',
      resourceId: id,
      userId: user.id,
      changes: { error: additionalData?.error },
    });
  }

  return data;
}

/**
 * Soft deletes a vault item by setting deleted_at timestamp.
 * Item will be permanently deleted after 7-day grace period.
 *
 * NOTE: Uses admin client to bypass RLS since access is verified at API layer.
 */
export async function softDeleteVaultItem(id: string, userId: string): Promise<VaultItem> {
  const adminClient = createAdminClient();
  const log = vaultLogger({ userId, itemId: id });

  // Use admin client since access is verified at API layer via verifyVaultItemAccess
  const { data, error } = await adminClient
    .from('vault_items')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Vault item not found');
    }
    log.error({ error }, 'Failed to soft delete vault item');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to delete vault item');
  }

  log.info({ filename: data.filename }, 'Vault item soft deleted');

  void createAuditLog({
    action: 'vault:delete',
    resourceType: 'vault_item',
    resourceId: id,
    userId,
    changes: { filename: data.filename },
  });

  return data;
}

/**
 * Restores a soft-deleted vault item by clearing deleted_at timestamp.
 */
export async function restoreVaultItem(id: string): Promise<VaultItem> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const log = vaultLogger({ userId: user.id, itemId: id });

  // Explicitly filter by user_id to ensure RLS check passes
  const { data, error } = await supabase
    .from('vault_items')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Vault item not found');
    }
    log.error({ error }, 'Failed to restore vault item');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to restore vault item');
  }

  log.info({ filename: data.filename }, 'Vault item restored');

  void createAuditLog({
    action: 'vault:restore',
    resourceType: 'vault_item',
    resourceId: id,
    userId: user.id,
    changes: { filename: data.filename },
  });

  return data;
}

/**
 * Legacy alias for softDeleteVaultItem.
 * @deprecated Use softDeleteVaultItem instead.
 */
export const deleteVaultItem = softDeleteVaultItem;
