import * as mammoth from 'mammoth';
import { vaultLogger } from '@/lib/logger';
import type { ExtractionResult } from './pdf';

/**
 * Extracts text content from a DOCX buffer.
 * Uses mammoth to parse the DOCX and extract raw text.
 *
 * @param buffer - The DOCX file as a Buffer
 * @returns ExtractionResult with text content or error
 */
export async function extractDocxText(buffer: Buffer): Promise<ExtractionResult> {
  const log = vaultLogger({});

  // Handle empty buffer
  if (!buffer || buffer.length === 0) {
    log.warn('DOCX extraction failed: empty buffer');
    return {
      text: '',
      success: false,
      error: 'Empty buffer provided',
    };
  }

  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      success: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown DOCX parsing error';
    log.error({ error: errorMessage }, 'DOCX extraction failed');

    return {
      text: '',
      success: false,
      error: errorMessage,
    };
  }
}
