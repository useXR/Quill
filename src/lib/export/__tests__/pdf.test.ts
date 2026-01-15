import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions that will be used by the mocked modules
const mockSetContent = vi.fn();
const mockPdf = vi.fn();
const mockClose = vi.fn();
const mockNewPage = vi.fn();
const mockBrowserClose = vi.fn();
const mockLaunch = vi.fn();

// Mock puppeteer - use factory functions to return the mocked values
vi.mock('puppeteer', () => ({
  default: {
    launch: () => mockLaunch(),
  },
}));

vi.mock('puppeteer-core', () => ({
  default: {
    launch: () => mockLaunch(),
  },
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    defaultViewport: { width: 800, height: 600 },
    executablePath: vi.fn().mockResolvedValue('/path/to/chrome'),
  },
}));

// Import after mocking
import { escapeHtml, exportToPdf, closeBrowser } from '../pdf';

describe('PDF Export', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock implementations
    mockSetContent.mockResolvedValue(undefined);
    mockPdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf content'));
    mockClose.mockResolvedValue(undefined);
    mockBrowserClose.mockResolvedValue(undefined);

    // Set up the mock chain for each test
    const mockPage = {
      setContent: mockSetContent,
      pdf: mockPdf,
      close: mockClose,
    };

    const mockBrowser = {
      newPage: mockNewPage.mockResolvedValue(mockPage),
      close: mockBrowserClose,
    };

    mockLaunch.mockResolvedValue(mockBrowser);

    // Close any existing browser singleton
    await closeBrowser();
  });

  describe('escapeHtml', () => {
    it('should escape ampersand character', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than character', () => {
      expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
    });

    it('should escape greater than character', () => {
      expect(escapeHtml('3 > 2')).toBe('3 &gt; 2');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("It's fine")).toBe('It&#39;s fine');
    });

    it('should escape multiple special characters', () => {
      expect(escapeHtml('<script>alert("XSS & attack")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS &amp; attack&quot;)&lt;/script&gt;'
      );
    });

    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not modify strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('exportToPdf', () => {
    it('should create a PDF with default options', async () => {
      const result = await exportToPdf('<p>Test content</p>', {
        title: 'Test Document',
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(mockNewPage).toHaveBeenCalledTimes(1);
      expect(mockSetContent).toHaveBeenCalledTimes(1);
      expect(mockPdf).toHaveBeenCalledTimes(1);
      expect(mockClose).toHaveBeenCalledTimes(1);

      // Verify PDF options
      const pdfCall = mockPdf.mock.calls[0][0];
      expect(pdfCall.format).toBe('Letter');
      expect(pdfCall.margin).toEqual({
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      });
    });

    it('should use A4 format when specified', async () => {
      await exportToPdf('<p>Test content</p>', {
        title: 'Test Document',
        format: 'a4',
      });

      const pdfCall = mockPdf.mock.calls[0][0];
      expect(pdfCall.format).toBe('A4');
    });

    it('should include page numbers when requested', async () => {
      await exportToPdf('<p>Test content</p>', {
        title: 'Test Document',
        includePageNumbers: true,
      });

      const pdfCall = mockPdf.mock.calls[0][0];
      expect(pdfCall.displayHeaderFooter).toBe(true);
      expect(pdfCall.headerTemplate).toBe('<div></div>');
      expect(pdfCall.footerTemplate).toContain('pageNumber');
      expect(pdfCall.footerTemplate).toContain('totalPages');
      // Extra bottom margin for footer
      expect(pdfCall.margin.bottom).toBe('1.5in');
    });

    it('should escape title in HTML document', async () => {
      await exportToPdf('<p>Test content</p>', {
        title: 'Document with <script>XSS</script>',
      });

      const setContentCall = mockSetContent.mock.calls[0][0];
      expect(setContentCall).toContain('&lt;script&gt;XSS&lt;/script&gt;');
      expect(setContentCall).not.toContain('<script>XSS</script>');
    });

    it('should include PDF styles in the document', async () => {
      await exportToPdf('<p>Test content</p>', {
        title: 'Test Document',
      });

      const setContentCall = mockSetContent.mock.calls[0][0];
      expect(setContentCall).toContain("font-family: 'Times New Roman', serif");
      expect(setContentCall).toContain('font-size: 12pt');
      expect(setContentCall).toContain('line-height: 1.6');
    });

    it('should close page after PDF generation', async () => {
      await exportToPdf('<p>Test content</p>', {
        title: 'Test Document',
      });

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should close page even if PDF generation fails', async () => {
      // Set up PDF to fail
      mockPdf.mockRejectedValueOnce(new Error('PDF generation failed'));

      await expect(
        exportToPdf('<p>Test content</p>', {
          title: 'Test Document',
        })
      ).rejects.toThrow('PDF generation failed');

      // Page close should still be called
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should set content with networkidle0 wait condition', async () => {
      await exportToPdf('<p>Test content</p>', {
        title: 'Test Document',
      });

      expect(mockSetContent).toHaveBeenCalledWith(expect.any(String), {
        waitUntil: 'networkidle0',
      });
    });
  });

  describe('closeBrowser', () => {
    it('should close the browser singleton', async () => {
      // Create a browser by generating a PDF
      await exportToPdf('<p>Test</p>', { title: 'Test' });

      // Clear mock to track only the explicit close call
      mockBrowserClose.mockClear();

      await closeBrowser();

      expect(mockBrowserClose).toHaveBeenCalledTimes(1);
    });

    it('should handle being called when no browser exists', async () => {
      // Should not throw
      await expect(closeBrowser()).resolves.not.toThrow();
    });
  });
});
