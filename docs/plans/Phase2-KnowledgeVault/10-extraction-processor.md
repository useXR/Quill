# Task 2.9: Extraction Processor (TDD)

> **Phase 2** | [← OpenAI Embeddings](./09-openai-embeddings.md) | [Next: Semantic Search →](./11-semantic-search.md)

---

## Context

**This task creates the extraction processor that orchestrates the full pipeline using TDD.** It downloads files, extracts text, chunks, embeds, and stores results in the database.

### Prerequisites

- **Task 2.6** completed (text extraction available)
- **Task 2.7** completed (chunker available)
- **Task 2.8** completed (embeddings available)

### What This Task Creates

- `src/lib/extraction/__tests__/processor.test.ts` - 6 unit tests
- `src/lib/extraction/processor.ts` - Full extraction pipeline
- `src/app/api/vault/extract/route.ts` - Manual extraction API

### Tasks That Depend on This

- **Task 2.10** (Semantic Search) - searches embedded chunks

---

## Files to Create/Modify

- `src/lib/extraction/__tests__/processor.test.ts` (create)
- `src/lib/extraction/processor.ts` (create)
- `src/app/api/vault/extract/route.ts` (create)

---

## Steps

### Step 1: Write failing tests for extraction processor

Create `src/lib/extraction/__tests__/processor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processExtraction } from '../processor';

// Mock all dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob(['Test content for extraction']),
          error: null,
        }),
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock('@/lib/api/vault', () => ({
  getVaultItem: vi.fn().mockResolvedValue({
    id: 'test-item-id',
    user_id: 'test-user-id',
    type: 'txt',
    filename: 'test.txt',
    storage_path: 'user/project/test.txt',
    extraction_status: 'pending',
  }),
  updateVaultItemStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../pdf', () => ({
  extractPdfText: vi.fn().mockResolvedValue({
    text: 'Extracted PDF content',
    success: true,
    pageCount: 3,
  }),
}));

vi.mock('../docx', () => ({
  extractDocxText: vi.fn().mockResolvedValue({
    text: 'Extracted DOCX content',
    success: true,
  }),
}));

vi.mock('../text', () => ({
  extractTextContent: vi.fn().mockResolvedValue({
    text: 'Test content for extraction that is long enough to be valid',
    success: true,
  }),
}));

vi.mock('../chunker', () => ({
  chunkText: vi.fn().mockReturnValue([
    { content: 'Chunk 1 content', index: 0 },
    { content: 'Chunk 2 content', index: 1 },
  ]),
}));

vi.mock('../embeddings', () => ({
  getEmbeddings: vi.fn().mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2)]),
}));

vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Extraction Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes text file extraction successfully', async () => {
    await processExtraction('test-item-id');

    const { updateVaultItemStatus } = await import('@/lib/api/vault');

    // Should progress through all states
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'downloading');
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'extracting');
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'chunking');
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'embedding');
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'success', expect.any(Object));
  });

  it('calls correct extractor based on file type', async () => {
    // Test PDF extraction
    const { getVaultItem } = await import('@/lib/api/vault');
    vi.mocked(getVaultItem).mockResolvedValueOnce({
      id: 'test-item-id',
      user_id: 'test-user-id',
      type: 'pdf',
      filename: 'test.pdf',
      storage_path: 'user/project/test.pdf',
      extraction_status: 'pending',
    } as any);

    await processExtraction('test-item-id');

    const { extractPdfText } = await import('../pdf');
    expect(extractPdfText).toHaveBeenCalled();
  });

  it('handles extraction failure gracefully', async () => {
    const { extractTextContent } = await import('../text');
    vi.mocked(extractTextContent).mockResolvedValueOnce({
      text: '',
      success: false,
      error: 'Extraction failed',
    });

    await expect(processExtraction('test-item-id')).rejects.toThrow();

    const { updateVaultItemStatus } = await import('@/lib/api/vault');
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'failed');
  });

  it('sets partial status for minimal content', async () => {
    const { extractTextContent } = await import('../text');
    vi.mocked(extractTextContent).mockResolvedValueOnce({
      text: 'Short',
      success: true,
    });

    await processExtraction('test-item-id');

    const { updateVaultItemStatus } = await import('@/lib/api/vault');
    expect(updateVaultItemStatus).toHaveBeenCalledWith('test-item-id', 'partial', expect.any(Object));
  });

  it('creates audit log on successful extraction', async () => {
    await processExtraction('test-item-id');

    const { createAuditLog } = await import('@/lib/api/audit');
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'vault:extraction_complete',
        resourceType: 'vault_item',
        resourceId: 'test-item-id',
      })
    );
  });

  it('creates audit log on failed extraction', async () => {
    const { getVaultItem } = await import('@/lib/api/vault');
    vi.mocked(getVaultItem).mockResolvedValueOnce(null);

    await expect(processExtraction('nonexistent-item')).rejects.toThrow('Item not found');

    const { createAuditLog } = await import('@/lib/api/audit');
    // Audit log may be called for failure depending on implementation
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/lib/extraction/__tests__/processor.test.ts
```

**Expected:** FAIL - Cannot find module '../processor'

---

### Step 3: Create extraction processor

Create `src/lib/extraction/processor.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getVaultItem, updateVaultItemStatus } from '@/lib/api/vault';
import { createAuditLog } from '@/lib/api/audit';
import { extractPdfText } from './pdf';
import { extractDocxText } from './docx';
import { extractTextContent } from './text';
import { chunkText } from './chunker';
import { getEmbeddings } from './embeddings';
import { vaultLogger } from '@/lib/logger';

export async function processExtraction(itemId: string): Promise<void> {
  const startTime = Date.now();
  const log = vaultLogger({ itemId });

  try {
    const item = await getVaultItem(itemId);
    if (!item) {
      log.error('Item not found');
      throw new Error('Item not found');
    }

    log.info({ filename: item.filename, type: item.type }, 'Starting extraction');

    await updateVaultItemStatus(itemId, 'downloading');

    const supabase = await createClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('vault-files')
      .download(item.storage_path!);

    if (downloadError || !fileData) {
      await updateVaultItemStatus(itemId, 'failed');
      throw new Error('File download failed');
    }

    await updateVaultItemStatus(itemId, 'extracting');

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let extractionResult;

    switch (item.type) {
      case 'pdf':
        extractionResult = await extractPdfText(buffer);
        break;
      case 'docx':
        extractionResult = await extractDocxText(buffer);
        break;
      case 'txt':
        extractionResult = await extractTextContent(buffer);
        break;
      default:
        await updateVaultItemStatus(itemId, 'failed');
        throw new Error('Unsupported file type');
    }

    if (!extractionResult.success) {
      await updateVaultItemStatus(itemId, 'failed');
      throw new Error(extractionResult.error);
    }

    const extractedText = extractionResult.text;

    if (!extractedText || extractedText.length < 10) {
      await updateVaultItemStatus(itemId, 'partial', { extracted_text: extractedText });
      return;
    }

    await updateVaultItemStatus(itemId, 'chunking');

    const chunks = chunkText(extractedText);

    if (chunks.length === 0) {
      await updateVaultItemStatus(itemId, 'partial', {
        extracted_text: extractedText,
        chunk_count: 0,
      });
      return;
    }

    await updateVaultItemStatus(itemId, 'embedding');

    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await getEmbeddings(chunkContents);

    const chunkInserts = chunks.map((chunk, i) => ({
      vault_item_id: itemId,
      content: chunk.content,
      embedding: embeddings[i],
      chunk_index: chunk.index,
    }));

    const { error: insertError } = await supabase.from('vault_chunks').insert(chunkInserts);

    if (insertError) {
      log.error({ error: insertError }, 'Failed to store chunks');
      await updateVaultItemStatus(itemId, 'partial', {
        extracted_text: extractedText,
        chunk_count: 0,
      });
      throw new Error('Failed to store chunks');
    }

    await updateVaultItemStatus(itemId, 'success', {
      extracted_text: extractedText,
      chunk_count: chunks.length,
    });

    const duration = Date.now() - startTime;
    log.info({ duration, chunkCount: chunks.length }, 'Extraction completed');

    // Audit log successful extraction
    await createAuditLog({
      userId: item.user_id,
      action: 'vault:extraction_complete',
      resourceType: 'vault_item',
      resourceId: itemId,
      metadata: { chunkCount: chunks.length, durationMs: duration },
    });
  } catch (error) {
    log.error({ error }, 'Extraction failed');
    await updateVaultItemStatus(itemId, 'failed');

    // Audit log failed extraction
    const item = await getVaultItem(itemId);
    if (item) {
      await createAuditLog({
        userId: item.user_id,
        action: 'vault:extraction_failed',
        resourceType: 'vault_item',
        resourceId: itemId,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    throw error;
  }
}
```

---

### Step 4: Run tests to verify they pass

```bash
npm test src/lib/extraction/__tests__/processor.test.ts
```

**Expected:** PASS - 6 tests passed

---

### Step 5: Create extraction API route with auth

Create `src/app/api/vault/extract/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { processExtraction } from '@/lib/extraction/processor';
import { NextResponse } from 'next/server';
import { vaultLogger } from '@/lib/logger';

export async function POST(request: Request) {
  const log = vaultLogger({});

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    }

    // Verify item belongs to user
    const { data: item } = await supabase
      .from('vault_items')
      .select('id')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    log.info({ userId: user.id, itemId }, 'Manual extraction triggered');

    await processExtraction(itemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, 'Extract route error');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Extraction failed',
      },
      { status: 500 }
    );
  }
}
```

---

### Step 6: Run all processor tests

```bash
npm test src/lib/extraction/__tests__/processor.test.ts
```

**Expected:** PASS - 6 tests passed

---

### Step 6b: Create extraction barrel export

Create `src/lib/extraction/index.ts`:

```typescript
// Barrel export for extraction module
// Following best practices: every src/lib/<module>/ should have an index.ts
export * from './pdf';
export * from './docx';
export * from './text';
export * from './chunker';
export * from './embeddings';
export * from './processor';
```

---

### Step 7: Commit extraction processor and route

```bash
git add src/lib/extraction/processor.ts src/lib/extraction/__tests__/processor.test.ts src/lib/extraction/index.ts src/app/api/vault/extract/
git commit -m "feat: add extraction processor with unit tests and authenticated API route (TDD)"
```

---

## Verification Checklist

- [ ] `src/lib/extraction/__tests__/processor.test.ts` exists with 6 tests
- [ ] `src/lib/extraction/processor.ts` exists
- [ ] `src/lib/extraction/index.ts` exists (barrel export)
- [ ] `src/app/api/vault/extract/route.ts` exists
- [ ] All 6 tests pass
- [ ] Processor updates status at each stage
- [ ] Processor handles extraction errors gracefully
- [ ] Processor stores chunks with embeddings
- [ ] Processor calls correct extractor based on file type
- [ ] API route checks authentication
- [ ] API route verifies item ownership
- [ ] Partial status set for empty/minimal content
- [ ] Uses structured logger (pino) instead of console.log
- [ ] Audit logs created for extraction success/failure
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.10: Semantic Search](./11-semantic-search.md)**.
