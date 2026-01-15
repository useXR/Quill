import { CHUNK_CONFIG } from '@/lib/vault/constants';

/**
 * Represents a text chunk with its content, position, and optional heading context.
 */
export interface Chunk {
  /** The text content of this chunk */
  content: string;
  /** Zero-based index indicating the chunk's position in the sequence */
  index: number;
  /** Hierarchical heading path (e.g., "Methods > Participants"), null if no section */
  heading_context: string | null;
}

/**
 * Section from PDF extraction with heading information.
 * Used by both pdf.ts and chunker.ts for consistency.
 */
export interface Section {
  level: number;
  title: string;
  heading_context: string;
  content: string;
  start_line: number;
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
 */
function isWithinSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;

  const prevChar = text.charCodeAt(index - 1);
  const currentChar = text.charCodeAt(index);

  const isPrevHighSurrogate = prevChar >= 0xd800 && prevChar <= 0xdbff;
  const isCurrentLowSurrogate = currentChar >= 0xdc00 && currentChar <= 0xdfff;

  return isPrevHighSurrogate && isCurrentLowSurrogate;
}

/**
 * Finds the best position to end a chunk, preferring sentence boundaries.
 */
function findChunkEnd(text: string, start: number, maxSize: number): number {
  const maxEnd = Math.min(start + maxSize, text.length);
  const searchText = text.slice(start, maxEnd);

  if (maxEnd === text.length) {
    return maxEnd;
  }

  let bestEnd = -1;
  let match: RegExpExecArray | null;
  SENTENCE_END_REGEX.lastIndex = 0;

  while ((match = SENTENCE_END_REGEX.exec(searchText)) !== null) {
    const endPos = start + match.index + 1;
    if (endPos <= maxEnd) {
      bestEnd = endPos;
    }
  }

  if (bestEnd > start && !isWithinSurrogatePair(text, bestEnd)) {
    return bestEnd;
  }

  const lastSpace = searchText.lastIndexOf(' ');
  if (lastSpace > 0) {
    const wordBoundary = start + lastSpace + 1;
    if (!isWithinSurrogatePair(text, wordBoundary)) {
      return wordBoundary;
    }
  }

  let cutPoint = maxEnd;
  if (isWithinSurrogatePair(text, cutPoint)) {
    cutPoint--;
  }

  return cutPoint;
}

/**
 * Normalizes heading context - converts empty string to null.
 */
function normalizeHeadingContext(context: string | null | undefined): string | null {
  if (!context || context.trim() === '') {
    return null;
  }
  return context;
}

/**
 * Chunks a single piece of text (internal helper).
 */
function chunkSingleText(
  text: string,
  config: ChunkConfig,
  startIndex: number,
  headingContext: string | null
): Chunk[] {
  const maxSize = config.maxSize ?? CHUNK_CONFIG.maxSize;
  const overlap = config.overlap ?? CHUNK_CONFIG.overlap;
  const minSize = config.minSize ?? CHUNK_CONFIG.minSize;

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return [];
  }

  const normalizedContext = normalizeHeadingContext(headingContext);

  if (trimmedText.length <= maxSize && trimmedText.length >= minSize) {
    return [{ content: trimmedText, index: startIndex, heading_context: normalizedContext }];
  }

  if (trimmedText.length < minSize) {
    return [{ content: trimmedText, index: startIndex, heading_context: normalizedContext }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = startIndex;

  while (start < trimmedText.length) {
    const chunkEnd = findChunkEnd(trimmedText, start, maxSize);
    const content = trimmedText.slice(start, chunkEnd).trimEnd();

    if (content.length > 0) {
      chunks.push({ content, index, heading_context: normalizedContext });
      index++;
    }

    let nextStart = chunkEnd - overlap;

    if (nextStart <= start) {
      nextStart = chunkEnd;
    }

    if (chunkEnd >= trimmedText.length) {
      break;
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Splits text into overlapping chunks suitable for embedding.
 * This is the original function for backward compatibility.
 *
 * @param text - The text to chunk
 * @param config - Optional configuration for chunk sizes
 * @returns Array of chunks with content, sequential indices, and heading_context: null
 */
export function chunkText(text: string, config?: ChunkConfig): Chunk[] {
  return chunkSingleText(text, config ?? {}, 0, null);
}

/**
 * Chunks text with section awareness, preserving heading context.
 * Each section is chunked independently, and all chunks from a section
 * share the same heading_context.
 *
 * @param text - The full document text (used as fallback if no sections)
 * @param sections - Sections extracted from PDF with heading context
 * @param config - Optional configuration for chunk sizes
 * @returns Array of chunks with heading context preserved
 */
export function chunkTextWithSections(text: string, sections: Section[], config?: ChunkConfig): Chunk[] {
  // If no sections provided, fall back to plain chunking
  if (!sections || sections.length === 0) {
    return chunkText(text, config);
  }

  const allChunks: Chunk[] = [];
  let currentIndex = 0;

  for (const section of sections) {
    // Skip sections with no content
    if (!section.content || section.content.trim().length === 0) {
      continue;
    }

    const sectionChunks = chunkSingleText(section.content, config ?? {}, currentIndex, section.heading_context || null);

    allChunks.push(...sectionChunks);
    currentIndex += sectionChunks.length;
  }

  // If no chunks were created from sections (all empty), fall back to plain text
  if (allChunks.length === 0) {
    return chunkText(text, config);
  }

  return allChunks;
}

/**
 * Estimates the number of chunks that will be created for a given text length.
 */
export function estimateChunkCount(textLength: number): number {
  const { maxSize, overlap } = CHUNK_CONFIG;

  if (textLength <= 0) {
    return 0;
  }

  if (textLength <= maxSize) {
    return 1;
  }

  const effectiveChunkSize = maxSize - overlap;
  return Math.ceil((textLength - overlap) / effectiveChunkSize);
}
