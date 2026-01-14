import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EMBEDDING_CONFIG } from '@/lib/vault/constants';

// Create a mock function that will be shared across tests
const mockCreate = vi.fn();

// Mock the OpenAI module with proper constructor support
vi.mock('openai', () => {
  // Create a mock class for OpenAI
  class MockOpenAI {
    embeddings = {
      create: mockCreate,
    };
  }

  // Create a mock class for APIError (needed for rate limiting logic)
  class MockAPIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  return {
    default: MockOpenAI,
    APIError: MockAPIError,
  };
});

// Mock the logger
vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEmbedding', () => {
    it('returns embedding of correct dimension (1536)', async () => {
      const mockEmbedding = Array(EMBEDDING_CONFIG.dimensions).fill(0.1);
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const { getEmbedding } = await import('../embeddings');
      const result = await getEmbedding('test text');

      expect(result).toHaveLength(EMBEDDING_CONFIG.dimensions);
      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: EMBEDDING_CONFIG.model,
        input: 'test text',
      });
    });
  });

  describe('getEmbeddings', () => {
    it('returns embeddings for multiple texts', async () => {
      const mockEmbedding1 = Array(EMBEDDING_CONFIG.dimensions).fill(0.1);
      const mockEmbedding2 = Array(EMBEDDING_CONFIG.dimensions).fill(0.2);
      const mockEmbedding3 = Array(EMBEDDING_CONFIG.dimensions).fill(0.3);

      mockCreate.mockResolvedValueOnce({
        data: [
          { embedding: mockEmbedding1, index: 0 },
          { embedding: mockEmbedding2, index: 1 },
          { embedding: mockEmbedding3, index: 2 },
        ],
      });

      const { getEmbeddings } = await import('../embeddings');
      const result = await getEmbeddings(['text1', 'text2', 'text3']);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(mockEmbedding1);
      expect(result[1]).toEqual(mockEmbedding2);
      expect(result[2]).toEqual(mockEmbedding3);
      expect(mockCreate).toHaveBeenCalledWith({
        model: EMBEDDING_CONFIG.model,
        input: ['text1', 'text2', 'text3'],
      });
    });

    it('handles empty array', async () => {
      const { getEmbeddings } = await import('../embeddings');
      const result = await getEmbeddings([]);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('batches large requests (>100 items)', async () => {
      const batchSize = EMBEDDING_CONFIG.batchSize; // 100
      const totalTexts = 250;
      const texts = Array(totalTexts)
        .fill(null)
        .map((_, i) => `text ${i}`);

      // Create mock embeddings for each batch
      const createBatchResponse = (startIndex: number, count: number) => ({
        data: Array(count)
          .fill(null)
          .map((_, i) => ({
            embedding: Array(EMBEDDING_CONFIG.dimensions).fill((startIndex + i) / 1000),
            index: i,
          })),
      });

      // First batch: 100 items
      mockCreate.mockResolvedValueOnce(createBatchResponse(0, batchSize));
      // Second batch: 100 items
      mockCreate.mockResolvedValueOnce(createBatchResponse(100, batchSize));
      // Third batch: 50 items
      mockCreate.mockResolvedValueOnce(createBatchResponse(200, 50));

      const { getEmbeddings } = await import('../embeddings');
      const result = await getEmbeddings(texts);

      expect(result).toHaveLength(totalTexts);
      expect(mockCreate).toHaveBeenCalledTimes(3);

      // Verify batch sizes
      expect(mockCreate.mock.calls[0][0].input).toHaveLength(batchSize);
      expect(mockCreate.mock.calls[1][0].input).toHaveLength(batchSize);
      expect(mockCreate.mock.calls[2][0].input).toHaveLength(50);
    });
  });
});
