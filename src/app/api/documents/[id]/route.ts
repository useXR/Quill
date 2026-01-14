import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  getDocument,
  updateDocument,
  deleteDocument,
  handleApiError,
  formatZodError,
  ApiError,
  ErrorCodes,
} from '@/lib/api';
import { UpdateDocumentSchema } from '@/lib/api/schemas/document';

const logger = createLogger({ module: 'api-document-detail' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]
 * Get a single document by ID.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const document = await getDocument(id);

    return NextResponse.json(document);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get document');
  }
}

/**
 * PATCH /api/documents/[id]
 * Update a document.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validation = UpdateDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const document = await updateDocument(id, validation.data);

    logger.info({ documentId: id }, 'Document updated via API');

    return NextResponse.json(document);
  } catch (error) {
    // Log version conflicts at INFO level - they're expected in concurrent editing
    if (error instanceof ApiError && error.code === ErrorCodes.CONFLICT) {
      logger.info({ documentId: (await params).id }, 'Version conflict detected during document update');
    }
    return handleApiError(error, logger, 'Failed to update document');
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteDocument(id);

    logger.info({ documentId: id }, 'Document deleted via API');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to delete document');
  }
}
