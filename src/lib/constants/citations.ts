// src/lib/constants/citations.ts
export const CITATIONS = {
  // API settings
  SEMANTIC_SCHOLAR_API_BASE: 'https://api.semanticscholar.org/graph/v1',
  SEMANTIC_SCHOLAR_FIELDS:
    'paperId,title,authors,year,publicationDate,journal,venue,externalIds,abstract,url,citationCount,influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy',

  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_WINDOW_MS: 5 * 60 * 1000, // 5 minutes

  // Caching
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

  // Search
  DEFAULT_SEARCH_LIMIT: 10,
  MAX_SEARCH_LIMIT: 100,

  // Retention
  SOFT_DELETE_GRACE_PERIOD_DAYS: 30,
} as const;
