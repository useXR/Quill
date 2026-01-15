import { describe, it, expect } from 'vitest';
import { chunkText, chunkTextWithSections, estimateChunkCount, type Section } from '../chunker';
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

describe('Section-aware chunking', () => {
  it('chunks by section when sections provided', () => {
    const sections: Section[] = [
      {
        level: 1,
        title: 'Introduction',
        heading_context: 'Introduction',
        content: 'Intro content here.',
        start_line: 0,
      },
      {
        level: 2,
        title: 'Methods',
        heading_context: 'Introduction > Methods',
        content: 'Methods content.',
        start_line: 4,
      },
    ];

    const chunks = chunkTextWithSections('Full text here', sections);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].heading_context).toBe('Introduction');
    expect(chunks[1].heading_context).toBe('Introduction > Methods');
  });

  it('preserves heading context in each chunk when section spans multiple chunks', () => {
    const longContent = 'A'.repeat(3000); // Will require multiple chunks
    const sections: Section[] = [
      { level: 1, title: 'Results', heading_context: 'Results', content: longContent, start_line: 0 },
    ];

    const chunks = chunkTextWithSections(`# Results\n\n${longContent}`, sections);

    // All chunks from this section should have the same heading context
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.heading_context).toBe('Results');
    });
  });

  it('handles documents without sections', () => {
    const text = 'Just plain text without any headings.';
    const sections: Section[] = [];

    const chunks = chunkTextWithSections(text, sections);

    expect(chunks.length).toBe(1);
    expect(chunks[0].heading_context).toBeNull();
  });

  it('respects section boundaries when chunking', () => {
    const sections: Section[] = [
      { level: 1, title: 'A', heading_context: 'A', content: 'Content A.', start_line: 0 },
      { level: 1, title: 'B', heading_context: 'B', content: 'Content B.', start_line: 4 },
    ];

    const chunks = chunkTextWithSections('# A\n\nContent A.\n\n# B\n\nContent B.', sections);

    // Chunks should not span sections
    const aChunks = chunks.filter((c) => c.heading_context === 'A');
    const bChunks = chunks.filter((c) => c.heading_context === 'B');

    expect(aChunks.length).toBeGreaterThan(0);
    expect(bChunks.length).toBeGreaterThan(0);
  });

  it('handles section with empty heading_context', () => {
    const sections: Section[] = [
      { level: 0, title: '', heading_context: '', content: 'Content without heading.', start_line: 0 },
    ];

    const chunks = chunkTextWithSections('Content without heading.', sections);

    expect(chunks.length).toBe(1);
    // Empty string heading_context should be converted to null
    expect(chunks[0].heading_context).toBeNull();
  });

  it('handles deeply nested headings (6 levels)', () => {
    const sections: Section[] = [
      { level: 6, title: 'Deep', heading_context: 'A > B > C > D > E > Deep', content: 'Deep content.', start_line: 0 },
    ];

    const chunks = chunkTextWithSections('Deep content.', sections);

    expect(chunks[0].heading_context).toBe('A > B > C > D > E > Deep');
  });

  it('skips sections with empty content', () => {
    const sections: Section[] = [
      { level: 1, title: 'Empty', heading_context: 'Empty', content: '', start_line: 0 },
      { level: 1, title: 'HasContent', heading_context: 'HasContent', content: 'Real content here.', start_line: 2 },
    ];

    const chunks = chunkTextWithSections('Real content here.', sections);

    expect(chunks.length).toBe(1);
    expect(chunks[0].heading_context).toBe('HasContent');
  });
});

// Also verify that existing chunkText returns chunks with heading_context: null
describe('chunkText backward compatibility', () => {
  it('returns chunks with heading_context: null', () => {
    const chunks = chunkText('Some text content');

    expect(chunks.length).toBe(1);
    expect(chunks[0].heading_context).toBeNull();
  });
});
