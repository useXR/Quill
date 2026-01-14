import { describe, it, expect } from 'vitest';
import { chunkText, estimateChunkCount } from '../chunker';
import { CHUNK_CONFIG } from '@/lib/vault/constants';

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const text = 'This is a short text that fits in one chunk.';
    const result = chunkText(text);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(text);
    expect(result[0].index).toBe(0);
  });

  it('returns empty array for empty text', () => {
    const result = chunkText('');

    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only text', () => {
    const result = chunkText('   \n\t  \n   ');

    expect(result).toEqual([]);
  });

  it('chunks text with default config (maxSize: 2000)', () => {
    // Create text longer than maxSize (2000 chars)
    const sentence = 'This is a test sentence. ';
    const longText = sentence.repeat(100); // ~2500 chars

    const result = chunkText(longText);

    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_CONFIG.maxSize);
    });
  });

  it('assigns sequential indices to chunks', () => {
    const sentence = 'This is a test sentence. ';
    const longText = sentence.repeat(100);

    const result = chunkText(longText);

    result.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('breaks at sentence boundaries when possible (ends with .)', () => {
    // Create text that will need to be chunked with sentence boundaries available
    // We need > 2000 chars total with sentences near the boundary
    const filler = 'Word '.repeat(350); // ~1750 chars
    const sentences = 'First sentence here. Second sentence here. Third sentence here. ';
    const moreFiller = 'More '.repeat(100); // ~500 chars
    const text = filler + sentences + moreFiller;

    // Verify our setup: text > maxSize
    expect(text.length).toBeGreaterThan(CHUNK_CONFIG.maxSize);

    const result = chunkText(text);

    // Should create multiple chunks
    expect(result.length).toBeGreaterThan(1);

    // First chunk should end at a sentence boundary (ends with .)
    // The chunker should find "First sentence here." or similar
    expect(result[0].content.trimEnd().endsWith('.')).toBe(true);
  });

  it('handles unicode correctly (no orphan surrogates)', () => {
    // Create text with emoji (surrogate pairs) near chunk boundary
    const emoji = '\u{1F600}'; // grinning face (surrogate pair)
    const textBefore = 'A'.repeat(1990);
    const text = textBefore + emoji + ' more text here.';

    const result = chunkText(text);

    // Verify no orphan surrogates by checking content is valid
    result.forEach((chunk) => {
      // JSON.stringify will throw on invalid surrogates
      expect(() => JSON.stringify(chunk.content)).not.toThrow();
      // Check for orphan high surrogate (0xD800-0xDBFF)
      expect(chunk.content).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      // Check for orphan low surrogate (0xDC00-0xDFFF)
      expect(chunk.content).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    });
  });

  it('always makes forward progress (no infinite loops)', () => {
    // Edge case: text with no spaces or sentence boundaries
    const noSpaces = 'A'.repeat(3000);

    const startTime = Date.now();
    const result = chunkText(noSpaces);
    const elapsed = Date.now() - startTime;

    // Should complete quickly (not loop infinitely)
    expect(elapsed).toBeLessThan(1000);
    expect(result.length).toBeGreaterThan(1);

    // Verify chunks cover the entire text
    const totalLength = result.reduce((sum, chunk, i) => {
      if (i === 0) return chunk.content.length;
      // Account for overlap
      return sum + chunk.content.length - CHUNK_CONFIG.overlap;
    }, 0);
    // Allow some tolerance due to overlap calculations
    expect(totalLength).toBeGreaterThanOrEqual(noSpaces.length - CHUNK_CONFIG.overlap);
  });
});

describe('estimateChunkCount', () => {
  it('estimates chunk count based on text length', () => {
    // Short text (single chunk)
    expect(estimateChunkCount(100)).toBe(1);

    // Exactly maxSize
    expect(estimateChunkCount(CHUNK_CONFIG.maxSize)).toBe(1);

    // Just over maxSize (considering overlap)
    const effectiveChunkSize = CHUNK_CONFIG.maxSize - CHUNK_CONFIG.overlap;
    expect(estimateChunkCount(CHUNK_CONFIG.maxSize + effectiveChunkSize)).toBe(2);

    // Large text
    const largeLength = 10000;
    const expected = Math.ceil((largeLength - CHUNK_CONFIG.overlap) / effectiveChunkSize);
    expect(estimateChunkCount(largeLength)).toBe(expected);
  });
});
