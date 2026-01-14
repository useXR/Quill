# Phase 6: Export & Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the MVP with document export (DOCX/PDF), responsive app shell, error handling, toast notifications, command palette, and comprehensive E2E testing.

**Architecture:** Server-side export using `docx` library for Word documents and Puppeteer for PDF generation. Client-side app shell with responsive sidebar, skip links for accessibility, and Zustand-powered toast notifications. Command palette via `cmdk` library. E2E tests with Playwright and axe-core for accessibility.

**Tech Stack:** Next.js 14, TypeScript, docx, puppeteer, cmdk, Zustand, Playwright, @axe-core/playwright, Tailwind CSS

---

## Task 6.1: DOCX Export

**Files:**

- Create: `src/lib/export/html-to-docx.ts`
- Create: `src/lib/export/docx-styles.ts`
- Create: `src/lib/export/docx.ts`
- Create: `src/lib/export/__tests__/html-to-docx.test.ts`
- Create: `src/app/api/export/docx/route.ts`

### Step 1: Install dependencies

Run:

```bash
npm install docx node-html-parser
```

Expected: Package added to package.json

### Step 2: Write failing test for paragraph conversion

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

### Step 3: Run test to verify it fails

Run: `npm test -- src/lib/export/__tests__/html-to-docx.test.ts`

Expected: FAIL with "Cannot find module '../html-to-docx'"

### Step 4: Write minimal html-to-docx implementation

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

### Step 5: Run test to verify it passes

Run: `npm test -- src/lib/export/__tests__/html-to-docx.test.ts`

Expected: PASS

### Step 6: Add tests for text formatting

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

### Step 7: Run tests to verify they pass

Run: `npm test -- src/lib/export/__tests__/html-to-docx.test.ts`

Expected: All tests PASS

### Step 8: Create docx-styles module

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

### Step 9: Create main docx export function

Create `src/lib/export/docx.ts`:

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { htmlToDocxElements } from './html-to-docx';
import { defaultStyles, defaultNumbering } from './docx-styles';

export interface DocxExportOptions {
  title: string;
  author?: string;
  includeTitle?: boolean;
  pageSize?: 'letter' | 'a4';
}

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

### Step 10: Run tests to verify nothing broke

Run: `npm test -- src/lib/export/`

Expected: All tests PASS

### Step 11: Create API route

Create `src/app/api/export/docx/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportToDocx } from '@/lib/export/docx';

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, projects!inner(user_id)')
    .eq('id', documentId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const buffer = await exportToDocx(doc.content_text || '', {
      title: doc.title,
    });

    const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.docx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('DOCX export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
```

### Step 12: Commit

Run:

```bash
git add src/lib/export/ src/app/api/export/docx/
git commit -m "feat: add DOCX export with HTML parsing"
```

Expected: Commit created successfully

---

## Task 6.2: PDF Export

**Files:**

- Create: `src/lib/export/pdf-styles.ts`
- Create: `src/lib/export/pdf.ts`
- Create: `src/lib/export/__tests__/pdf.test.ts`
- Create: `src/app/api/export/pdf/route.ts`

### Step 1: Install dependencies

Run:

```bash
npm install puppeteer @sparticuz/chromium puppeteer-core
npm install -D @types/puppeteer
```

Expected: Packages added to package.json

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

export interface PdfExportOptions {
  title: string;
  format?: 'letter' | 'a4';
  includePageNumbers?: boolean;
}

// HTML escape utility to prevent XSS
function escapeHtml(text: string): string {
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

export async function exportToPdf(htmlContent: string, options: PdfExportOptions): Promise<Buffer> {
  const { title, format = 'letter', includePageNumbers = true } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();

  // Escape title to prevent XSS
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

// Test the escapeHtml utility (exported for testing)
describe('escapeHtml', () => {
  // Import the module to test escapeHtml
  // Note: escapeHtml needs to be exported from pdf.ts for testing
  const escapeHtml = (text: string): string => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  };

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

Run: `npm test -- src/lib/export/__tests__/pdf.test.ts`

Expected: All tests PASS

### Step 6: Create API route

Create `src/app/api/export/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportToPdf } from '@/lib/export/pdf';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, projects!inner(user_id)')
    .eq('id', documentId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const buffer = await exportToPdf(doc.content_text || '', {
      title: doc.title,
    });

    const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
```

### Step 7: Commit

Run:

```bash
git add src/lib/export/pdf-styles.ts src/lib/export/pdf.ts src/lib/export/__tests__/pdf.test.ts src/app/api/export/pdf/
git commit -m "feat: add PDF export with Puppeteer and tests"
```

Expected: Commit created successfully

---

## Task 6.3: App Shell & Navigation

**Files:**

- Create: `src/hooks/useMediaQuery.ts`
- Create: `src/hooks/__tests__/useMediaQuery.test.ts`
- Create: `src/components/layout/SkipLinks.tsx`
- Create: `src/components/layout/UserMenu.tsx`
- Create: `src/components/layout/__tests__/UserMenu.test.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/MobileNav.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/AppProviders.tsx`
- Modify: `src/app/(authenticated)/layout.tsx`

### Step 1: Create useMediaQuery hook

Create `src/hooks/useMediaQuery.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

### Step 2: Create SkipLinks for accessibility

Create `src/components/layout/SkipLinks.tsx`:

```typescript
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded focus:outline-none focus:ring-2"
      >
        Skip to main content
      </a>
    </div>
  );
}
```

### Step 3: Create UserMenu component

Create `src/components/layout/UserMenu.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { User, LogOut, Settings } from 'lucide-react';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  const handleSignOut = async () => {
    // Sign out logic will be implemented with Supabase auth
    window.location.href = '/login';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-gray-100 rounded-full"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <User className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg py-1"
          role="menu"
        >
          <a
            href="/settings"
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100"
            role="menuitem"
          >
            <Settings className="w-4 h-4" />
            Settings
          </a>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-red-600"
            role="menuitem"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Create Header component

Create `src/components/layout/Header.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
}

export function Header({ onMenuClick, showMenuButton }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b z-40">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link href="/projects" className="text-xl font-semibold">
            Quill
          </Link>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
```

### Step 5: Create Sidebar component

Create `src/components/layout/Sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderOpen,
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/vault', icon: Archive, label: 'Vault' },
  { href: '/citations', icon: BookOpen, label: 'Citations' },
];

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 bg-gray-50 border-r transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <nav className="p-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 ${
                isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onToggleCollapse}
        className="absolute bottom-4 right-2 p-2 hover:bg-gray-200 rounded-lg"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
```

### Step 6: Create MobileNav component

Create `src/components/layout/MobileNav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, FolderOpen, Archive, BookOpen } from 'lucide-react';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/vault', icon: Archive, label: 'Vault' },
  { href: '/citations', icon: BookOpen, label: 'Citations' },
];

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed top-0 left-0 bottom-0 w-64 bg-white z-50 shadow-lg"
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="text-xl font-semibold">Quill</span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
```

### Step 7: Create AppShell component

Create `src/components/layout/AppShell.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SkipLinks } from './SkipLinks';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSidebarCollapsed(isTablet);
  }, [isTablet]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLinks />
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        showMenuButton={isMobile}
      />

      {isMobile ? (
        <MobileNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={`pt-16 transition-all duration-200 ${
          !isMobile && (sidebarCollapsed ? 'pl-16' : 'pl-64')
        }`}
      >
        <div className="container mx-auto px-4 py-6 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
```

### Step 8: Create layout integration component

Create `src/components/layout/AppProviders.tsx`:

```typescript
'use client';

import { AppShell } from './AppShell';
import { ToastContainer } from '@/components/ui/Toast';
import { CommandPalette } from '@/components/ui/CommandPalette';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AppShell>
      {children}
      <ToastContainer />
      <CommandPalette />
    </AppShell>
  );
}
```

### Step 9: Update app layout to use AppProviders

Modify `src/app/(authenticated)/layout.tsx`:

```typescript
import { AppProviders } from '@/components/layout/AppProviders';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProviders>{children}</AppProviders>;
}
```

### Step 10: Write tests for useMediaQuery hook

Create `src/hooks/__tests__/useMediaQuery.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
  const mockMatchMedia = vi.fn();
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();

  beforeEach(() => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });
    window.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial match state', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('adds event listener on mount', () => {
    renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates when media query changes', () => {
    let changeHandler: (e: { matches: boolean }) => void;
    mockAddEventListener.mockImplementation((event, handler) => {
      changeHandler = handler;
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      changeHandler({ matches: true });
    });

    expect(result.current).toBe(true);
  });
});
```

### Step 11: Write tests for UserMenu component

Create `src/components/layout/__tests__/UserMenu.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UserMenu } from '../UserMenu';

describe('UserMenu', () => {
  it('renders user menu button', () => {
    render(<UserMenu />);
    expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
  });

  it('opens menu on click', async () => {
    render(<UserMenu />);
    const button = screen.getByRole('button', { name: /user menu/i });

    await userEvent.click(button);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes menu on outside click', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <UserMenu />
      </div>
    );

    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu on Escape key', async () => {
    render(<UserMenu />);

    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('has correct ARIA attributes', async () => {
    render(<UserMenu />);
    const button = screen.getByRole('button', { name: /user menu/i });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-haspopup', 'true');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
```

### Step 12: Run tests to verify they pass

Run: `npm test -- src/hooks/__tests__/useMediaQuery.test.ts src/components/layout/__tests__/UserMenu.test.tsx`

Expected: All tests PASS

### Step 13: Commit

Run:

```bash
git add src/hooks/ src/components/layout/ src/app/\(authenticated\)/layout.tsx
git commit -m "feat: add app shell with responsive navigation, providers, and tests"
```

Expected: Commit created successfully

---

## Task 6.4: Loading States & Error Handling

**Files:**

- Create: `src/lib/errors.ts`
- Create: `src/lib/__tests__/errors.test.ts`
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/__tests__/Skeleton.test.tsx`
- Create: `src/components/ui/Spinner.tsx`
- Create: `src/components/ui/ErrorFallback.tsx`
- Create: `src/components/ui/ErrorBoundary.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/loading.tsx`

### Step 1: Create error classes

Create `src/lib/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network connection failed') {
    super(message, 'NETWORK_ERROR', 0, true);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401, true);
  }
}

export class AITimeoutError extends AppError {
  constructor(message = 'AI request timed out') {
    super(message, 'AI_TIMEOUT', 504, true);
  }
}
```

### Step 2: Create Skeleton component

Create `src/components/ui/Skeleton.tsx`:

```typescript
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function DocumentListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading editor">
      <div className="flex gap-2 p-2 border-b">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="w-8 h-8" />
        ))}
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
```

### Step 3: Create Spinner component

Create `src/components/ui/Spinner.tsx`:

```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin text-blue-600 ${sizeClasses[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

### Step 4: Create ErrorFallback component

Create `src/components/ui/ErrorFallback.tsx`:

```typescript
interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-600 mb-4">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  );
}
```

### Step 5: Create ErrorBoundary component

Create `src/components/ui/ErrorBoundary.tsx`:

```typescript
'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorFallback
            error={this.state.error}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        )
      );
    }
    return this.props.children;
  }
}
```

### Step 6: Create global error page

Create `src/app/error.tsx`:

```typescript
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md text-center p-8">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

### Step 7: Create global loading page

Create `src/app/loading.tsx`:

```typescript
import { Spinner } from '@/components/ui/Spinner';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
```

### Step 8: Write tests for error classes

Create `src/lib/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AppError, NetworkError, AuthError, AITimeoutError } from '../errors';

describe('AppError', () => {
  it('creates error with message and code', () => {
    const error = new AppError('Test error', 'TEST_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.recoverable).toBe(true);
  });

  it('allows custom statusCode', () => {
    const error = new AppError('Test', 'TEST', 404);
    expect(error.statusCode).toBe(404);
  });

  it('allows non-recoverable errors', () => {
    const error = new AppError('Test', 'TEST', 500, false);
    expect(error.recoverable).toBe(false);
  });

  it('is instanceof Error', () => {
    const error = new AppError('Test', 'TEST');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('NetworkError', () => {
  it('has default message', () => {
    const error = new NetworkError();
    expect(error.message).toBe('Network connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.statusCode).toBe(0);
  });

  it('accepts custom message', () => {
    const error = new NetworkError('Custom network error');
    expect(error.message).toBe('Custom network error');
  });
});

describe('AuthError', () => {
  it('has default message', () => {
    const error = new AuthError();
    expect(error.message).toBe('Authentication required');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(401);
  });
});

describe('AITimeoutError', () => {
  it('has default message', () => {
    const error = new AITimeoutError();
    expect(error.message).toBe('AI request timed out');
    expect(error.code).toBe('AI_TIMEOUT');
    expect(error.statusCode).toBe(504);
  });
});
```

### Step 9: Write tests for Skeleton component

Create `src/components/ui/__tests__/Skeleton.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, DocumentListSkeleton, EditorSkeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders with custom className', () => {
    const { container } = render(<Skeleton className="w-10 h-10" />);
    expect(container.firstChild).toHaveClass('w-10', 'h-10');
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('has animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});

describe('DocumentListSkeleton', () => {
  it('renders 5 skeleton items', () => {
    render(<DocumentListSkeleton />);
    const items = screen.getAllByRole('status')[0].querySelectorAll('.rounded-lg');
    expect(items.length).toBe(5);
  });

  it('has loading status role', () => {
    render(<DocumentListSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('has screen reader text', () => {
    render(<DocumentListSkeleton />);
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });
});

describe('EditorSkeleton', () => {
  it('renders toolbar skeletons', () => {
    render(<EditorSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading editor');
  });
});
```

### Step 10: Run tests to verify they pass

Run: `npm test -- src/lib/__tests__/errors.test.ts src/components/ui/__tests__/Skeleton.test.tsx`

Expected: All tests PASS

### Step 11: Commit

Run:

```bash
git add src/lib/ src/components/ui/ src/app/error.tsx src/app/loading.tsx
git commit -m "feat: add loading states, error handling, and tests"
```

Expected: Commit created successfully

---

## Task 6.5: Toast Notifications

**Files:**

- Create: `src/hooks/useToast.ts`
- Create: `src/hooks/__tests__/useToast.test.ts`
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/__tests__/Toast.test.tsx`

### Step 1: Create useToast hook with Zustand

Create `src/hooks/useToast.ts`:

```typescript
'use client';

import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    // Longer timeout for errors (10s) vs success/info (5s) per WCAG 2.2.1
    const timeout = type === 'error' ? 10000 : 5000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, timeout);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
```

### Step 2: Create ToastContainer component

Create `src/components/ui/Toast.tsx`:

```typescript
'use client';

import { useToast } from '@/hooks/useToast';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 space-y-2"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 border rounded-lg shadow-lg ${styles[toast.type]}`}
            role="alert"
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

### Step 3: Write tests for useToast hook

Create `src/hooks/__tests__/useToast.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the store between tests
    const { result } = renderHook(() => useToast());
    result.current.toasts.forEach((t) => result.current.removeToast(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('removes a toast manually', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-removes success toast after 5 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-removes error toast after 10 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Error', 'error');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Still there after 5 seconds
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Gone after 10 seconds
    expect(result.current.toasts).toHaveLength(0);
  });

  it('generates unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('First', 'success');
      result.current.addToast('Second', 'success');
    });

    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });
});
```

### Step 4: Run tests to verify useToast works

Run: `npm test -- src/hooks/__tests__/useToast.test.ts`

Expected: All tests PASS

### Step 5: Write tests for ToastContainer component

Create `src/components/ui/__tests__/Toast.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastContainer } from '../Toast';
import { useToast } from '@/hooks/useToast';

// Mock the useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(),
}));

describe('ToastContainer', () => {
  const mockRemoveToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no toasts', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    const { container } = render(<ToastContainer />);
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('renders toast with message', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test message', type: 'success' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [
        { id: '1', message: 'First', type: 'success' },
        { id: '2', message: 'Second', type: 'error' },
      ],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('calls removeToast when dismiss clicked', async () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test', type: 'success' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockRemoveToast).toHaveBeenCalledWith('1');
  });

  it('has correct ARIA attributes', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test', type: 'info' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);

    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies correct styles for each toast type', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Error', type: 'error' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    const toast = screen.getByRole('alert');
    expect(toast).toHaveClass('bg-red-50');
  });
});
```

### Step 6: Run tests to verify ToastContainer works

Run: `npm test -- src/components/ui/__tests__/Toast.test.tsx`

Expected: All tests PASS

### Step 7: Commit

Run:

```bash
git add src/hooks/useToast.ts src/hooks/__tests__/useToast.test.ts src/components/ui/Toast.tsx src/components/ui/__tests__/Toast.test.tsx
git commit -m "feat: add toast notification system with tests"
```

Expected: Commit created successfully

---

## Task 6.6: Command Palette

**Files:**

- Create: `src/components/ui/CommandPalette.tsx`
- Create: `src/components/ui/__tests__/CommandPalette.test.tsx`

### Step 1: Install cmdk

Run:

```bash
npm install cmdk
```

Expected: Package added to package.json

### Step 2: Write failing test for keyboard shortcut

Create `src/components/ui/__tests__/CommandPalette.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommandPalette } from '../CommandPalette';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe('keyboard shortcut', () => {
    it('opens on Cmd+K (Mac)', () => {
      render(<CommandPalette />);

      // Dialog should not be visible initially
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Press Cmd+K
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Dialog should now be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('opens on Ctrl+K (Windows/Linux)', () => {
      render(<CommandPalette />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('toggles closed on second Cmd+K press', () => {
      render(<CommandPalette />);

      // Open
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cleans up event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<CommandPalette />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
```

### Step 3: Run test to verify it fails

Run:

```bash
npm test -- --testPathPattern="CommandPalette" --watchAll=false
```

Expected: FAIL - Cannot find module '../CommandPalette'

### Step 4: Create basic CommandPalette structure

Create `src/components/ui/CommandPalette.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50"
    >
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden">
        <Command.Input
          placeholder="Search or type a command..."
          className="w-full px-4 py-3 border-b outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-gray-500">
            No results found.
          </Command.Empty>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
```

### Step 5: Run test to verify keyboard shortcut passes

Run:

```bash
npm test -- --testPathPattern="CommandPalette" --watchAll=false
```

Expected: PASS - All keyboard shortcut tests pass

### Step 6: Add tests for navigation commands

Add to `src/components/ui/__tests__/CommandPalette.test.tsx` (inside the main describe block):

```typescript
  // Add these describe blocks inside the main 'CommandPalette' describe

  describe('navigation commands', () => {
    it('renders navigation items', async () => {
      render(<CommandPalette />);

      // Open palette
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Check navigation items exist
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('navigates to projects when Projects command selected', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      // Open palette
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Click Projects
      await user.click(screen.getByText('Projects'));

      expect(mockPush).toHaveBeenCalledWith('/projects');
    });

    it('navigates to vault when Vault command selected', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await user.click(screen.getByText('Vault'));

      expect(mockPush).toHaveBeenCalledWith('/vault');
    });

    it('closes dialog after command execution', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByText('Projects'));

      // Dialog should close after command
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('action commands', () => {
    it('renders New Project action', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    it('navigates to new project page when selected', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await user.click(screen.getByText('New Project'));

      expect(mockPush).toHaveBeenCalledWith('/projects/new');
    });
  });

  describe('search functionality', () => {
    it('renders search input with placeholder', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(
        screen.getByPlaceholderText('Search or type a command...')
      ).toBeInTheDocument();
    });

    it('filters items based on search input', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByPlaceholderText('Search or type a command...');
      await user.type(input, 'vault');

      // Vault should still be visible
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByPlaceholderText('Search or type a command...');
      await user.type(input, 'nonexistent command xyz');

      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });
  });

  describe('backdrop interaction', () => {
    it('closes when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click the backdrop (aria-hidden div)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        await user.click(backdrop);
      }

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible label', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-label',
        'Command palette'
      );
    });

    it('focuses input when opened', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByPlaceholderText('Search or type a command...');
      expect(document.activeElement).toBe(input);
    });
  });
```

### Step 7: Add full implementation with navigation and actions

Update `src/components/ui/CommandPalette.tsx` with complete implementation:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { FolderOpen, FileText, Search } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50"
    >
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden">
        <Command.Input
          placeholder="Search or type a command..."
          className="w-full px-4 py-3 border-b outline-none"
          autoFocus
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-gray-500">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Navigation"
            className="text-xs text-gray-500 px-2 py-1"
          >
            <Command.Item
              onSelect={() => runCommand(() => router.push('/projects'))}
              className="flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100"
            >
              <FolderOpen className="w-4 h-4" />
              Projects
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => router.push('/vault'))}
              className="flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100"
            >
              <Search className="w-4 h-4" />
              Vault
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Actions"
            className="text-xs text-gray-500 px-2 py-1"
          >
            <Command.Item
              onSelect={() => runCommand(() => router.push('/projects/new'))}
              className="flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100"
            >
              <FileText className="w-4 h-4" />
              New Project
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
```

### Step 8: Run all CommandPalette tests

Run:

```bash
npm test -- --testPathPattern="CommandPalette" --watchAll=false
```

Expected: PASS - All tests pass

### Step 9: Commit

Run:

```bash
git add src/components/ui/CommandPalette.tsx src/components/ui/__tests__/CommandPalette.test.tsx
git commit -m "feat: add command palette with Cmd+K and comprehensive tests"
```

Expected: Commit created successfully

---

## Task 6.7: E2E Tests

**Files:**

- Create: `e2e/auth.setup.ts`
- Create: `e2e/fixtures/auth.ts`
- Create: `e2e/page-objects/BasePage.ts`
- Create: `e2e/page-objects/EditorPage.ts`
- Create: `e2e/page-objects/ProjectsPage.ts`
- Create: `e2e/auth-flows.spec.ts`
- Create: `e2e/export-flows.spec.ts`
- Create: `e2e/toast-flows.spec.ts`
- Create: `e2e/command-palette.spec.ts`
- Create: `e2e/accessibility.spec.ts`
- Create: `e2e/accessibility-authenticated.spec.ts`
- Create: `e2e/mobile-navigation.spec.ts`
- Create: `e2e/seed-test-data.ts`
- Modify: `playwright.config.ts`
- Modify: `.gitignore`
- Modify: `package.json`

### Step 1: Install accessibility testing

Run:

```bash
npm install -D @axe-core/playwright
```

Expected: Package added to devDependencies

### Step 2: Create auth setup for persistent sessions

Create `e2e/auth.setup.ts`:

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  // For testing, use a test account or mock auth
  // In real implementation, this would complete the magic link flow
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.getByRole('button', { name: /send/i }).click();

  // Wait for auth callback (in test env, this might be mocked)
  // await page.waitForURL('/projects');

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
```

### Step 3: Create auth fixtures

Create `e2e/fixtures/auth.ts`:

```typescript
import { test as base, Page } from '@playwright/test';
import path from 'path';

// Extend base test with authenticated state
export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({}, use) => {
      const authFile = path.join(__dirname, '../.auth/user.json');
      await use(authFile);
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';

export async function authenticateUser(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('button', { name: /send/i }).click();
}
```

### Step 4: Create BasePage class

Create `e2e/page-objects/BasePage.ts`:

```typescript
import { Page, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract readonly url: string | RegExp;

  async goto() {
    await this.page.goto(typeof this.url === 'string' ? this.url : '/');
    await this.waitForLoad();
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async assertOnPage() {
    await expect(this.page).toHaveURL(this.url);
  }
}
```

### Step 5: Create EditorPage page object

Create `e2e/page-objects/EditorPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class EditorPage extends BasePage {
  readonly url = /\/projects\/[\w-]+\/documents\/[\w-]+/;
  readonly editorContent: Locator;
  readonly toolbar: Locator;
  readonly wordCount: Locator;
  readonly saveStatus: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    super(page);
    // Use data-testid selectors for stability
    this.editorContent = page.locator('[data-testid="editor-content"]');
    this.toolbar = page.locator('[data-testid="editor-toolbar"]');
    this.wordCount = page.locator('[data-testid="word-count"]');
    this.saveStatus = page.locator('[data-testid="save-status"]');
    this.exportButton = page.getByRole('button', { name: /export/i });
  }

  async gotoDocument(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await this.waitForLoad();
  }

  async waitForLoad() {
    await super.waitForLoad();
    await expect(this.editorContent).toBeVisible();
  }

  async getWordCount(): Promise<number> {
    await expect(this.wordCount).toBeVisible();
    const text = await this.wordCount.textContent();
    if (!text) throw new Error('Word count element has no text');
    const match = text.match(/(\d+)/);
    if (!match) throw new Error(`Could not parse word count from: ${text}`);
    return parseInt(match[1], 10);
  }

  async exportToDocx() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportButton.click();
    await this.page.getByRole('menuitem', { name: /docx/i }).click();
    return downloadPromise;
  }

  async exportToPdf() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportButton.click();
    await this.page.getByRole('menuitem', { name: /pdf/i }).click();
    return downloadPromise;
  }
}
```

### Step 6: Create ProjectsPage page object

Create `e2e/page-objects/ProjectsPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProjectsPage extends BasePage {
  readonly url = '/projects';
  readonly projectList: Locator;
  readonly newProjectButton: Locator;

  constructor(page: Page) {
    super(page);
    this.projectList = page.locator('[data-testid="project-list"]');
    this.newProjectButton = page.getByRole('button', { name: /new project/i });
  }

  async waitForLoad() {
    await super.waitForLoad();
    await expect(this.projectList).toBeVisible();
  }

  async createProject(name: string) {
    await this.newProjectButton.click();
    await this.page.getByLabel('Project name').fill(name);
    await this.page.getByRole('button', { name: /create/i }).click();
  }

  async getProjectCount(): Promise<number> {
    const items = this.projectList.locator('[data-testid="project-item"]');
    return await items.count();
  }
}
```

### Step 7: Create auth flow tests

Create `e2e/auth-flows.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });
});
```

### Step 8: Create export flow tests

Create `e2e/export-flows.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth';
import { EditorPage } from './page-objects/EditorPage';

test.describe('Document Export', () => {
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    editorPage = new EditorPage(page);
    // Navigate to a test document (requires seeded test data)
    await editorPage.gotoDocument('test-project-id', 'test-document-id');
  });

  test('exports to DOCX', async () => {
    const download = await editorPage.exportToDocx();
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  });

  test('exports to PDF', async () => {
    const download = await editorPage.exportToPdf();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
```

### Step 9: Create toast notification tests

Create `e2e/toast-flows.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Toast Notifications', () => {
  test('shows success toast on action', async ({ page }) => {
    await page.goto('/projects');

    // Trigger an action that shows a toast (e.g., create project)
    await page.getByRole('button', { name: /new project/i }).click();
    await page.getByLabel('Project name').fill('Test Project');
    await page.getByRole('button', { name: /create/i }).click();

    // Verify toast appears
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/created|success/i);
  });

  test('toast can be dismissed manually', async ({ page }) => {
    await page.goto('/projects');

    // Trigger toast
    await page.getByRole('button', { name: /new project/i }).click();
    await page.getByLabel('Project name').fill('Test Project');
    await page.getByRole('button', { name: /create/i }).click();

    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible();

    // Dismiss toast
    await toast.getByRole('button', { name: /dismiss/i }).click();
    await expect(toast).not.toBeVisible();
  });

  test('toast auto-dismisses after timeout', async ({ page }) => {
    await page.goto('/projects');

    // Trigger toast
    await page.getByRole('button', { name: /new project/i }).click();
    await page.getByLabel('Project name').fill('Test Project');
    await page.getByRole('button', { name: /create/i }).click();

    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible();

    // Wait for auto-dismiss (5 seconds + buffer)
    await expect(toast).not.toBeVisible({ timeout: 7000 });
  });
});
```

### Step 10: Create command palette tests

Create `e2e/command-palette.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('opens with Cmd+K (Mac) or Ctrl+K (Windows)', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog', { name: /command palette/i });
    await expect(dialog).toBeVisible();
  });

  test('closes with Escape key', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog', { name: /command palette/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('filters commands as user types', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    const input = page.getByPlaceholder(/search or type/i);
    await input.fill('proj');

    // Should show Projects item, hide others
    await expect(page.getByRole('option', { name: /projects/i })).toBeVisible();
  });

  test('navigates with arrow keys and Enter', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    // Navigate down to first item
    await page.keyboard.press('ArrowDown');

    // Select with Enter
    await page.keyboard.press('Enter');

    // Should have navigated (dialog closes, URL changes)
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('executes navigation command', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    // Click on Vault option
    await page.getByRole('option', { name: /vault/i }).click();

    // Should navigate to vault
    await expect(page).toHaveURL(/\/vault/);
  });
});
```

### Step 11: Create accessibility tests for unauthenticated pages

Create `e2e/accessibility.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility - Unauthenticated', () => {
  test('login page has no accessibility violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    if (results.violations.length > 0) {
      console.log('Accessibility violations on login:', results.violations);
    }

    expect(results.violations).toEqual([]);
  });

  test('skip link is focusable and navigates to main content', async ({ page }) => {
    await page.goto('/login');

    // Tab to skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to main/i });
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');

    // Verify focus moved to main content
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeFocused();
  });

  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/login');

    // Tab through all focusable elements
    const focusableElements: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName + (el?.getAttribute('aria-label') || '');
      });
      focusableElements.push(focused);
    }

    // Should have multiple focusable elements
    expect(focusableElements.filter((el) => el !== 'BODY')).not.toHaveLength(0);
  });

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });
});
```

### Step 12: Create accessibility tests for authenticated pages

Create `e2e/accessibility-authenticated.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth';
import AxeBuilder from '@axe-core/playwright';

// Authenticated pages to test
const authenticatedPages = [
  { name: 'projects', path: '/projects' },
  { name: 'vault', path: '/vault' },
  { name: 'citations', path: '/citations' },
];

test.describe('Accessibility - Authenticated', () => {
  for (const { name, path } of authenticatedPages) {
    test(`${name} page has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

      if (results.violations.length > 0) {
        console.log(`Accessibility violations on ${name}:`, results.violations);
      }

      expect(results.violations).toEqual([]);
    });
  }

  test('sidebar navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/projects');

    // Tab to sidebar nav items
    const navItems = page.locator('nav a');
    const count = await navItems.count();

    expect(count).toBeGreaterThan(0);

    // Verify each nav item is focusable
    for (let i = 0; i < count; i++) {
      const item = navItems.nth(i);
      await item.focus();
      await expect(item).toBeFocused();
    }
  });

  test('user menu is keyboard accessible', async ({ page }) => {
    await page.goto('/projects');

    // Tab to user menu button
    const userMenuButton = page.getByRole('button', { name: /user menu/i });
    await userMenuButton.focus();
    await expect(userMenuButton).toBeFocused();

    // Open menu with Enter
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
  });
});
```

### Step 13: Create mobile-specific tests

Create `e2e/mobile-navigation.spec.ts`:

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Navigation', () => {
  test.use({ ...devices['iPhone 12'] });

  test('shows hamburger menu on mobile', async ({ page }) => {
    await page.goto('/projects');

    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).toBeVisible();
  });

  test('opens mobile nav drawer on hamburger click', async ({ page }) => {
    await page.goto('/projects');

    await page.getByRole('button', { name: /open menu/i }).click();

    const nav = page.getByRole('dialog', { name: /navigation/i });
    await expect(nav).toBeVisible();
  });

  test('closes mobile nav on close button click', async ({ page }) => {
    await page.goto('/projects');

    await page.getByRole('button', { name: /open menu/i }).click();
    const nav = page.getByRole('dialog', { name: /navigation/i });
    await expect(nav).toBeVisible();

    await page.getByRole('button', { name: /close menu/i }).click();
    await expect(nav).not.toBeVisible();
  });

  test('closes mobile nav on backdrop click', async ({ page }) => {
    await page.goto('/projects');

    await page.getByRole('button', { name: /open menu/i }).click();
    const nav = page.getByRole('dialog', { name: /navigation/i });
    await expect(nav).toBeVisible();

    // Click backdrop (outside nav)
    await page.locator('.bg-black\\/50').click();
    await expect(nav).not.toBeVisible();
  });

  test('navigates and closes menu on link click', async ({ page }) => {
    await page.goto('/projects');

    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('link', { name: /vault/i }).click();

    await expect(page).toHaveURL(/\/vault/);
    const nav = page.getByRole('dialog', { name: /navigation/i });
    await expect(nav).not.toBeVisible();
  });
});
```

### Step 14: Update Playwright config

Modify `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  // Timeouts
  timeout: 60000, // 60 seconds for tests (export can be slow)
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000, // 15 seconds for actions
  },

  projects: [
    // Auth setup project
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Desktop Chrome with auth
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile tests
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 12'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Unauthenticated tests (login page, etc.)
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth-flows\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for server startup
  },
});
```

### Step 15: Add .gitignore entries for auth state

Add to `.gitignore`:

```
# Playwright auth state (contains session tokens)
e2e/.auth/
```

### Step 16: Create test data seeding script

Create `e2e/seed-test-data.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for seeding
);

export async function seedTestData() {
  // Create test user (if not using auth mock)
  const testUserId = process.env.TEST_USER_ID || 'test-user-id';

  // Create test project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .upsert({
      id: 'test-project-id',
      user_id: testUserId,
      name: 'Test Project',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (projectError) {
    console.error('Failed to seed project:', projectError);
    throw projectError;
  }

  // Create test document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .upsert({
      id: 'test-document-id',
      project_id: project.id,
      title: 'Test Document',
      content_text: '<p>This is test content for export testing.</p>',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (docError) {
    console.error('Failed to seed document:', docError);
    throw docError;
  }

  console.log('Test data seeded successfully');
  return { project, document };
}

export async function cleanupTestData() {
  await supabase.from('documents').delete().eq('id', 'test-document-id');
  await supabase.from('projects').delete().eq('id', 'test-project-id');
  console.log('Test data cleaned up');
}

// Run directly if called as script
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### Step 17: Update auth setup to seed test data

Update `e2e/auth.setup.ts`:

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { seedTestData } from './seed-test-data';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate and seed data', async ({ page }) => {
  // Seed test data first
  await seedTestData();

  // For testing, use a test account or mock auth
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.getByRole('button', { name: /send/i }).click();

  // Wait for auth callback (in test env, this might be mocked)
  // await page.waitForURL('/projects');

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
```

### Step 18: Add test script to package.json

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:seed": "tsx e2e/seed-test-data.ts"
  }
}
```

### Step 19: Run E2E tests

Run: `npm run test:e2e`

Expected: Tests execute with auth setup and seeded test data

### Step 20: Commit

Run:

```bash
git add e2e/ playwright.config.ts
git commit -m "test: add comprehensive E2E test suite"
```

Expected: Commit created successfully

---

## Verification Checklist

After completing all tasks, verify:

### Build & Tests

- [ ] `npm run build` succeeds without errors
- [ ] `npm test` passes all unit tests
- [ ] `npm run test:e2e` passes all E2E tests

### Export Functionality

- [ ] DOCX export generates valid Word documents with formatting preserved
- [ ] PDF export generates valid PDFs with proper styling
- [ ] Export handles special characters in document titles (XSS prevention)

### App Shell & Navigation

- [ ] App shell is responsive (mobile, tablet, desktop)
- [ ] Sidebar collapses on tablet, hidden on mobile
- [ ] Mobile hamburger menu opens/closes correctly
- [ ] Navigation links highlight active route
- [ ] Skip link works for keyboard navigation

### User Interactions

- [ ] UserMenu opens on click, closes on outside click
- [ ] UserMenu closes on Escape key
- [ ] Command palette opens with Cmd+K / Ctrl+K
- [ ] Command palette filters commands while typing
- [ ] Command palette navigates with arrow keys

### Feedback & Error Handling

- [ ] Toast notifications appear on actions
- [ ] Toast notifications auto-dismiss (5s success, 10s error)
- [ ] Toast notifications can be manually dismissed
- [ ] Loading skeletons display during data fetch
- [ ] Error boundaries catch and display errors gracefully
- [ ] Error pages show user-friendly messages

### Accessibility

- [ ] All pages pass axe-core accessibility audit
- [ ] All interactive elements are keyboard accessible
- [ ] Screen reader announcements work for toasts (aria-live)
- [ ] Focus management works correctly in modals
- [ ] Color contrast meets WCAG AA standards
