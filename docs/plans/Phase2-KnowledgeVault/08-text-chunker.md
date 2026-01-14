# Task 2.7: Text Chunker (TDD)

> **Phase 2** | [← Text Extraction](./07-text-extraction.md) | [Next: OpenAI Embeddings →](./09-openai-embeddings.md)

---

## Context

**This task creates a text chunker that splits documents into overlapping chunks for embedding.** It uses sentence boundaries when possible and guarantees forward progress to avoid infinite loops.

### Prerequisites

- **Task 2.0** completed (constants available)

### What This Task Creates

- `src/lib/extraction/__tests__/chunker.test.ts` - 8 unit tests
- `src/lib/extraction/chunker.ts` - Text chunking with overlap

### Tasks That Depend on This

- **Task 2.9** (Extraction Processor) - uses chunker after extraction

### Parallel Tasks

This task can be done in parallel with:

- **Task 2.6** (Text Extraction)
- **Task 2.8** (OpenAI Embeddings)

---

## Files to Create/Modify

- `src/lib/extraction/__tests__/chunker.test.ts` (create)
- `src/lib/extraction/chunker.ts` (create)

---

## Steps

### Step 1: Write failing tests for chunker

Create `src/lib/extraction/__tests__/chunker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunker';

describe('Text Chunker', () => {
  it('returns single chunk for short text', () => {
    const text = 'Short text content.';
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].index).toBe(0);
  });

  it('returns empty array for empty text', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(0);
  });

  it('returns empty array for whitespace-only text', () => {
    const chunks = chunkText('   \n\t   ');
    expect(chunks).toHaveLength(0);
  });

  it('chunks text with default config', () => {
    const text = 'A'.repeat(5000);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(2000);
  });

  it('assigns sequential indices to chunks', () => {
    const text = 'A'.repeat(6000);
    const chunks = chunkText(text);

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('breaks at sentence boundaries when possible', () => {
    const text = 'First sentence. Second sentence. Third sentence. ' + 'A'.repeat(2000);
    const chunks = chunkText(text, { maxSize: 100 });

    // First chunk should end with a period (sentence boundary)
    if (chunks.length > 1) {
      expect(chunks[0].content.endsWith('.')).toBe(true);
    }
  });

  it('handles unicode correctly', () => {
    const text = '中文测试。这是第二句。' + '测'.repeat(500);
    const chunks = chunkText(text, { maxSize: 100 });

    expect(chunks.length).toBeGreaterThan(0);
    // Verify no truncated characters
    chunks.forEach((chunk) => {
      expect(chunk.content).not.toMatch(/[\uD800-\uDBFF]$/); // No orphan surrogates
    });
  });

  it('always makes forward progress', () => {
    // Edge case: text with no good break points
    const text = 'A'.repeat(5000);
    const chunks = chunkText(text, { maxSize: 100, overlap: 10 });

    // Should complete without infinite loop
    expect(chunks.length).toBeGreaterThan(0);

    // Each chunk should have content
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/lib/extraction/__tests__/chunker.test.ts
```

**Expected:** FAIL - Cannot find module '../chunker'

---

### Step 3: Implement chunker with fixed progress logic

Create `src/lib/extraction/chunker.ts`:

```typescript
import { CHUNK_CONFIG } from '@/lib/vault/constants';

export interface Chunk {
  content: string;
  index: number;
}

export interface ChunkConfig {
  maxSize?: number;
  overlap?: number;
  minSize?: number;
}

export function chunkText(text: string, config?: ChunkConfig): Chunk[] {
  const maxSize = config?.maxSize ?? CHUNK_CONFIG.maxSize;
  const overlap = config?.overlap ?? CHUNK_CONFIG.overlap;
  const minSize = config?.minSize ?? CHUNK_CONFIG.minSize;

  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.length === 0) {
    return [];
  }

  if (trimmedText.length <= maxSize) {
    if (trimmedText.length < minSize) {
      return [];
    }
    return [{ content: trimmedText, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmedText.length) {
    let end = Math.min(start + maxSize, trimmedText.length);
    let chunkEnd = end;

    // Try to break at sentence boundary if not at end
    if (end < trimmedText.length) {
      const searchStart = start + Math.floor(maxSize / 2);
      let lastBoundary = -1;

      // Look for sentence endings (. ! ?) followed by space or newline
      for (let i = end - 1; i >= searchStart; i--) {
        const char = trimmedText[i];
        const nextChar = trimmedText[i + 1];
        if (
          (char === '.' || char === '!' || char === '?') &&
          (nextChar === ' ' || nextChar === '\n' || nextChar === undefined)
        ) {
          lastBoundary = i + 1;
          break;
        }
      }

      if (lastBoundary > start) {
        chunkEnd = lastBoundary;
      } else {
        // No sentence boundary, try word boundary
        const lastSpace = trimmedText.lastIndexOf(' ', end - 1);
        if (lastSpace > searchStart) {
          chunkEnd = lastSpace + 1;
        }
      }
    }

    const chunkContent = trimmedText.slice(start, chunkEnd).trim();

    if (chunkContent.length >= minSize) {
      chunks.push({ content: chunkContent, index });
      index++;
    }

    // Calculate next start position with overlap
    const nextStart = chunkEnd - overlap;

    // CRITICAL: Always make forward progress to prevent infinite loop
    if (nextStart <= start) {
      start = chunkEnd;
    } else {
      start = nextStart;
    }
  }

  return chunks;
}

export function estimateChunkCount(textLength: number): number {
  if (textLength <= CHUNK_CONFIG.maxSize) return 1;

  const effectiveChunkSize = CHUNK_CONFIG.maxSize - CHUNK_CONFIG.overlap;
  return Math.ceil(textLength / effectiveChunkSize);
}
```

---

### Step 4: Run tests to verify they pass

```bash
npm test src/lib/extraction/__tests__/chunker.test.ts
```

**Expected:** PASS - 8 tests passed

---

### Step 5: Commit chunker

```bash
git add src/lib/extraction/
git commit -m "feat: add text chunker with sentence boundaries and progress safety (TDD)"
```

---

## Verification Checklist

- [ ] `src/lib/extraction/__tests__/chunker.test.ts` exists with 8 tests
- [ ] `src/lib/extraction/chunker.ts` exists
- [ ] All tests pass
- [ ] Chunker returns empty array for empty/whitespace text
- [ ] Chunker returns single chunk for short text
- [ ] Chunker breaks at sentence boundaries when possible
- [ ] Chunker handles unicode correctly
- [ ] Chunker always makes forward progress (no infinite loops)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.8: OpenAI Embeddings](./09-openai-embeddings.md)**.
