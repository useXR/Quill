import { vaultLogger } from '@/lib/logger';
import { EXTRACTION_CONFIG } from '@/lib/vault/constants';

const log = vaultLogger({});

/**
 * Queue item representing a vault item pending extraction.
 */
interface QueueItem {
  vaultItemId: string;
  retryCount: number;
  enqueuedAt: Date;
  nextAttemptAt: Date;
}

/**
 * Calculates exponential backoff delay with cap.
 * Formula: min(baseDelay * 2^retryCount, maxDelay)
 */
export function calculateBackoff(retryCount: number): number {
  const { retryDelayMs, maxRetryDelayMs } = EXTRACTION_CONFIG;
  const delay = retryDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, maxRetryDelayMs);
}

/**
 * In-memory extraction queue with retry logic.
 * Suitable for single-instance deployment.
 */
export class ExtractionQueue {
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();
  private isProcessing = false;

  /**
   * Adds an item to the extraction queue.
   * Duplicate items are ignored.
   */
  enqueue(vaultItemId: string, retryCount = 0): void {
    if (this.queue.has(vaultItemId) || this.processing.has(vaultItemId)) {
      log.debug({ vaultItemId }, 'Item already in queue or processing, skipping');
      return;
    }

    const now = new Date();
    const nextAttemptAt = retryCount > 0 ? new Date(now.getTime() + calculateBackoff(retryCount)) : now;

    this.queue.set(vaultItemId, {
      vaultItemId,
      retryCount,
      enqueuedAt: now,
      nextAttemptAt,
    });

    log.info({ vaultItemId, retryCount, queueLength: this.queue.size }, 'Item enqueued for extraction');

    // Start processing if not already running
    void this.processQueue();
  }

  /**
   * Returns the current queue length.
   */
  getQueueLength(): number {
    return this.queue.size;
  }

  /**
   * Checks if an item is currently queued.
   */
  isQueued(vaultItemId: string): boolean {
    return this.queue.has(vaultItemId);
  }

  /**
   * Checks if an item is currently being processed.
   */
  isProcessingItem(vaultItemId: string): boolean {
    return this.processing.has(vaultItemId);
  }

  /**
   * Processes items in the queue.
   * Uses dynamic import to avoid circular dependencies with processor.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.size > 0) {
        const now = new Date();
        let nextItem: QueueItem | null = null;

        // Find next item ready to process
        for (const item of this.queue.values()) {
          if (item.nextAttemptAt <= now) {
            if (!nextItem || item.nextAttemptAt < nextItem.nextAttemptAt) {
              nextItem = item;
            }
          }
        }

        if (!nextItem) {
          // No items ready, wait for the earliest one
          const minWait = Math.min(
            ...Array.from(this.queue.values()).map((item) => item.nextAttemptAt.getTime() - now.getTime())
          );
          if (minWait > 0) {
            await new Promise((resolve) => setTimeout(resolve, minWait));
          }
          continue;
        }

        const { vaultItemId, retryCount } = nextItem;

        // Move to processing
        this.queue.delete(vaultItemId);
        this.processing.add(vaultItemId);

        log.info({ vaultItemId, retryCount }, 'Processing extraction');

        try {
          // Dynamic import to avoid circular dependencies
          const { processExtraction } = await import('@/lib/extraction/processor');
          await processExtraction(vaultItemId);

          log.info({ vaultItemId }, 'Extraction completed successfully');
        } catch (error) {
          log.error({ vaultItemId, error, retryCount }, 'Extraction failed');

          if (retryCount < EXTRACTION_CONFIG.maxRetries - 1) {
            // Re-enqueue with incremented retry count
            this.processing.delete(vaultItemId);
            this.enqueue(vaultItemId, retryCount + 1);
          } else {
            log.error({ vaultItemId, retryCount }, 'Max retries exceeded, marking as failed');
            // The processor should have already marked it as failed
          }
        } finally {
          this.processing.delete(vaultItemId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Recovers items stuck in processing state (e.g., after server restart).
   * Queries database for items with 'pending', 'downloading', 'extracting',
   * 'chunking', or 'embedding' status and requeues them.
   */
  async recoverStalledExtractions(): Promise<void> {
    log.info({}, 'Checking for stalled extractions');

    try {
      // Dynamic import to avoid circular dependencies
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('vault_items')
        .select('id')
        .in('extraction_status', ['pending', 'downloading', 'extracting', 'chunking', 'embedding'])
        .is('deleted_at', null);

      if (error) {
        log.error({ error }, 'Failed to query stalled extractions');
        return;
      }

      if (data && data.length > 0) {
        log.info({ count: data.length }, 'Found stalled extractions, requeuing');
        for (const item of data) {
          this.enqueue(item.id);
        }
      } else {
        log.info({}, 'No stalled extractions found');
      }
    } catch (error) {
      log.error({ error }, 'Error recovering stalled extractions');
    }
  }
}

// Singleton instance for the application
let queueInstance: ExtractionQueue | null = null;

/**
 * Gets the singleton queue instance.
 */
export function getExtractionQueue(): ExtractionQueue {
  if (!queueInstance) {
    queueInstance = new ExtractionQueue();
  }
  return queueInstance;
}

/**
 * Resets the queue for testing purposes.
 * Only use in tests.
 */
export function __resetQueueForTesting(): void {
  queueInstance = null;
}
