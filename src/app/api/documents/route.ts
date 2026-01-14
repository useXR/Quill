import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getDocuments, createDocument, handleApiError, formatZodError } from '@/lib/api';
import { CreateDocumentSchema } from '@/lib/api/schemas/document';

const logger = createLogger({ module: 'api-documents' });

/**
 * GET /api/documents?project_id=xxx
 * List all documents for a project, ordered by sort_order.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id query parameter is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const documents = await getDocuments(projectId);

    return NextResponse.json(documents);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to list documents');
  }
}

/**
 * POST /api/documents
 * Create a new document.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = CreateDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const document = await createDocument(validation.data);

    logger.info({ documentId: document.id, projectId: document.project_id }, 'Document created via API');

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to create document');
  }
}
