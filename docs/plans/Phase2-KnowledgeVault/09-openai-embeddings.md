# Task 2.8: OpenAI Embeddings (TDD)

> **Phase 2** | [← Text Chunker](./08-text-chunker.md) | [Next: Extraction Processor →](./10-extraction-processor.md)

---

## Context

**This task creates the OpenAI embeddings integration with batching and rate limiting.** It handles the conversion of text chunks into vector embeddings for semantic search.

### Prerequisites

- **Task 2.0** completed (constants available)
- `OPENAI_API_KEY` in `.env.local`

### What This Task Creates

- `src/lib/extraction/__tests__/embeddings.test.ts` - 4 unit tests
- `src/lib/extraction/embeddings.ts` - OpenAI embeddings with batching

### Tasks That Depend on This

- **Task 2.9** (Extraction Processor) - uses embeddings after chunking
- **Task 2.10** (Semantic Search) - uses embeddings for query

### Parallel Tasks

This task can be done in parallel with:

- **Task 2.6** (Text Extraction)
- **Task 2.7** (Text Chunker)

---

## Files to Create/Modify

- `src/lib/extraction/__tests__/embeddings.test.ts` (create)
- `src/lib/extraction/embeddings.ts` (create)

---

## Steps

### Step 1: Install OpenAI SDK

```bash
npm install openai
```

**Expected:** Package installed

---

### Step 2: Write failing tests for embeddings

Create `src/lib/extraction/__tests__/embeddings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding, getEmbeddings } from '../embeddings';

vi.mock('openai', () => {
  const mockCreate = vi.fn().mockImplementation(async ({ input }) => {
    const inputs = Array.isArray(input) ? input : [input];
    return {
      data: inputs.map((_, i) => ({
        embedding: Array(1536)
          .fill(0)
          .map((_, j) => (i + j) * 0.001),
        index: i,
      })),
    };
  });

  return {
    default: class OpenAI {
      embeddings = { create: mockCreate };
    },
  };
});

describe('Embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmbedding', () => {
    it('returns embedding of correct dimension', async () => {
      const embedding = await getEmbedding('test text');

      expect(embedding).toHaveLength(1536);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  describe('getEmbeddings', () => {
    it('returns embeddings for multiple texts', async () => {
      const texts = ['text one', 'text two', 'text three'];
      const embeddings = await getEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((emb) => {
        expect(emb).toHaveLength(1536);
      });
    });

    it('handles empty array', async () => {
      const embeddings = await getEmbeddings([]);
      expect(embeddings).toHaveLength(0);
    });

    it('batches large requests', async () => {
      const texts = Array(150).fill('test text');
      const embeddings = await getEmbeddings(texts);

      expect(embeddings).toHaveLength(150);
    });
  });
});
```

---

### Step 3: Run tests to verify they fail

```bash
npm test src/lib/extraction/__tests__/embeddings.test.ts
```

**Expected:** FAIL - Cannot find module '../embeddings'

---

### Step 4: Implement embeddings with rate limiting

Create `src/lib/extraction/embeddings.ts`:

```typescript
import OpenAI from 'openai';
import { EMBEDDING_CONFIG } from '@/lib/vault/constants';
import { vaultLogger } from '@/lib/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple delay helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getEmbedding(text: string): Promise<number[]> {
  // Truncate if too long (rough estimate: 1 token ≈ 4 chars)
  const maxChars = EMBEDDING_CONFIG.maxTokensPerChunk * 4;
  const truncatedText = text.slice(0, maxChars);

  const response = await openai.embeddings.create({
    model: EMBEDDING_CONFIG.model,
    input: truncatedText,
  });

  return response.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const log = vaultLogger({});
  const results: number[][] = [];
  const maxChars = EMBEDDING_CONFIG.maxTokensPerChunk * 4;
  const MAX_RATE_LIMIT_RETRIES = 3;
  let rateLimitRetries = 0;

  for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = texts.slice(i, i + EMBEDDING_CONFIG.batchSize).map((t) => t.slice(0, maxChars)); // Truncate each text

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        input: batch,
      });

      // Validate response
      if (response.data.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${response.data.length}`);
      }

      // Sort by index and extract embeddings
      const batchEmbeddings = response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);

      results.push(...batchEmbeddings);
    } catch (error: any) {
      // Handle rate limiting with retry (max 3 attempts per batch)
      if (error?.status === 429) {
        rateLimitRetries++;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
          throw new Error(`Rate limit exceeded after ${MAX_RATE_LIMIT_RETRIES} retries`);
        }
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
        log.warn(
          { attempt: rateLimitRetries, maxRetries: MAX_RATE_LIMIT_RETRIES, retryAfterSec: retryAfter },
          'Rate limited, waiting to retry'
        );
        await sleep(retryAfter * 1000);
        i -= EMBEDDING_CONFIG.batchSize; // Retry this batch
        continue;
      }
      throw error;
    }
  }

  return results;
}
```

---

### Step 5: Run tests to verify they pass

```bash
npm test src/lib/extraction/__tests__/embeddings.test.ts
```

**Expected:** PASS - 4 tests passed

---

### Step 6: Commit embeddings

```bash
git add src/lib/extraction/
git commit -m "feat: add OpenAI embeddings with batching and rate limit handling (TDD)"
```

---

## Verification Checklist

- [ ] `openai` package installed
- [ ] `src/lib/extraction/__tests__/embeddings.test.ts` exists with 4 tests
- [ ] `src/lib/extraction/embeddings.ts` exists
- [ ] All tests pass
- [ ] getEmbedding returns 1536-dimension vector
- [ ] getEmbeddings handles empty array
- [ ] getEmbeddings batches large requests (100 per batch)
- [ ] Rate limiting handled with max 3 retries
- [ ] Text truncation applied to prevent token limit errors
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.9: Extraction Processor](./10-extraction-processor.md)**.
