# Task 5.1: Citation Types

> **Phase 5** | [← Overview](./00-overview.md) | [Next: Semantic Scholar Client →](./02-semantic-scholar-client.md)

---

## Context

**This task defines the core TypeScript types for citations and papers.** These types form the foundation for the entire citation system.

### Design System Context

These types directly influence UI rendering in citation components:

| Field             | UI Display      | Design Token                                     |
| ----------------- | --------------- | ------------------------------------------------ |
| `title`           | Card heading    | `font-display text-lg text-ink-primary`          |
| `authors`         | Metadata line   | `font-ui text-sm text-ink-secondary`             |
| `year`, `journal` | Inline metadata | `font-ui text-xs text-ink-tertiary`              |
| `externalIds.DOI` | Verified badge  | `bg-success-light text-success rounded-md`       |
| `citationCount`   | Badge           | `bg-bg-secondary text-ink-secondary rounded-md`  |
| `isOpenAccess`    | Badge           | `bg-info-light text-info rounded-md`             |
| `abstract`        | Truncated text  | `font-ui text-xs text-ink-tertiary line-clamp-2` |

### Prerequisites

- **Phase 0-4** completed (auth, editor, vault, AI integration, chat)

### What This Task Creates

- `src/lib/citations/types.ts` with Paper, Author, and SearchResult interfaces
- `src/lib/citations/schemas.ts` with Zod validation schemas
- `src/lib/citations/index.ts` barrel export
- `src/lib/constants/citations.ts` with citation-related constants

### Tasks That Depend on This

- **Tasks 5.2-5.12** (Semantic Scholar Client) - uses Paper and SearchResult types
- **Tasks 5.13-5.14** (TipTap Extension) - uses citation attributes
- **Tasks 5.15-5.16** (Database Migration) - schema matches type structure
- **All subsequent tasks** - build on these foundational types

---

## Files to Create

- `src/lib/citations/types.ts` (create)
- `src/lib/citations/schemas.ts` (create)
- `src/lib/citations/index.ts` (create)
- `src/lib/constants/citations.ts` (create)

---

## Steps

### Step 1: Create types file with Paper interface

Create `src/lib/citations/types.ts`:

```typescript
// src/lib/citations/types.ts
export interface Author {
  name: string;
  authorId?: string;
}

export interface Paper {
  paperId: string;
  title: string;
  authors: Author[];
  year: number;
  publicationDate?: string;
  journal?: {
    name: string;
    volume?: string;
    pages?: string;
  };
  venue?: string;
  externalIds?: {
    DOI?: string;
    PubMed?: string;
    ArXiv?: string;
    CorpusId?: number;
  };
  abstract?: string;
  url: string;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: { url: string };
  fieldsOfStudy?: string[];
}

export type SearchResult = {
  total: number;
  offset: number;
  data: Paper[];
};
```

**Note:** `SemanticScholarError` will be added in Task 5.4 when tests demand it (TDD discipline).

### Step 2: Create Zod validation schemas

Create `src/lib/citations/schemas.ts`:

```typescript
// src/lib/citations/schemas.ts
import { z } from 'zod';

export const authorSchema = z.object({
  name: z.string().min(1),
  authorId: z.string().optional(),
});

export const paperSchema = z.object({
  paperId: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(authorSchema).min(1),
  year: z.number().int().min(1900).max(2100),
  publicationDate: z.string().optional(),
  journal: z
    .object({
      name: z.string(),
      volume: z.string().optional(),
      pages: z.string().optional(),
    })
    .optional(),
  venue: z.string().optional(),
  externalIds: z
    .object({
      DOI: z.string().optional(),
      PubMed: z.string().optional(),
      ArXiv: z.string().optional(),
      CorpusId: z.number().optional(),
    })
    .optional(),
  abstract: z.string().optional(),
  url: z.string().url(),
  citationCount: z.number().int().nonnegative().optional(),
  influentialCitationCount: z.number().int().nonnegative().optional(),
  isOpenAccess: z.boolean().optional(),
  openAccessPdf: z.object({ url: z.string().url() }).optional(),
  fieldsOfStudy: z.array(z.string()).optional(),
});

export const searchResultSchema = z.object({
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  data: z.array(paperSchema),
});

export const createCitationRequestSchema = z
  .object({
    projectId: z.string().uuid(),
    paper: paperSchema.optional(),
    // Manual citation fields (used when paper is not provided)
    title: z.string().min(1).optional(),
    authors: z.string().optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    journal: z.string().optional(),
    doi: z.string().optional(),
    url: z.string().url().optional(),
    abstract: z.string().optional(),
  })
  .refine((data) => data.paper || data.title, { message: 'Either paper or title is required' });

export const updateCitationRequestSchema = z.object({
  title: z.string().min(1).optional(),
  authors: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  journal: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  abstract: z.string().optional(),
  notes: z.string().optional(),
  verified: z.boolean().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

### Step 3: Create constants file

Create `src/lib/constants/citations.ts`:

```typescript
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
```

### Step 4: Create barrel export

Create `src/lib/citations/index.ts`:

```typescript
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
```

**Note:** Additional exports will be added as modules are created (semantic-scholar, formatter).

### Step 5: Commit

```bash
git add src/lib/citations/ src/lib/constants/citations.ts
git commit -m "feat(citations): add Paper types, Zod schemas, and constants"
```

---

## Verification Checklist

- [ ] `src/lib/citations/types.ts` exists
- [ ] Paper interface includes all required fields
- [ ] SearchResult type defined
- [ ] `src/lib/citations/schemas.ts` exists with Zod schemas
- [ ] `src/lib/citations/index.ts` barrel export exists
- [ ] `src/lib/constants/citations.ts` exists with constants
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 5.2-5.12: Semantic Scholar Client](./02-semantic-scholar-client.md)**.

**Parallel options:** Tasks 5.13-5.14 (TipTap) and 5.15-5.16 (Database) can also start now.
