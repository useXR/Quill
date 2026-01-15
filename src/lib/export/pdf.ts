/**
 * PDF Export Module
 *
 * Server-side PDF document export using Puppeteer.
 * Supports letter and A4 page formats with optional page numbers.
 */

import type { Browser, Page, PDFOptions } from 'puppeteer';
import type { PdfExportOptions } from './types';
import { pdfStyles, footerTemplate } from './pdf-styles';

// Browser singleton for reuse across requests
let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;

/**
 * Escape HTML special characters to prevent XSS.
 * Used for user-provided content like document titles.
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Get or create a browser instance.
 * Uses a singleton pattern with race condition prevention.
 */
async function getBrowser(): Promise<Browser> {
  // Return existing browser if available
  if (browserInstance) {
    return browserInstance;
  }

  // If browser is being created, wait for that promise
  if (browserPromise) {
    return browserPromise;
  }

  // Create a new browser instance
  browserPromise = (async () => {
    // Dynamic import for puppeteer to handle both dev and serverless environments
    const puppeteer = await import('puppeteer');

    // Check if we're in a serverless environment (Vercel)
    const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;

    if (isServerless) {
      // Use @sparticuz/chromium for serverless environments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromium = (await import('@sparticuz/chromium')) as any;
      const puppeteerCore = await import('puppeteer-core');

      browserInstance = await puppeteerCore.default.launch({
        args: chromium.default.args,
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: true,
      });
    } else {
      // Use regular puppeteer for local development
      browserInstance = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    browserPromise = null;
    return browserInstance;
  })();

  return browserPromise;
}

/**
 * Close the browser singleton.
 * Should be called during shutdown or cleanup.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    browserPromise = null;
  }
}

/**
 * Generate a complete HTML document with styles.
 */
function generateHtmlDocument(htmlContent: string, title: string): string {
  const escapedTitle = escapeHtml(title);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>${pdfStyles}</style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}

/**
 * Export HTML content to a PDF buffer.
 *
 * @param htmlContent - The HTML content to convert
 * @param options - Export options (title, format, page numbers)
 * @returns Promise<Buffer> - The PDF file as a buffer
 */
export async function exportToPdf(htmlContent: string, options: PdfExportOptions): Promise<Buffer> {
  const { title, format = 'letter', includePageNumbers = false } = options;

  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();

    // Generate the HTML document with styles
    const fullHtml = generateHtmlDocument(htmlContent, title);

    // Set the content
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0',
    });

    // Configure PDF options
    const pdfOptions: PDFOptions = {
      format: format === 'a4' ? 'A4' : 'Letter',
      margin: {
        top: '1in',
        right: '1in',
        bottom: includePageNumbers ? '1.5in' : '1in', // Extra space for footer
        left: '1in',
      },
      printBackground: true,
    };

    // Add page numbers if requested
    if (includePageNumbers) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<div></div>'; // Empty header
      pdfOptions.footerTemplate = footerTemplate;
    }

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    // Convert Uint8Array to Buffer if needed
    return Buffer.from(pdfBuffer);
  } finally {
    // Always close the page to free resources
    if (page) {
      await page.close();
    }
  }
}
