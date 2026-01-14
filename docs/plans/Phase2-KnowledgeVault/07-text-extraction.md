# Task 2.6: Text Extraction (TDD)

> **Phase 2** | [← Upload API Route](./06-upload-api-route.md) | [Next: Text Chunker →](./08-text-chunker.md)

---

## Context

**This task creates extractors for PDF, DOCX, and TXT files using Test-Driven Development.** Each extractor handles errors gracefully and returns a consistent result type.

### Prerequisites

- **Task 2.0** completed (infrastructure available)

### What This Task Creates

- `src/lib/extraction/__tests__/pdf.test.ts` - 3 unit tests
- `src/lib/extraction/pdf.ts` - PDF text extraction
- `src/lib/extraction/__tests__/docx.test.ts` - 3 unit tests
- `src/lib/extraction/docx.ts` - DOCX text extraction
- `src/lib/extraction/text.ts` - Plain text extraction

### Tasks That Depend on This

- **Task 2.9** (Extraction Processor) - orchestrates these extractors

### Parallel Tasks

This task can be done in parallel with:

- **Task 2.7** (Text Chunker)
- **Task 2.8** (OpenAI Embeddings)

---

## Files to Create/Modify

- `src/lib/extraction/__tests__/pdf.test.ts` (create)
- `src/lib/extraction/pdf.ts` (create)
- `src/lib/extraction/__tests__/docx.test.ts` (create)
- `src/lib/extraction/docx.ts` (create)
- `src/lib/extraction/text.ts` (create)

---

## Steps

### Step 1: Install extraction libraries

```bash
npm install pdf-parse mammoth
```

**Expected:** Packages installed

---

### Step 2: Install type definitions

```bash
npm install -D @types/pdf-parse
```

**Expected:** Types installed

---

### Step 3: Write failing test for PDF extraction

Create `src/lib/extraction/__tests__/pdf.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractPdfText } from '../pdf';

vi.mock('pdf-parse', () => ({
  default: vi.fn().mockImplementation(async (buffer) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    if (buffer.toString().includes('corrupted')) {
      throw new Error('Invalid PDF structure');
    }
    return { text: 'Extracted PDF text content', numpages: 3 };
  }),
}));

describe('PDF extraction', () => {
  it('extracts text from valid PDF buffer', async () => {
    const buffer = Buffer.from('valid pdf content');
    const result = await extractPdfText(buffer);

    expect(result.text).toBe('Extracted PDF text content');
    expect(result.success).toBe(true);
    expect(result.pageCount).toBe(3);
  });

  it('handles corrupted PDF gracefully', async () => {
    const buffer = Buffer.from('corrupted pdf');
    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid PDF');
  });

  it('handles empty buffer', async () => {
    const buffer = Buffer.alloc(0);
    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

### Step 4: Run test to verify it fails

```bash
npm test src/lib/extraction/__tests__/pdf.test.ts
```

**Expected:** FAIL - Cannot find module '../pdf'

---

### Step 5: Implement PDF extractor

Create `src/lib/extraction/pdf.ts`:

```typescript
import pdf from 'pdf-parse';
import { vaultLogger } from '@/lib/logger';

export interface ExtractionResult {
  text: string;
  success: boolean;
  error?: string;
  pageCount?: number;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  const log = vaultLogger({});

  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const data = await pdf(buffer);

    return {
      text: data.text.trim(),
      success: true,
      pageCount: data.numpages,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF extraction failed';
    log.error({ error: message }, 'PDF extraction error');

    return {
      text: '',
      success: false,
      error: message,
    };
  }
}
```

---

### Step 6: Run test to verify it passes

```bash
npm test src/lib/extraction/__tests__/pdf.test.ts
```

**Expected:** PASS - 3 tests passed

---

### Step 7: Write failing test for DOCX extraction

Create `src/lib/extraction/__tests__/docx.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractDocxText } from '../docx';

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockImplementation(async ({ buffer }) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    if (buffer.toString().includes('corrupted')) {
      throw new Error('Could not read DOCX file');
    }
    return { value: 'Extracted DOCX text content' };
  }),
}));

describe('DOCX extraction', () => {
  it('extracts text from valid DOCX buffer', async () => {
    const buffer = Buffer.from('valid docx content');
    const result = await extractDocxText(buffer);

    expect(result.text).toBe('Extracted DOCX text content');
    expect(result.success).toBe(true);
  });

  it('handles corrupted DOCX gracefully', async () => {
    const buffer = Buffer.from('corrupted docx');
    const result = await extractDocxText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not read');
  });

  it('handles empty buffer', async () => {
    const buffer = Buffer.alloc(0);
    const result = await extractDocxText(buffer);

    expect(result.success).toBe(false);
  });
});
```

---

### Step 8: Run test to verify it fails

```bash
npm test src/lib/extraction/__tests__/docx.test.ts
```

**Expected:** FAIL - Cannot find module '../docx'

---

### Step 9: Implement DOCX extractor

Create `src/lib/extraction/docx.ts`:

```typescript
import mammoth from 'mammoth';
import type { ExtractionResult } from './pdf';
import { vaultLogger } from '@/lib/logger';

export async function extractDocxText(buffer: Buffer): Promise<ExtractionResult> {
  const log = vaultLogger({});

  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value.trim(),
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DOCX extraction failed';
    log.error({ error: message }, 'DOCX extraction error');

    return {
      text: '',
      success: false,
      error: message,
    };
  }
}
```

---

### Step 10: Run test to verify it passes

```bash
npm test src/lib/extraction/__tests__/docx.test.ts
```

**Expected:** PASS - 3 tests passed

---

### Step 11: Implement text extractor

Create `src/lib/extraction/text.ts`:

```typescript
import type { ExtractionResult } from './pdf';

export async function extractTextContent(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const text = buffer.toString('utf-8').trim();

    return {
      text,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Text extraction failed';

    return {
      text: '',
      success: false,
      error: message,
    };
  }
}
```

---

### Step 12: Commit extraction modules

```bash
git add src/lib/extraction/
git commit -m "feat: add text extraction for PDF, DOCX, and TXT files (TDD)"
```

---

## Verification Checklist

- [ ] `pdf-parse` and `mammoth` packages installed
- [ ] `@types/pdf-parse` installed
- [ ] `src/lib/extraction/__tests__/pdf.test.ts` exists with 3 tests
- [ ] `src/lib/extraction/pdf.ts` exists
- [ ] `src/lib/extraction/__tests__/docx.test.ts` exists with 3 tests
- [ ] `src/lib/extraction/docx.ts` exists
- [ ] `src/lib/extraction/text.ts` exists
- [ ] All tests pass
- [ ] All extractors handle errors gracefully
- [ ] All extractors return consistent ExtractionResult type
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.7: Text Chunker](./08-text-chunker.md)**.
