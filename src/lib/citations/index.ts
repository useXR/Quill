// src/lib/citations/index.ts
export type { Paper, Author, SearchResult } from './types';
export { SemanticScholarError } from './types';
export {
  paperSchema,
  authorSchema,
  searchResultSchema,
  createCitationRequestSchema,
  updateCitationRequestSchema,
  searchQuerySchema,
} from './schemas';
export { searchPapers, searchPapersWithCache, getPaper, clearCache, resetRateLimitState } from './semantic-scholar';
export { citationLogger } from './logger';
