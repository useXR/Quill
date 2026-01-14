import type { ExtractionResult } from './pdf';

/**
 * Extracts text content from a plain text buffer.
 * Simply converts the buffer to a UTF-8 string.
 *
 * @param buffer - The text file as a Buffer
 * @returns ExtractionResult with text content or error
 */
export function extractTextContent(buffer: Buffer): ExtractionResult {
  // Handle empty buffer
  if (!buffer || buffer.length === 0) {
    return {
      text: '',
      success: false,
      error: 'Empty buffer provided',
    };
  }

  try {
    const text = buffer.toString('utf-8');

    return {
      text,
      success: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown text decoding error';

    return {
      text: '',
      success: false,
      error: errorMessage,
    };
  }
}
