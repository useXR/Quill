import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { handleApiError, ApiError, ErrorCodes } from '@/lib/api';
import { sanitizeFilename } from '@/lib/utils/filename';
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES, FILE_TYPE_MAP, VAULT_STORAGE_BUCKET } from '@/lib/vault/constants';
import { createVaultItem } from '@/lib/api/vault';
import { getExtractionQueue } from '@/lib/queue';

const logger = createLogger({ module: 'api-vault-upload' });

/**
 * Gets the file type key from a MIME type.
 */
function getFileTypeFromMime(mimeType: string): keyof typeof FILE_SIZE_LIMITS | null {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'text/plain':
      return 'txt';
    default:
      return null;
  }
}

/**
 * Validates that the file type is allowed.
 */
function validateFileType(mimeType: string): asserts mimeType is (typeof ALLOWED_MIME_TYPES)[number] {
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      `Unsupported file type: ${mimeType}. Allowed types: PDF, DOCX, TXT`
    );
  }
}

/**
 * Validates that the file size is within limits for its type.
 */
function validateFileSize(size: number, fileType: keyof typeof FILE_SIZE_LIMITS): void {
  const limit = FILE_SIZE_LIMITS[fileType];
  if (size > limit) {
    const limitMB = Math.round(limit / (1024 * 1024));
    const sizeMB = Math.round(size / (1024 * 1024));
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      `File size ${sizeMB}MB exceeds ${limitMB}MB limit for ${fileType.toUpperCase()} files`
    );
  }
}

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
 * POST /api/vault/upload
 * Uploads a file to the vault and queues it for text extraction.
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'No file provided');
    }

    if (!projectId) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'No projectId provided');
    }

    // Verify project ownership
    await verifyProjectOwnership(projectId, user.id);

    // Validate file type
    validateFileType(file.type);

    // Get file type key
    const fileType = getFileTypeFromMime(file.type);
    if (!fileType) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `Unsupported file type: ${file.type}`);
    }

    // Validate file size
    validateFileSize(file.size, fileType);

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name);

    // Generate storage path
    const storagePath = `${user.id}/${projectId}/${Date.now()}-${sanitizedFilename}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage.from(VAULT_STORAGE_BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      logger.error({ error: uploadError, userId: user.id, projectId }, 'Failed to upload file to storage');
      throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to upload file');
    }

    // Create vault item record
    const vaultItem = await createVaultItem({
      projectId,
      filename: sanitizedFilename,
      storagePath,
      fileType,
      mimeType: file.type,
      fileSize: file.size,
    });

    // Queue for extraction
    const queue = getExtractionQueue();
    queue.enqueue(vaultItem.id);

    logger.info(
      { vaultItemId: vaultItem.id, filename: sanitizedFilename, userId: user.id, projectId },
      'File uploaded and queued for extraction'
    );

    return NextResponse.json(vaultItem, { status: 201 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to upload file');
  }
}
