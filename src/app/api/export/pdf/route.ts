import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exportLogger } from '@/lib/logger';
import { handleApiError, formatZodError, ApiError, ErrorCodes } from '@/lib/api';
import { createAuditLog } from '@/lib/api/audit';
import { exportToPdf, tiptapToHtml, type DocumentWithProject } from '@/lib/export';

/**
 * Max duration for serverless function.
 * PDF generation with Puppeteer can take longer than typical API calls.
 */
export const maxDuration = 60;

/**
 * Validation schema for PDF export request
 */
const ExportPdfSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  format: z.enum(['letter', 'a4']).optional().default('letter'),
  includePageNumbers: z.boolean().optional().default(false),
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
 * POST /api/export/pdf
 * Export a document as PDF file.
 */
export async function POST(request: NextRequest) {
  const logger = exportLogger({ format: 'pdf' });

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = ExportPdfSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { documentId, format, includePageNumbers } = validation.data;

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const loggerWithUser = exportLogger({ format: 'pdf', documentId, userId: user.id });

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

    // Generate PDF file
    const pdfBuffer = await exportToPdf(htmlContent, {
      title: document.title,
      format,
      includePageNumbers,
    });

    // Log successful export
    loggerWithUser.info({ documentTitle: document.title }, 'Document exported to PDF');

    // Create audit log
    await createAuditLog('export:pdf', {
      userId: user.id,
      documentId,
      documentTitle: document.title,
      format,
      includePageNumbers,
    });

    // Generate sanitized filename
    const filename = sanitizeFilename(document.title) + '.pdf';

    // Return the PDF file as a binary response
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to export document to PDF');
  }
}
