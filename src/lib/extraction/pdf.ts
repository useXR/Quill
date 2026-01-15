import pdfParse from 'pdf-parse';
import { vaultLogger } from '@/lib/logger';

export interface ExtractionResult {
  text: string;
  success: boolean;
  error?: string;
  pageCount?: number;
}

/**
 * Extracts text content from a PDF buffer.
 * Uses pdf-parse to parse the PDF and extract text.
 *
 * @param buffer - The PDF file as a Buffer
 * @returns ExtractionResult with text content or error
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  const log = vaultLogger({});

  // Handle empty buffer
  if (!buffer || buffer.length === 0) {
    log.warn('PDF extraction failed: empty buffer');
    return {
      text: '',
      success: false,
      error: 'Empty buffer provided',
    };
  }

  try {
    const result = await pdfParse(buffer);

    return {
      text: result.text,
      success: true,
      pageCount: result.numpages,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    log.error({ error: errorMessage }, 'PDF extraction failed');

    return {
      text: '',
      success: false,
      error: errorMessage,
    };
  }
}
