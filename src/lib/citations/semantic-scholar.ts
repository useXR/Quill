// src/lib/citations/semantic-scholar.ts
import { createLogger } from '@/lib/logger';
import { CITATIONS } from '@/lib/constants/citations';
import type { Paper, SearchResult } from './types';
import { SemanticScholarError } from './types';

const citationLogger = createLogger({ module: 'semantic-scholar' });

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

// Rate limiting state
let requestCount = 0;
let windowStart = Date.now();

// Cache for search results
const searchCache = new Map<string, { papers: Paper[]; timestamp: number }>();

/**
 * Check client-side rate limit before making a request
 */
function checkRateLimit(): void {
  const now = Date.now();

  // Reset window if expired
  if (now - windowStart > CITATIONS.RATE_LIMIT_WINDOW_MS) {
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= CITATIONS.RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((windowStart + CITATIONS.RATE_LIMIT_WINDOW_MS - now) / 1000);
    throw new SemanticScholarError(
      'RATE_LIMITED',
      `Client rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter
    );
  }

  requestCount++;
}

/**
 * Reset rate limit state (for testing)
 */
export function resetRateLimitState(): void {
  requestCount = 0;
  windowStart = Date.now();
}

/**
 * Handle API response errors
 */
function handleResponseError(response: Response): never {
  const status = response.status;

  if (status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    throw new SemanticScholarError('RATE_LIMITED', 'Semantic Scholar API rate limit exceeded', retryAfter);
  }

  if (status === 404) {
    throw new SemanticScholarError('NOT_FOUND', 'Resource not found');
  }

  if (status === 400) {
    throw new SemanticScholarError('BAD_REQUEST', 'Invalid request parameters');
  }

  if (status >= 500) {
    throw new SemanticScholarError('SERVICE_ERROR', `Service error: ${status}`);
  }

  throw new SemanticScholarError('SERVICE_ERROR', `Unexpected error: ${status}`);
}

/**
 * Search for papers using the Semantic Scholar API
 */
export async function searchPapers(query: string, options: SearchOptions = {}): Promise<Paper[]> {
  checkRateLimit();

  const { limit = CITATIONS.DEFAULT_SEARCH_LIMIT, offset = 0 } = options;

  const params = new URLSearchParams({
    query: query,
    limit: String(limit),
    offset: String(offset),
    fields: CITATIONS.SEMANTIC_SCHOLAR_FIELDS,
  });

  const url = `${CITATIONS.SEMANTIC_SCHOLAR_API_BASE}/paper/search?${params.toString()}`;

  citationLogger.info({ query, limit, offset }, 'Searching for papers');

  try {
    const response = await fetch(url);

    if (!response.ok) {
      citationLogger.error({ status: response.status }, 'Search request failed');
      handleResponseError(response);
    }

    const data: SearchResult = await response.json();

    citationLogger.info({ total: data.total, returned: data.data.length }, 'Search completed');

    return data.data;
  } catch (error) {
    if (error instanceof SemanticScholarError) {
      throw error;
    }
    citationLogger.error({ error }, 'Network error during search');
    throw new SemanticScholarError('NETWORK_ERROR', 'Failed to connect to Semantic Scholar');
  }
}

/**
 * Search for papers with caching
 */
export async function searchPapersWithCache(query: string, limit?: number): Promise<Paper[]> {
  const cacheKey = `${query}:${limit ?? CITATIONS.DEFAULT_SEARCH_LIMIT}`;
  const cached = searchCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CITATIONS.CACHE_TTL_MS) {
    citationLogger.info({ query, cached: true }, 'Returning cached search results');
    return cached.papers;
  }

  const papers = await searchPapers(query, { limit });
  searchCache.set(cacheKey, { papers, timestamp: Date.now() });

  return papers;
}

/**
 * Clear the search cache
 */
export function clearCache(): void {
  searchCache.clear();
  citationLogger.info('Search cache cleared');
}

/**
 * Get a single paper by ID
 */
export async function getPaper(paperId: string): Promise<Paper> {
  checkRateLimit();

  const url = `${CITATIONS.SEMANTIC_SCHOLAR_API_BASE}/paper/${encodeURIComponent(paperId)}?fields=${CITATIONS.SEMANTIC_SCHOLAR_FIELDS}`;

  citationLogger.info({ paperId }, 'Fetching paper details');

  try {
    const response = await fetch(url);

    if (!response.ok) {
      citationLogger.error({ paperId, status: response.status }, 'Paper fetch failed');
      handleResponseError(response);
    }

    const paper: Paper = await response.json();

    citationLogger.info({ paperId, title: paper.title }, 'Paper fetched successfully');

    return paper;
  } catch (error) {
    if (error instanceof SemanticScholarError) {
      throw error;
    }
    citationLogger.error({ paperId, error }, 'Network error fetching paper');
    throw new SemanticScholarError('NETWORK_ERROR', 'Failed to connect to Semantic Scholar');
  }
}
