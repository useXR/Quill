# Task 6.1: DOCX Export

> **Phase 6** | [← Overview](./00-overview.md) | [Next: PDF Export →](./02-pdf-export.md)

---

## Context

**This task implements server-side DOCX document export with HTML-to-DOCX conversion.** Users can export their documents as Word files with formatting preserved.

### Prerequisites

- Pre-flight checklist completed (Node.js 20+, existing project structure)

### What This Task Creates

- `src/lib/export/html-to-docx.ts` - HTML parsing and conversion
- `src/lib/export/docx-styles.ts` - Document styles configuration
- `src/lib/export/docx.ts` - Main export function
- `src/lib/export/types.ts` - Shared types
- `src/lib/export/index.ts` - Barrel export
- `src/lib/export/__tests__/html-to-docx.test.ts` - Unit tests
- `src/app/api/export/docx/route.ts` - API endpoint

### Tasks That Depend on This

- **Task 6.3** (App Shell) - Export UI integration
- **Task 6.7** (E2E Tests) - Export flow testing

### Parallel Tasks

This task can be done in parallel with:

- **Task 6.2** (PDF Export)

---

## Files to Create/Modify

- `src/lib/export/types.ts` (create)
- `src/lib/export/html-to-docx.ts` (create)
- `src/lib/export/docx-styles.ts` (create)
- `src/lib/export/docx.ts` (create)
- `src/lib/export/index.ts` (create)
- `src/lib/export/__tests__/html-to-docx.test.ts` (create)
- `src/app/api/export/docx/route.ts` (create)

---

## Steps

### Step 1: Install dependencies

```bash
npm install docx node-html-parser
```

**Expected:** Package added to package.json

### Step 2: Create shared types

Create `src/lib/export/types.ts`:

```typescript
import { Database } from '@/types/supabase';

// Database types
export type Document = Database['public']['Tables']['documents']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];

// Document with project relationship for authorization checks
export interface DocumentWithProject extends Document {
  projects: Pick<Project, 'user_id'>;
}

// DOCX export options
export interface DocxExportOptions {
  title: string;
  author?: string;
  includeTitle?: boolean;
  pageSize?: 'letter' | 'a4';
}

// PDF export options (shared for consistency)
export interface PdfExportOptions {
  title: string;
  format?: 'letter' | 'a4';
  includePageNumbers?: boolean;
}
```

### Step 3: Write failing test for paragraph conversion

Create `src/lib/export/__tests__/html-to-docx.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { htmlToDocxElements } from '../html-to-docx';

describe('htmlToDocxElements', () => {
  describe('paragraphs', () => {
    it('converts simple paragraph to docx element', () => {
      const result = htmlToDocxElements('<p>Hello world</p>');
      expect(result).toHaveLength(1);
    });

    it('returns empty array for empty paragraph', () => {
      const result = htmlToDocxElements('<p></p>');
      expect(result).toHaveLength(0);
    });
  });
});
```

### Step 4: Run test to verify it fails

```bash
npm test -- src/lib/export/__tests__/html-to-docx.test.ts
```

**Expected:** FAIL with "Cannot find module '../html-to-docx'"

### Step 5: Write minimal html-to-docx implementation

Create `src/lib/export/html-to-docx.ts`:

```typescript
import { parse, HTMLElement, TextNode } from 'node-html-parser';
import { Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell } from 'docx';

interface TextRunFormatting {
  bold?: boolean;
  italics?: boolean;
  underline?: object;
  font?: string;
}

export function htmlToDocxElements(html: string): (Paragraph | Table)[] {
  const root = parse(html, {
    blockTextElements: { script: false, style: false },
  });
  const elements: (Paragraph | Table)[] = [];

  for (const node of root.childNodes) {
    const converted = processNode(node);
    if (converted) elements.push(...converted);
  }

  return elements;
}

function processNode(node: unknown): (Paragraph | Table)[] | null {
  if (node instanceof TextNode) {
    const text = node.text.trim();
    if (!text) return null;
    return [new Paragraph({ children: [new TextRun(text)] })];
  }

  if (!(node instanceof HTMLElement)) return null;

  const tag = node.tagName?.toLowerCase();

  switch (tag) {
    case 'p':
      return [createParagraph(node)];
    case 'h1':
      return [createHeading(node, HeadingLevel.HEADING_1)];
    case 'h2':
      return [createHeading(node, HeadingLevel.HEADING_2)];
    case 'h3':
      return [createHeading(node, HeadingLevel.HEADING_3)];
    case 'ul':
    case 'ol':
      return createList(node, tag === 'ol');
    case 'blockquote':
      return [createBlockquote(node)];
    case 'table':
      return [createTable(node)];
    case 'br':
      return [new Paragraph({})];
    default:
      const children: (Paragraph | Table)[] = [];
      for (const child of node.childNodes) {
        const result = processNode(child);
        if (result) children.push(...result);
      }
      return children.length > 0 ? children : null;
  }
}

function createParagraph(node: HTMLElement): Paragraph {
  const runs = extractTextRuns(node);
  if (runs.length === 0) {
    return new Paragraph({ children: [] });
  }
  return new Paragraph({ children: runs });
}

function createHeading(node: HTMLElement, level: HeadingLevel): Paragraph {
  return new Paragraph({
    heading: level,
    children: extractTextRuns(node),
  });
}

function extractTextRuns(node: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];

  function traverse(el: unknown, formatting: TextRunFormatting = {}) {
    if (el instanceof TextNode) {
      const text = el.text;
      if (text) {
        runs.push(new TextRun({ text, ...formatting }));
      }
      return;
    }

    if (!(el instanceof HTMLElement)) return;

    const tag = el.tagName?.toLowerCase();
    const newFormatting = { ...formatting };

    switch (tag) {
      case 'strong':
      case 'b':
        newFormatting.bold = true;
        break;
      case 'em':
      case 'i':
        newFormatting.italics = true;
        break;
      case 'u':
        newFormatting.underline = {};
        break;
      case 'code':
        newFormatting.font = 'Courier New';
        break;
      case 'a':
        const href = el.getAttribute('href');
        if (href) {
          runs.push(
            new ExternalHyperlink({
              children: [new TextRun({ text: el.text, style: 'Hyperlink' })],
              link: href,
            }) as unknown as TextRun
          );
          return;
        }
        break;
    }

    for (const child of el.childNodes) {
      traverse(child, newFormatting);
    }
  }

  traverse(node);
  return runs;
}

function createList(node: HTMLElement, ordered: boolean): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const items = node.querySelectorAll('li');

  items.forEach((item) => {
    paragraphs.push(
      new Paragraph({
        children: extractTextRuns(item),
        bullet: ordered ? undefined : { level: 0 },
        numbering: ordered ? { reference: 'default-numbering', level: 0 } : undefined,
      })
    );
  });

  return paragraphs;
}

function createBlockquote(node: HTMLElement): Paragraph {
  return new Paragraph({
    children: extractTextRuns(node),
    indent: { left: 720 },
    style: 'Quote',
  });
}

function createTable(node: HTMLElement): Table {
  const rows = node.querySelectorAll('tr');

  return new Table({
    rows: rows.map((row) => {
      const cells = row.querySelectorAll('td, th');
      return new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: extractTextRuns(cell) })],
            })
        ),
      });
    }),
  });
}
```

### Step 6: Run test to verify it passes

```bash
npm test -- src/lib/export/__tests__/html-to-docx.test.ts
```

**Expected:** PASS

### Step 7: Add tests for text formatting

Add to `src/lib/export/__tests__/html-to-docx.test.ts`:

```typescript
describe('text formatting', () => {
  it('converts bold text', () => {
    const result = htmlToDocxElements('<p><strong>bold</strong></p>');
    expect(result).toHaveLength(1);
  });

  it('converts italic text', () => {
    const result = htmlToDocxElements('<p><em>italic</em></p>');
    expect(result).toHaveLength(1);
  });

  it('handles nested formatting', () => {
    const result = htmlToDocxElements('<p><strong><em>bold italic</em></strong></p>');
    expect(result).toHaveLength(1);
  });
});

describe('headings', () => {
  it('converts h1', () => {
    const result = htmlToDocxElements('<h1>Title</h1>');
    expect(result).toHaveLength(1);
  });

  it('converts h2', () => {
    const result = htmlToDocxElements('<h2>Subtitle</h2>');
    expect(result).toHaveLength(1);
  });
});

describe('lists', () => {
  it('converts unordered list', () => {
    const result = htmlToDocxElements('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(result).toHaveLength(2);
  });

  it('converts ordered list', () => {
    const result = htmlToDocxElements('<ol><li>First</li><li>Second</li></ol>');
    expect(result).toHaveLength(2);
  });
});
```

### Step 8: Run tests to verify they pass

```bash
npm test -- src/lib/export/__tests__/html-to-docx.test.ts
```

**Expected:** All tests PASS

### Step 9: Create docx-styles module

Create `src/lib/export/docx-styles.ts`:

```typescript
import { IStylesOptions } from 'docx';

export const defaultStyles: IStylesOptions = {
  paragraphStyles: [
    {
      id: 'Normal',
      name: 'Normal',
      run: {
        font: 'Times New Roman',
        size: 24,
      },
      paragraph: {
        spacing: { after: 200, line: 276 },
      },
    },
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        font: 'Arial',
        size: 32,
        bold: true,
      },
      paragraph: {
        spacing: { before: 400, after: 200 },
      },
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        font: 'Arial',
        size: 28,
        bold: true,
      },
      paragraph: {
        spacing: { before: 300, after: 150 },
      },
    },
  ],
};

export const defaultNumbering = {
  config: [
    {
      reference: 'default-numbering',
      levels: [
        {
          level: 0,
          format: 'decimal' as const,
          text: '%1.',
          alignment: 'start' as const,
        },
      ],
    },
  ],
};
```

### Step 10: Create main docx export function

Create `src/lib/export/docx.ts`:

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { htmlToDocxElements } from './html-to-docx';
import { defaultStyles, defaultNumbering } from './docx-styles';
import type { DocxExportOptions } from './types';

export async function exportToDocx(htmlContent: string, options: DocxExportOptions): Promise<Buffer> {
  const { title, author, includeTitle = true, pageSize = 'letter' } = options;

  const contentElements = htmlToDocxElements(htmlContent);

  const titleElements: Paragraph[] = includeTitle
    ? [
        new Paragraph({
          children: [new TextRun({ text: title, bold: true })],
          heading: HeadingLevel.TITLE,
          spacing: { after: 400 },
        }),
      ]
    : [];

  const doc = new Document({
    creator: author || 'Quill',
    title,
    styles: defaultStyles,
    numbering: defaultNumbering,
    sections: [
      {
        properties: {
          page: {
            size: pageSize === 'letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [...titleElements, ...contentElements],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
```

### Step 11: Create barrel export

Create `src/lib/export/index.ts`:

```typescript
// Main export functions
export { exportToDocx } from './docx';
export { htmlToDocxElements } from './html-to-docx';

// Styles (for customization)
export { defaultStyles, defaultNumbering } from './docx-styles';

// Types
export type { DocxExportOptions, PdfExportOptions, DocumentWithProject } from './types';
```

### Step 12: Run tests to verify nothing broke

```bash
npm test -- src/lib/export/
```

**Expected:** All tests PASS

### Step 12.5: Add export domain logger to src/lib/logger.ts

Following Phase 2/3/4/5 pattern of domain-specific child loggers, add to `src/lib/logger.ts`:

```typescript
/**
 * Export-specific logger for document export operations.
 * Following pattern from vaultLogger, aiLogger, chatLogger, citationLogger.
 */
export function exportLogger(context: { userId?: string; documentId?: string; format?: string }) {
  return logger.child({ module: 'export', ...context });
}
```

### Step 13: Create API route with proper validation, logging, and error helpers

Create `src/app/api/export/docx/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exportToDocx } from '@/lib/export';
import { exportLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { unauthorizedError, validationError, notFoundError, forbiddenError } from '@/lib/api/error-response';
import { createAuditLog } from '@/lib/api/audit';
import type { DocumentWithProject } from '@/lib/export';

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
  const log = exportLogger({ userId: user.id, documentId: validDocumentId, format: 'docx' });

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
    log.warn({ ownerId: doc.projects.user_id }, 'Unauthorized document export attempt');
    return forbiddenError();
  }

  try {
    const buffer = await exportToDocx(doc.content_text || '', {
      title: doc.title,
    });

    // Sanitize filename - remove special characters (XSS prevention)
    // Note: The docx library handles content sanitization internally
    const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.docx`;

    // Audit log the export for compliance tracking
    await createAuditLog('export:docx', {
      userId: user.id,
      documentId: validDocumentId,
      documentTitle: doc.title,
    });

    log.info({ documentTitle: doc.title }, 'Document exported successfully');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err, log, 'DOCX export failed');
  }
}
```

### Step 14: Commit

```bash
git add src/lib/export/ src/app/api/export/docx/
git commit -m "feat: add DOCX export with HTML parsing

- Add HTML-to-DOCX conversion with formatting support
- Add Zod validation for API parameters
- Add structured logging with pino
- Add typed database queries
- Add barrel exports for clean imports"
```

**Expected:** Commit created successfully

---

## Verification Checklist

- [ ] `docx` and `node-html-parser` packages installed
- [ ] Unit tests pass for HTML-to-DOCX conversion
- [ ] Paragraphs, headings, lists, blockquotes convert correctly
- [ ] Text formatting (bold, italic, underline) preserved
- [ ] Barrel export (`index.ts`) created with clean public API
- [ ] `exportLogger` added to `src/lib/logger.ts` (following domain logger pattern)
- [ ] API route validates documentId with Zod schema
- [ ] API route uses typed Supabase queries (`DocumentWithProject`)
- [ ] API route uses `exportLogger` domain logger (not generic `logger`)
- [ ] API route uses error response helpers (`unauthorizedError`, `validationError`, etc.)
- [ ] API route uses `handleApiError` in catch block
- [ ] Audit logging records export operations (`createAuditLog`)
- [ ] Filename sanitization documented (XSS prevention)
- [ ] Authorization checks prevent unauthorized access
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 6.2: PDF Export](./02-pdf-export.md)**.
