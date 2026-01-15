// src/lib/citations/semantic-scholar.ts
import { createLogger } from '@/lib/logger';
import { CITATIONS } from '@/lib/constants/citations';
import type { Paper, SearchResult } from './types';

const citationLogger = createLogger({ module: 'semantic-scholar' });

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

/**
 * Search for papers using the Semantic Scholar API
 */
export async function searchPapers(query: string, options: SearchOptions = {}): Promise<Paper[]> {
  const { limit = CITATIONS.DEFAULT_SEARCH_LIMIT, offset = 0 } = options;

  const params = new URLSearchParams({
    query: query,
    limit: String(limit),
    offset: String(offset),
    fields: CITATIONS.SEMANTIC_SCHOLAR_FIELDS,
  });

  const url = `${CITATIONS.SEMANTIC_SCHOLAR_API_BASE}/paper/search?${params.toString()}`;

  citationLogger.info({ query, limit, offset }, 'Searching for papers');

  const response = await fetch(url);

  if (!response.ok) {
    citationLogger.error({ status: response.status }, 'Search request failed');
    throw new Error(`Search failed with status ${response.status}`);
  }

  const data: SearchResult = await response.json();

  citationLogger.info({ total: data.total, returned: data.data.length }, 'Search completed');

  return data.data;
}
