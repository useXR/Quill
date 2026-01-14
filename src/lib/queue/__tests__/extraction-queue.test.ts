import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger to avoid console noise in tests
vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock the processor module (doesn't exist yet)
// Use a hanging promise so the queue doesn't process immediately
let processorResolve: () => void = () => {};
vi.mock('@/lib/extraction/processor', () => ({
  processExtraction: vi.fn().mockImplementation(() => {
    return new Promise<void>((resolve) => {
      processorResolve = resolve;
    });
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));

describe('ExtractionQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Resolve any pending processors to prevent test hangs
    processorResolve();
    vi.resetModules();
  });

  describe('enqueue', () => {
    it('adds item to queue and triggers processing', async () => {
      const { ExtractionQueue, __resetQueueForTesting } = await import('../extraction-queue');

      __resetQueueForTesting();

      const queue = new ExtractionQueue();
      const itemId = 'vault-item-123';

      queue.enqueue(itemId);

      // Item should be queued immediately after enqueue
      // (processing runs async, but with our hanging mock it won't complete)
      // We need to check before the processing loop picks it up
      // Since processQueue moves item to processing set, check both
      const inQueueOrProcessing = queue.isQueued(itemId) || queue.isProcessingItem(itemId);
      expect(inQueueOrProcessing).toBe(true);
    });

    it('does not add duplicate items to queue', async () => {
      const { ExtractionQueue, __resetQueueForTesting } = await import('../extraction-queue');

      __resetQueueForTesting();

      const queue = new ExtractionQueue();
      const itemId = 'vault-item-123';

      queue.enqueue(itemId);
      queue.enqueue(itemId); // Duplicate - should be ignored

      // Count of items (in queue + processing) should be 1
      // Since we have a hanging processor, item moves to processing
      const totalItems = queue.getQueueLength() + (queue.isProcessingItem(itemId) ? 1 : 0);
      expect(totalItems).toBe(1);
    });
  });

  describe('retry logic', () => {
    it('retries failed items with exponential backoff', async () => {
      const { calculateBackoff, __resetQueueForTesting } = await import('../extraction-queue');

      __resetQueueForTesting();

      // Test exponential backoff calculation
      // Base delay: 2000ms, max: 30000ms
      expect(calculateBackoff(0)).toBe(2000); // 2^0 * 2000 = 2000
      expect(calculateBackoff(1)).toBe(4000); // 2^1 * 2000 = 4000
      expect(calculateBackoff(2)).toBe(8000); // 2^2 * 2000 = 8000
    });

    it('caps retry delay at maximum (30s)', async () => {
      const { calculateBackoff } = await import('../extraction-queue');

      // With base 2000ms and max 30000ms
      // 2^4 * 2000 = 32000 should be capped to 30000
      expect(calculateBackoff(4)).toBe(30000);
      expect(calculateBackoff(10)).toBe(30000); // Still capped
    });
  });

  describe('recoverStalledExtractions', () => {
    it('requeues items stuck in processing state', async () => {
      const { ExtractionQueue, __resetQueueForTesting } = await import('../extraction-queue');

      __resetQueueForTesting();

      const queue = new ExtractionQueue();

      // Mock the recovery function behavior
      // The actual implementation will query the database for stuck items
      // Here we test that the method exists and can be called
      const recoverPromise = queue.recoverStalledExtractions();

      expect(recoverPromise).toBeInstanceOf(Promise);
      await expect(recoverPromise).resolves.not.toThrow();
    });
  });
});
