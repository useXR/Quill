/**
 * PDF Export E2E Tests
 *
 * Tests for document export to PDF format.
 * Uses the Phase 0 E2E infrastructure with authenticated storage state.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ExportPage } from '../pages/ExportPage';
import { randomUUID } from 'crypto';

// Test data stored per-worker to avoid race conditions
const testData: { projectId?: string; documentId?: string } = {};

// Helper to create a test project via API
async function createTestProject(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      title: `E2E PDF Export Test ${Date.now()}`,
      description: 'Test project for PDF export E2E tests',
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()}`);
  }
  const project = await response.json();
  return project.id;
}

// Helper to create a test document with content via API
async function createTestDocument(
  page: import('@playwright/test').Page,
  projectId: string,
  title: string,
  content?: object
): Promise<string> {
  const response = await page.request.post('/api/documents', {
    data: {
      project_id: projectId,
      title,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create document: ${response.status()}`);
  }
  const document = await response.json();

  // Update with content if provided
  if (content) {
    const updateResponse = await page.request.patch(`/api/documents/${document.id}`, {
      data: {
        content,
      },
    });
    if (!updateResponse.ok()) {
      throw new Error(`Failed to update document content: ${updateResponse.status()}`);
    }
  }

  return document.id;
}

// Sample TipTap document content
const sampleContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Test PDF Document Heading' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This is a test paragraph with ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold text' },
        { type: 'text', text: ' and ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic text' },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second item' }] }],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a quote.' }] }],
    },
  ],
};

test.describe('PDF Export', () => {
  // Create a test project and document for each worker
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();
    testData.projectId = await createTestProject(page);
    testData.documentId = await createTestDocument(page, testData.projectId, 'PDF Export Test Document', sampleContent);
    await context.close();
  });

  test.describe('Successful Export', () => {
    test('should export document to PDF format', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportPdfAndVerify({
        documentId: testData.documentId!,
      });

      // Verify filename contains the document title
      expect(result.filename).toContain('PDF_Export_Test_Document');
      expect(result.filename).toEndWith('.pdf');
    });

    test('should export document with page numbers', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportPdfAndVerify({
        documentId: testData.documentId!,
        includePageNumbers: true,
      });

      expect(result.response.ok()).toBe(true);
    });

    test('should export document with A4 format', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportPdfAndVerify({
        documentId: testData.documentId!,
        format: 'a4',
      });

      expect(result.response.ok()).toBe(true);
    });

    test('should export document with Letter format', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportPdfAndVerify({
        documentId: testData.documentId!,
        format: 'letter',
      });

      expect(result.response.ok()).toBe(true);
    });

    test('should handle document with empty content', async ({ page, browser }) => {
      // Create a document without content
      const context = await browser.newContext({
        storageState: '.playwright/.auth/user.json',
      });
      const setupPage = await context.newPage();
      const emptyDocId = await createTestDocument(setupPage, testData.projectId!, 'Empty PDF Document');
      await context.close();

      const exportPage = new ExportPage(page);
      const result = await exportPage.exportPdfAndVerify({
        documentId: emptyDocId,
      });

      expect(result.response.ok()).toBe(true);
    });

    test('should sanitize special characters in filename', async ({ page, browser }) => {
      // Create a document with special characters in title
      const context = await browser.newContext({
        storageState: '.playwright/.auth/user.json',
      });
      const setupPage = await context.newPage();
      const specialDocId = await createTestDocument(
        setupPage,
        testData.projectId!,
        'PDF: With <Special> "Characters"',
        sampleContent
      );
      await context.close();

      const exportPage = new ExportPage(page);
      const result = await exportPage.exportPdfAndVerify({
        documentId: specialDocId,
      });

      // Filename should not contain special characters
      expect(result.filename).not.toContain(':');
      expect(result.filename).not.toContain('<');
      expect(result.filename).not.toContain('>');
      expect(result.filename).not.toContain('"');
      expect(result.filename).toEndWith('.pdf');
    });

    test('should export with both A4 format and page numbers', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportPdfAndVerify({
        documentId: testData.documentId!,
        format: 'a4',
        includePageNumbers: true,
      });

      expect(result.response.ok()).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should return 400 for invalid document ID', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportToPdf({
        documentId: 'invalid-id',
      });

      await exportPage.expectPdfExportError(result, 400);
    });

    test('should return 404 for non-existent document', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportToPdf({
        documentId: randomUUID(),
      });

      await exportPage.expectPdfExportError(result, 404);
    });

    test('should return 401 for unauthenticated request', async ({ browser }) => {
      // Create a context without authentication
      const context = await browser.newContext();
      const page = await context.newPage();

      const response = await page.request.post('/api/export/pdf', {
        data: {
          documentId: testData.documentId,
        },
      });

      expect(response.status()).toBe(401);

      await context.close();
    });
  });

  test.describe('Content Preservation', () => {
    test('should produce valid PDF file structure', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportToPdf({
        documentId: testData.documentId!,
      });

      // PDF files start with %PDF- signature
      exportPage.expectValidPdfFormat(result.buffer);
    });

    test('should set correct content length header', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportToPdf({
        documentId: testData.documentId!,
      });

      const contentLength = parseInt(result.response.headers()['content-length'] || '0', 10);
      expect(contentLength).toBe(result.buffer.length);
    });

    test('should set correct content type header', async ({ page }) => {
      const exportPage = new ExportPage(page);

      const result = await exportPage.exportToPdf({
        documentId: testData.documentId!,
      });

      const contentType = result.response.headers()['content-type'];
      expect(contentType).toBe('application/pdf');
    });
  });
});
