import { CHUNK_CONFIG } from '@/lib/vault/constants';

/**
 * Represents a text chunk with its content and position index.
 */
export interface Chunk {
  /** The text content of this chunk */
  content: string;
  /** Zero-based index indicating the chunk's position in the sequence */
  index: number;
}

/**
 * Configuration options for text chunking.
 */
export interface ChunkConfig {
  /** Maximum size of each chunk in characters (default: 2000) */
  maxSize?: number;
  /** Number of characters to overlap between chunks (default: 200) */
  overlap?: number;
  /** Minimum chunk size to avoid empty chunks (default: 50) */
  minSize?: number;
}

/**
 * Sentence ending pattern: period, exclamation, or question mark
 * followed by whitespace or end of string.
 */
const SENTENCE_END_REGEX = /[.!?](?=\s|$)/g;

/**
 * Checks if a character index is within a surrogate pair.
 * Returns true if the index would split a surrogate pair.
 */
function isWithinSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;

  const prevChar = text.charCodeAt(index - 1);
  const currentChar = text.charCodeAt(index);

  // Check if we're between a high surrogate (0xD800-0xDBFF) and low surrogate (0xDC00-0xDFFF)
  const isPrevHighSurrogate = prevChar >= 0xd800 && prevChar <= 0xdbff;
  const isCurrentLowSurrogate = currentChar >= 0xdc00 && currentChar <= 0xdfff;

  return isPrevHighSurrogate && isCurrentLowSurrogate;
}

/**
 * Finds the best position to end a chunk, preferring sentence boundaries,
 * then word boundaries, and ensuring unicode safety.
 */
function findChunkEnd(text: string, start: number, maxSize: number): number {
  const maxEnd = Math.min(start + maxSize, text.length);
  const searchText = text.slice(start, maxEnd);

  // If we can fit all remaining text, use it
  if (maxEnd === text.length) {
    return maxEnd;
  }

  // Look for the last sentence boundary within maxSize
  let bestEnd = -1;
  let match: RegExpExecArray | null;
  SENTENCE_END_REGEX.lastIndex = 0;

  while ((match = SENTENCE_END_REGEX.exec(searchText)) !== null) {
    // Position after the sentence-ending punctuation
    const endPos = start + match.index + 1;
    if (endPos <= maxEnd) {
      bestEnd = endPos;
    }
  }

  // If we found a sentence boundary, use it
  if (bestEnd > start) {
    // Ensure we're not splitting a surrogate pair
    if (!isWithinSurrogatePair(text, bestEnd)) {
      return bestEnd;
    }
  }

  // Fallback: look for last word boundary (space)
  const lastSpace = searchText.lastIndexOf(' ');
  if (lastSpace > 0) {
    const wordBoundary = start + lastSpace + 1;
    if (!isWithinSurrogatePair(text, wordBoundary)) {
      return wordBoundary;
    }
  }

  // Last resort: hard cut at maxSize, but avoid splitting surrogates
  let cutPoint = maxEnd;
  if (isWithinSurrogatePair(text, cutPoint)) {
    cutPoint--; // Move back to include the complete surrogate pair
  }

  return cutPoint;
}

/**
 * Splits text into overlapping chunks suitable for embedding.
 *
 * Uses sentence boundaries when possible, falls back to word boundaries,
 * and guarantees forward progress to avoid infinite loops.
 *
 * @param text - The text to chunk
 * @param config - Optional configuration for chunk sizes
 * @returns Array of chunks with content and sequential indices
 */
export function chunkText(text: string, config?: ChunkConfig): Chunk[] {
  const maxSize = config?.maxSize ?? CHUNK_CONFIG.maxSize;
  const overlap = config?.overlap ?? CHUNK_CONFIG.overlap;
  const minSize = config?.minSize ?? CHUNK_CONFIG.minSize;

  // Trim and handle empty/whitespace-only text
  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return [];
  }

  // If text fits in a single chunk and meets minimum size
  if (trimmedText.length <= maxSize && trimmedText.length >= minSize) {
    return [{ content: trimmedText, index: 0 }];
  }

  // If text is shorter than minSize but not empty, still return it
  if (trimmedText.length < minSize) {
    return [{ content: trimmedText, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmedText.length) {
    const chunkEnd = findChunkEnd(trimmedText, start, maxSize);

    // Extract chunk content and trim trailing whitespace
    const content = trimmedText.slice(start, chunkEnd).trimEnd();

    // Only add non-empty chunks
    if (content.length > 0) {
      chunks.push({ content, index });
      index++;
    }

    // Calculate next start position with overlap
    let nextStart = chunkEnd - overlap;

    // CRITICAL: Ensure forward progress to prevent infinite loops
    // If nextStart would not advance past current start, force advancement
    if (nextStart <= start) {
      nextStart = chunkEnd;
    }

    // If we've processed all text, exit
    if (chunkEnd >= trimmedText.length) {
      break;
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Estimates the number of chunks that will be created for a given text length.
 *
 * Useful for progress estimation before processing.
 *
 * @param textLength - The length of text in characters
 * @returns Estimated number of chunks
 */
export function estimateChunkCount(textLength: number): number {
  const { maxSize, overlap } = CHUNK_CONFIG;

  if (textLength <= 0) {
    return 0;
  }

  if (textLength <= maxSize) {
    return 1;
  }

  // Effective chunk size after accounting for overlap
  const effectiveChunkSize = maxSize - overlap;

  // First chunk covers maxSize, subsequent chunks cover effectiveChunkSize each
  return Math.ceil((textLength - overlap) / effectiveChunkSize);
}
