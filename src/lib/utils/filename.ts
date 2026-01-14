/**
 * Maximum allowed filename length (common filesystem limit).
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Sanitizes a filename by removing dangerous characters and patterns.
 *
 * Security measures:
 * - Removes null bytes (security vulnerability)
 * - Removes path traversal sequences (../, ..\, /, \)
 * - Removes special characters that are invalid on Windows (<>:"|?*)
 * - Limits length to 255 characters while preserving file extension
 * - Returns 'unnamed' for empty or whitespace-only results
 *
 * @param filename - The raw filename to sanitize
 * @returns A safe filename string
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    return 'unnamed';
  }

  let sanitized = filename;

  // Remove null bytes (security vulnerability)
  sanitized = sanitized.replace(/\x00/g, '');

  // Remove path traversal sequences
  // Replace .. with single underscore
  sanitized = sanitized.replace(/\.\./g, '_');

  // Replace path separators with underscores
  sanitized = sanitized.replace(/[/\\]/g, '_');

  // Remove special characters invalid on Windows: < > : " | ? *
  sanitized = sanitized.replace(/[<>:"|?*]/g, '');

  // Remove control characters (0x00-0x1F)
  sanitized = sanitized.replace(/[\x00-\x1F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Handle length limit while preserving extension
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const lastDotIndex = sanitized.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex > sanitized.length - 10) {
      // Has a reasonable extension (less than 10 chars)
      const extension = sanitized.slice(lastDotIndex);
      const baseName = sanitized.slice(0, lastDotIndex);
      const maxBaseLength = MAX_FILENAME_LENGTH - extension.length;
      sanitized = baseName.slice(0, maxBaseLength) + extension;
    } else {
      // No extension or very long extension, just truncate
      sanitized = sanitized.slice(0, MAX_FILENAME_LENGTH);
    }
  }

  // Return 'unnamed' if the result is empty or only underscores/whitespace
  if (!sanitized || /^[_\s]*$/.test(sanitized)) {
    return 'unnamed';
  }

  return sanitized;
}
