import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractionResult } from '../pdf';

// Use vi.hoisted to create mock functions that can be used in vi.mock
const { mockExtractRawText, mockLoggerWarn, mockLoggerError, mockLoggerInfo } = vi.hoisted(() => ({
  mockExtractRawText: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

// Mock mammoth module (namespace import)
vi.mock('mammoth', () => ({
  extractRawText: mockExtractRawText,
  default: { extractRawText: mockExtractRawText },
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
import { extractDocxText } from '../docx';

describe('DOCX extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractDocxText', () => {
    it('extracts text from valid DOCX buffer', async () => {
      const expectedText = 'Hello, this is DOCX content.';

      mockExtractRawText.mockResolvedValueOnce({
        value: expectedText,
      });

      const result: ExtractionResult = await extractDocxText(Buffer.from('fake docx data'));

      expect(result.success).toBe(true);
      expect(result.text).toBe(expectedText);
      expect(result.error).toBeUndefined();
      expect(mockExtractRawText).toHaveBeenCalledTimes(1);
      expect(mockExtractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
    });

    it('handles corrupted DOCX gracefully (success: false, error message)', async () => {
      mockExtractRawText.mockRejectedValueOnce(new Error('Invalid DOCX structure'));

      const result: ExtractionResult = await extractDocxText(Buffer.from('corrupted data'));

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toContain('Invalid DOCX structure');
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('handles empty buffer (success: false)', async () => {
      const result: ExtractionResult = await extractDocxText(Buffer.alloc(0));

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toBeDefined();
      expect(mockLoggerWarn).toHaveBeenCalled();
      // mammoth should not be called for empty buffer
      expect(mockExtractRawText).not.toHaveBeenCalled();
    });
  });
});
