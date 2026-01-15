/**
 * Page Object Model for document export functionality.
 * Encapsulates export API calls and download handling.
 */
import { Page, expect, APIResponse } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export interface DocxExportOptions {
  documentId: string;
  includeTitle?: boolean;
  pageSize?: 'letter' | 'a4';
}

export interface ExportResult {
  response: APIResponse;
  buffer: Buffer;
  filename: string;
}

export class ExportPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Export a document to DOCX format via API.
   */
  async exportToDocx(options: DocxExportOptions): Promise<ExportResult> {
    const { documentId, includeTitle = true, pageSize = 'letter' } = options;

    const response = await this.page.request.post('/api/export/docx', {
      data: {
        documentId,
        includeTitle,
        pageSize,
      },
      timeout: TIMEOUTS.API_CALL * 2, // Allow extra time for document generation
    });

    const buffer = Buffer.from(await response.body());

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers()['content-disposition'] || '';
    const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : 'document.docx';

    return {
      response,
      buffer,
      filename,
    };
  }

  /**
   * Assert that DOCX export was successful.
   */
  async expectDocxExportSuccess(result: ExportResult): Promise<void> {
    expect(result.response.ok()).toBe(true);
    expect(result.response.status()).toBe(200);

    // Verify Content-Type header
    const contentType = result.response.headers()['content-type'];
    expect(contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // Verify buffer is not empty
    expect(result.buffer.length).toBeGreaterThan(0);

    // Verify filename ends with .docx
    expect(result.filename.endsWith('.docx')).toBe(true);
  }

  /**
   * Assert that DOCX export failed with expected error.
   */
  async expectDocxExportError(result: ExportResult, expectedStatus: number): Promise<void> {
    expect(result.response.ok()).toBe(false);
    expect(result.response.status()).toBe(expectedStatus);
  }

  /**
   * Assert that the exported DOCX is a valid ZIP file (DOCX format).
   * DOCX files are ZIP archives with a specific signature.
   */
  expectValidDocxFormat(buffer: Buffer): void {
    // DOCX/ZIP files start with PK signature (0x50 0x4B 0x03 0x04)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  }

  /**
   * Export document and verify success in one call.
   */
  async exportAndVerify(options: DocxExportOptions): Promise<ExportResult> {
    const result = await this.exportToDocx(options);
    await this.expectDocxExportSuccess(result);
    this.expectValidDocxFormat(result.buffer);
    return result;
  }
}
