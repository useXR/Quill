import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractionResult } from '../pdf';

// Use vi.hoisted to create mock functions that can be used in vi.mock
const { mockPdfParse, mockLoggerWarn, mockLoggerError, mockLoggerInfo } = vi.hoisted(() => ({
  mockPdfParse: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

// Mock pdf-parse module
vi.mock('pdf-parse', () => ({
  default: mockPdfParse,
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  vaultLogger: () => ({
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: mockLoggerInfo,
  }),
}));

// Import the function under test after mocks are set up
import { extractPdfText } from '../pdf';

describe('PDF extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractPdfText', () => {
    it('extracts text from valid PDF buffer (returns text, success: true, pageCount)', async () => {
      const expectedText = 'Hello, this is PDF content.';
      const expectedPageCount = 3;

      mockPdfParse.mockResolvedValueOnce({
        text: expectedText,
        numpages: expectedPageCount,
      });

      const result: ExtractionResult = await extractPdfText(Buffer.from('fake pdf data'));

      expect(result.success).toBe(true);
      expect(result.text).toBe(expectedText);
      expect(result.pageCount).toBe(expectedPageCount);
      expect(result.error).toBeUndefined();
      expect(mockPdfParse).toHaveBeenCalledTimes(1);
    });

    it('handles corrupted PDF gracefully (success: false, error message)', async () => {
      mockPdfParse.mockRejectedValueOnce(new Error('Invalid PDF structure'));

      const result: ExtractionResult = await extractPdfText(Buffer.from('corrupted data'));

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toContain('Invalid PDF structure');
      expect(result.pageCount).toBeUndefined();
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('handles empty buffer (success: false)', async () => {
      const result: ExtractionResult = await extractPdfText(Buffer.alloc(0));

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toBeDefined();
      expect(mockLoggerWarn).toHaveBeenCalled();
      // pdf-parse should not be called for empty buffer
      expect(mockPdfParse).not.toHaveBeenCalled();
    });
  });
});
