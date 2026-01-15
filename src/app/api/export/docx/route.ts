import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exportLogger } from '@/lib/logger';
import { handleApiError, formatZodError, ApiError, ErrorCodes } from '@/lib/api';
import { createAuditLog } from '@/lib/api/audit';
import { exportToDocx, tiptapToHtml, type DocumentWithProject } from '@/lib/export';

/**
 * Validation schema for DOCX export request
 */
const ExportDocxSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  includeTitle: z.boolean().optional().default(true),
  pageSize: z.enum(['letter', 'a4']).optional().default('letter'),
});

/**
 * Sanitize filename for Content-Disposition header.
 * Removes or replaces characters that are unsafe for filenames.
 */
function sanitizeFilename(filename: string): string {
  return (
    filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/\.+/g, '.') // Collapse multiple dots
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .substring(0, 200) // Limit length
      .trim() || 'document'
  ); // Fallback if empty
}

/**
 * POST /api/export/docx
 * Export a document as DOCX file.
 */
export async function POST(request: NextRequest) {
  const logger = exportLogger({ format: 'docx' });

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = ExportDocxSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { documentId, includeTitle, pageSize } = validation.data;

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const loggerWithUser = exportLogger({ format: 'docx', documentId, userId: user.id });

    // Fetch document with project info for authorization check
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*, projects!inner(user_id)')
      .eq('id', documentId)
      .single<DocumentWithProject>();

    if (docError) {
      if (docError.code === 'PGRST116') {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
      }
      loggerWithUser.error({ error: docError }, 'Failed to fetch document');
      throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch document');
    }

    // Check authorization - user must own the project
    if (document.projects.user_id !== user.id) {
      throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this document');
    }

    // Convert TipTap JSON content to HTML
    const htmlContent = document.content ? tiptapToHtml(document.content) : '';

    // Generate DOCX file
    const docxBuffer = await exportToDocx(htmlContent, {
      title: document.title,
      includeTitle,
      pageSize,
    });

    // Log successful export
    loggerWithUser.info({ documentTitle: document.title }, 'Document exported to DOCX');

    // Create audit log
    await createAuditLog('export:docx', {
      userId: user.id,
      documentId,
      documentTitle: document.title,
      pageSize,
      includeTitle,
    });

    // Generate sanitized filename
    const filename = sanitizeFilename(document.title) + '.docx';

    // Return the DOCX file as a binary response
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(docxBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to export document to DOCX');
  }
}
