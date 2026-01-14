import OpenAI from 'openai';
import { EMBEDDING_CONFIG } from '@/lib/vault/constants';
import { vaultLogger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const logger = vaultLogger({});

/**
 * Maximum character length for text input.
 * Based on maxTokensPerChunk * 4 (rough char-to-token ratio).
 */
const MAX_TEXT_LENGTH = EMBEDDING_CONFIG.maxTokensPerChunk * 4;

/**
 * Maximum number of retries for rate-limited requests.
 */
const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * Truncates text if it exceeds the maximum allowed length.
 */
function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }
  logger.warn({ originalLength: text.length, maxLength: MAX_TEXT_LENGTH }, 'Truncating text that exceeds max length');
  return text.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Delays execution for a specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches embeddings from OpenAI with retry logic for rate limiting.
 */
async function fetchEmbeddingsWithRetry(
  input: string | string[],
  retryCount = 0
): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
  try {
    return await openai.embeddings.create({
      model: EMBEDDING_CONFIG.model,
      input,
    });
  } catch (error) {
    // Handle rate limiting (429 errors)
    if (error instanceof OpenAI.APIError && error.status === 429 && retryCount < MAX_RATE_LIMIT_RETRIES) {
      const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
      logger.warn({ retryCount, backoffMs }, 'Rate limited by OpenAI, retrying with exponential backoff');
      await delay(backoffMs);
      return fetchEmbeddingsWithRetry(input, retryCount + 1);
    }

    logger.error({ error, retryCount }, 'Failed to fetch embeddings from OpenAI');
    throw error;
  }
}

/**
 * Gets an embedding for a single text string.
 *
 * @param text - The text to embed
 * @returns A 1536-dimension embedding vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const truncatedText = truncateText(text);
  const response = await fetchEmbeddingsWithRetry(truncatedText);

  return response.data[0].embedding;
}

/**
 * Gets embeddings for multiple text strings with batching support.
 *
 * @param texts - Array of texts to embed
 * @returns Array of 1536-dimension embedding vectors in the same order as input
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const truncatedTexts = texts.map(truncateText);
  const embeddings: number[][] = [];
  const batchSize = EMBEDDING_CONFIG.batchSize;

  // Process in batches
  for (let i = 0; i < truncatedTexts.length; i += batchSize) {
    const batch = truncatedTexts.slice(i, i + batchSize);
    const response = await fetchEmbeddingsWithRetry(batch);

    // Sort response by index to ensure correct order
    const sortedData = [...response.data].sort((a, b) => a.index - b.index);

    // Extract embeddings in sorted order
    for (const item of sortedData) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}
