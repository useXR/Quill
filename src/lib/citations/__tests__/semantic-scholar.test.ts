// src/lib/citations/__tests__/semantic-scholar.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockPaper, createMockSearchResponse, resetFactoryCounter } from '@/test-utils/factories';
import { CITATIONS } from '@/lib/constants/citations';

// Mock the citation logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import after mocking
import { searchPapers } from '../semantic-scholar';

describe('searchPapers', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    resetFactoryCounter();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('success cases', () => {
    it('returns papers for valid query', async () => {
      const mockPapers = [createMockPaper(), createMockPaper()];
      const mockResponse = createMockSearchResponse(mockPapers);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await searchPapers('machine learning');

      expect(result).toHaveLength(2);
      expect(result[0].paperId).toBe(mockPapers[0].paperId);
      expect(result[1].paperId).toBe(mockPapers[1].paperId);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('respects limit parameter', async () => {
      const mockPapers = [createMockPaper()];
      const mockResponse = createMockSearchResponse(mockPapers);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      await searchPapers('neural networks', { limit: 5 });

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('limit=5');
    });

    it('returns empty array for no results', async () => {
      const mockResponse = createMockSearchResponse([]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await searchPapers('xyznonexistentquery123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('URL-encodes query parameters', async () => {
      const mockResponse = createMockSearchResponse([]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      await searchPapers('machine learning & AI');

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain(encodeURIComponent('machine learning & AI'));
      expect(fetchUrl).not.toContain('machine learning & AI');
    });

    it('uses correct API endpoint and fields', async () => {
      const mockResponse = createMockSearchResponse([]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      await searchPapers('test query');

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain(CITATIONS.SEMANTIC_SCHOLAR_API_BASE);
      expect(fetchUrl).toContain('/paper/search');
      expect(fetchUrl).toContain('fields=');
    });

    it('uses default limit when not specified', async () => {
      const mockResponse = createMockSearchResponse([]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      await searchPapers('test');

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain(`limit=${CITATIONS.DEFAULT_SEARCH_LIMIT}`);
    });
  });
});
