# Task 6.2: PDF Export

> **Phase 6** | [← DOCX Export](./01-docx-export.md) | [Next: App Shell & Navigation →](./03-app-shell-navigation.md)

---

## Design System Context

PDF exports should reflect the **Scholarly Craft** aesthetic with professional academic styling:

### PDF Typography (in `pdf-styles.ts`)

- **Body Font:** `'Times New Roman', serif` - Academic standard, closest to Libre Baskerville
- **Font Size:** 12pt body text, 18pt/14pt/12pt heading hierarchy
- **Line Height:** 1.6 (generous spacing per design system's `--leading-relaxed`)
- **Color:** `#000` for maximum print contrast (not `--color-ink-primary` which is warm-tinted)

### PDF Layout

- **Max Width:** 6.5in content area (optimal reading width like `--max-w-prose`)
- **Margins:** 1 inch (standard academic formatting)
- **Blockquote:** Left border accent (mirrors the design system's accent card pattern)

### CSS Variables Reference

While PDFs use inline styles (not Tailwind), the values align with design system tokens:

- Body line-height 1.6 = `--leading-relaxed`
- Heading spacing = multiples of `--space-4` (12pt, 18pt, 24pt)
- Blockquote border = 3pt solid `#ccc` (similar to `--color-ink-faint`)

---

## Context

**This task implements server-side PDF document export using Puppeteer.** Users can export their documents as professionally-styled PDF files.

### Prerequisites

- Pre-flight checklist completed (Node.js 24+, existing project structure)
- **Task 6.1** should be completed first (creates shared types and barrel export)

### What This Task Creates

- `src/lib/export/pdf-styles.ts` - PDF CSS styles
- `src/lib/export/pdf.ts` - Main PDF export function
- `src/lib/export/__tests__/pdf.test.ts` - Unit tests
- `src/app/api/export/pdf/route.ts` - API endpoint
- Updates `src/lib/export/index.ts` - Add PDF exports to barrel

### Tasks That Depend on This

- **Task 6.3** (App Shell) - Export UI integration
- **Task 6.7** (E2E Tests) - Export flow testing

### Parallel Tasks

This task can be done in parallel with:

- **Task 6.1** (DOCX Export) - if types.ts is created first

---

## Files to Create/Modify

- `src/lib/export/pdf-styles.ts` (create)
- `src/lib/export/pdf.ts` (create)
- `src/lib/export/__tests__/pdf.test.ts` (create)
- `src/lib/export/index.ts` (modify - add PDF exports)
- `src/app/api/export/pdf/route.ts` (create)

---

## Steps

### Step 1: Install dependencies

```bash
npm install puppeteer @sparticuz/chromium puppeteer-core
npm install -D @types/puppeteer
```

**Expected:** Packages added to package.json

### Step 2: Create PDF styles

Create `src/lib/export/pdf-styles.ts`:

```typescript
export const pdfStyles = `
  body {
    font-family: 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    max-width: 6.5in;
    margin: 0 auto;
    padding: 1in;
  }

  h1 { font-size: 18pt; font-weight: bold; margin: 24pt 0 12pt; }
  h2 { font-size: 14pt; font-weight: bold; margin: 18pt 0 10pt; }
  h3 { font-size: 12pt; font-weight: bold; margin: 14pt 0 8pt; }

  p { margin: 0 0 12pt; text-align: justify; }

  ul, ol { margin: 0 0 12pt; padding-left: 24pt; }
  li { margin: 4pt 0; }

  blockquote {
    margin: 12pt 24pt;
    padding-left: 12pt;
    border-left: 3pt solid #ccc;
    font-style: italic;
  }

  code {
    font-family: 'Courier New', monospace;
    background: #f4f4f4;
    padding: 2pt 4pt;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
  }

  th, td {
    border: 1pt solid #000;
    padding: 6pt;
    text-align: left;
  }

  @media print {
    body { margin: 0; padding: 0; }
  }

  @page {
    size: letter;
    margin: 1in;
  }
`;

export const footerTemplate = `
  <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
    <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>
`;
```

### Step 3: Create PDF export function

Create `src/lib/export/pdf.ts`:

```typescript
import puppeteer, { Browser } from 'puppeteer';
import { pdfStyles, footerTemplate } from './pdf-styles';
import type { PdfExportOptions } from './types';

/**
 * HTML escape utility to prevent XSS in PDF generation.
 * Used for user-provided content that will be rendered in the PDF.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  // Prevent race condition with concurrent requests
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  if (!browserInstance) {
    browserLaunchPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browserInstance = await browserLaunchPromise;
    browserLaunchPromise = null;
  }
  return browserInstance;
}

/**
 * Exports HTML content to a PDF buffer.
 *
 * IMPORTANT: The htmlContent parameter should already be sanitized by the editor.
 * This function escapes the title but trusts htmlContent as it comes from our
 * own TipTap editor output. If accepting HTML from external sources, sanitize
 * it with DOMPurify before passing to this function.
 *
 * @param htmlContent - Pre-sanitized HTML content from the editor
 * @param options - PDF generation options
 * @returns Buffer containing the PDF data
 */
export async function exportToPdf(htmlContent: string, options: PdfExportOptions): Promise<Buffer> {
  const { title, format = 'letter', includePageNumbers = true } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();

  // Escape title to prevent XSS - title is user-provided text
  const safeTitle = escapeHtml(title);

  try {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${safeTitle}</title>
        <style>${pdfStyles}</style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        ${htmlContent}
      </body>
      </html>
    `;

    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });

    const pdf = await page.pdf({
      format: format === 'letter' ? 'Letter' : 'A4',
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
      printBackground: true,
      displayHeaderFooter: includePageNumbers,
      headerTemplate: '<div></div>',
      footerTemplate: includePageNumbers ? footerTemplate : '<div></div>',
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
```

### Step 4: Write unit tests for escapeHtml and PDF export

Create `src/lib/export/__tests__/pdf.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the escapeHtml utility
describe('escapeHtml', () => {
  const { escapeHtml } = await import('../pdf');

  it('escapes ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes less than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('escapes multiple characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

// Mock Puppeteer for PDF generation tests
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setContent: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('exportToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Buffer', async () => {
    const { exportToPdf } = await import('../pdf');
    const result = await exportToPdf('<p>Test</p>', { title: 'Test Doc' });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('accepts format option', async () => {
    const { exportToPdf } = await import('../pdf');
    const result = await exportToPdf('<p>Test</p>', {
      title: 'Test',
      format: 'a4',
    });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('accepts includePageNumbers option', async () => {
    const { exportToPdf } = await import('../pdf');
    const result = await exportToPdf('<p>Test</p>', {
      title: 'Test',
      includePageNumbers: false,
    });
    expect(result).toBeInstanceOf(Buffer);
  });
});
```

### Step 5: Run tests to verify they pass

```bash
npm test -- src/lib/export/__tests__/pdf.test.ts
```

**Expected:** All tests PASS

### Step 6: Update barrel export

Update `src/lib/export/index.ts` to include PDF exports:

```typescript
// Main export functions
export { exportToDocx } from './docx';
export { exportToPdf, escapeHtml, closeBrowser } from './pdf';
export { htmlToDocxElements } from './html-to-docx';

// Styles (for customization)
export { defaultStyles, defaultNumbering } from './docx-styles';
export { pdfStyles, footerTemplate } from './pdf-styles';

// Types
export type { DocxExportOptions, PdfExportOptions, DocumentWithProject } from './types';
```

### Step 7: Create API route with proper validation, logging, and error helpers

**Note:** This route uses `exportLogger` created in Task 6.1 (DOCX Export).

Create `src/app/api/export/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exportToPdf } from '@/lib/export';
import { exportLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { unauthorizedError, validationError, notFoundError, forbiddenError } from '@/lib/api/error-response';
import { createAuditLog } from '@/lib/api/audit';
import type { DocumentWithProject } from '@/lib/export';

// Extend default timeout for PDF generation (Puppeteer can be slow)
export const maxDuration = 60;

// Validation schema for request parameters
const exportParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('documentId');

  // Validate request parameters with Zod
  const parseResult = exportParamsSchema.safeParse({ documentId });
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const { documentId: validDocumentId } = parseResult.data;

  const supabase = await createClient();

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return unauthorizedError();
  }

  // Create domain-specific logger with context
  const log = exportLogger({ userId: user.id, documentId: validDocumentId, format: 'pdf' });

  // Fetch document with type parameter
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, projects!inner(user_id)')
    .eq('id', validDocumentId)
    .single<DocumentWithProject>();

  if (error || !doc) {
    log.warn('Document not found for export');
    return notFoundError('Document');
  }

  // Authorization check - verify ownership
  if (doc.projects.user_id !== user.id) {
    log.warn({ ownerId: doc.projects.user_id }, 'Unauthorized PDF export attempt');
    return forbiddenError();
  }

  try {
    const buffer = await exportToPdf(doc.content_text || '', {
      title: doc.title,
    });

    // Sanitize filename - remove special characters
    const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

    // Audit log the export for compliance tracking
    await createAuditLog('export:pdf', {
      userId: user.id,
      documentId: validDocumentId,
      documentTitle: doc.title,
    });

    log.info({ documentTitle: doc.title }, 'Document exported successfully');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err, log, 'PDF export failed');
  }
}
```

### Step 8: Commit

```bash
git add src/lib/export/pdf-styles.ts src/lib/export/pdf.ts src/lib/export/__tests__/pdf.test.ts src/lib/export/index.ts src/app/api/export/pdf/
git commit -m "feat: add PDF export with Puppeteer

- Add PDF generation with professional styling
- Add XSS prevention via escapeHtml for title injection
- Add Zod validation for API parameters
- Add structured logging with pino
- Add typed database queries
- Update barrel exports"
```

**Expected:** Commit created successfully

---

## Timeout Constants

**IMPORTANT:** Add export-specific timeout constants to the centralized timeouts file.

### Add to `e2e/config/timeouts.ts`

```typescript
// Add to existing TIMEOUTS object
export const TIMEOUTS = {
  // ... existing timeouts ...

  /** Timeout for export file download - PDF generation can be slow with Puppeteer */
  EXPORT_DOWNLOAD: 30000,
} as const;

// Add pre-built wait options
export const EXPORT_WAIT = { timeout: TIMEOUTS.EXPORT_DOWNLOAD };
```

This timeout is used in both DOCX and PDF export tests. PDF exports may take longer due to Puppeteer rendering.

---

## E2E Tests

**IMPORTANT:** E2E tests must be created as part of this task, not deferred to Task 6.7. This follows the incremental testing pattern established in earlier phases.

### Create `e2e/export/pdf-export.spec.ts`

Create E2E tests covering PDF export functionality. **Note:** This task uses the `ExportPage` page object created in Task 6.1.

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { EditorPage } from '../pages/EditorPage';
import { ExportPage } from '../pages/ExportPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('PDF Export', () => {
  let editorPage: EditorPage;
  let exportPage: ExportPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    editorPage = new EditorPage(page);
    exportPage = new ExportPage(page);
    await editorPage.goto(workerCtx.projectId, workerCtx.documentId);
    await editorPage.waitForEditorReady();
  });

  test('PDF export option is visible in menu', async () => {
    await exportPage.openExportMenu();
    await expect(exportPage.pdfOption).toBeVisible();
  });

  test('PDF download initiates correctly', async () => {
    const download = await exportPage.exportToPdf();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('loading state displays during PDF generation', async ({ page }) => {
    // Slow down the export API to observe loading state
    await page.route('**/api/export/pdf*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await exportPage.openExportMenu();

    // Start export without awaiting completion
    const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUTS.EXPORT_DOWNLOAD });
    await exportPage.pdfOption.click();

    // Loading state should appear (spinner or disabled button)
    await exportPage.expectLoadingState();

    // Wait for download to complete
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // Button should be enabled again after export
    await exportPage.expectExportButtonEnabled();
  });

  test('PDF file downloads with correct name and extension', async () => {
    // Type a document title
    await editorPage.setTitle('Test PDF Document');
    await editorPage.waitForSave();

    const download = await exportPage.exportToPdf();

    // Verify filename matches document title (sanitized)
    expect(download.suggestedFilename()).toBe('Test_PDF_Document.pdf');
  });
});
```

### Run E2E Tests

```bash
npm run test:e2e -- --grep "PDF Export"
```

**Expected:** All PDF export E2E tests pass

---

## E2E Verification

Before proceeding to the next task, verify:

- [ ] All unit tests pass (`npm test -- src/lib/export/`)
- [ ] E2E tests pass (`npm run test:e2e -- --grep "PDF Export"`)
- [ ] PDF option appears in export menu
- [ ] PDF file downloads with correct extension
- [ ] Loading state displays during generation
- [ ] `TIMEOUTS.EXPORT_DOWNLOAD` added to `e2e/config/timeouts.ts`

**Do not proceed to Task 6.3 until all E2E tests pass.**

---

## Verification Checklist

- [ ] `puppeteer` and related packages installed
- [ ] Unit tests pass for escapeHtml utility
- [ ] Mocked Puppeteer tests pass
- [ ] PDF styles include proper typography and layout
- [ ] Barrel export updated with PDF functions
- [ ] API route validates documentId with Zod schema
- [ ] API route uses typed Supabase queries (`DocumentWithProject`)
- [ ] API route uses `exportLogger` domain logger (created in Task 6.1)
- [ ] API route uses error response helpers (`unauthorizedError`, `validationError`, etc.)
- [ ] API route uses `handleApiError` in catch block
- [ ] Audit logging records export operations (`createAuditLog`)
- [ ] XSS prevention via escapeHtml for title injection
- [ ] htmlContent sanitization documented (relies on editor output)
- [ ] Authorization checks prevent unauthorized access
- [ ] Changes committed

---

## Additional E2E Tests

Add to `e2e/export/pdf-export.spec.ts`:

```typescript
test('PDF generation timeout shows appropriate message', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();
  // Mock slow API response (> 60s)
  await page.route('**/api/export/pdf', async (route) => {
    await new Promise((r) => setTimeout(r, 65000));
    route.fulfill({ status: 504 });
  });
  // Attempt export
  // Verify timeout message appears
});

test('can export same document to both DOCX and PDF', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();
  // Export to DOCX
  // Verify download
  // Export same doc to PDF
  // Verify second download
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/export/pdf-export.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 6.3.

---

## Next Steps

After this task, proceed to **[Task 6.3: App Shell & Navigation](./03-app-shell-navigation.md)**.
