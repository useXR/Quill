# Phase 5: Citations & Research - Detailed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Semantic Scholar integration, citation management, and editor citation insertion with comprehensive test coverage.

**Synthesized from:** Technical implementation review + Testing strategy review of original Phase 5 plan.

---

## Overview

Phase 5 adds citation capabilities to Quill:

- Semantic Scholar API integration for paper search
- Citation CRUD with duplicate detection
- TipTap editor extension for inline citations
- Chat sidebar research mode integration
- Citation formatting and reference list generation

**Prerequisites:** Phase 0-4 complete (auth, editor, vault, AI integration, chat)

---

## Task 5.1: Semantic Scholar Client with Production-Ready Features

**Files:**

- Create: `src/lib/citations/semantic-scholar.ts`
- Create: `src/lib/citations/types.ts`
- Create: `src/lib/citations/__tests__/semantic-scholar.test.ts`
- Create: `src/lib/citations/__tests__/fixtures/semantic-scholar-responses.ts`

### Step 1: Define Expanded Paper Interface

Create `src/lib/citations/types.ts`:

```typescript
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

export class SemanticScholarError extends Error {
  constructor(
    public code: 'RATE_LIMITED' | 'NOT_FOUND' | 'BAD_REQUEST' | 'SERVICE_ERROR' | 'NETWORK_ERROR',
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'SemanticScholarError';
  }
}
```

### Step 2: Create Mock Fixtures for Testing

Create `src/lib/citations/__tests__/fixtures/semantic-scholar-responses.ts`:

```typescript
import type { SearchResult, Paper } from '../../types';

export const mockSuccessfulSearchResponse: SearchResult = {
  total: 150,
  offset: 0,
  data: [
    {
      paperId: 'abc123',
      title: 'Deep Learning in Healthcare',
      authors: [{ name: 'John Smith' }, { name: 'Jane Doe' }],
      year: 2023,
      journal: { name: 'Nature Medicine' },
      externalIds: { DOI: '10.1038/example' },
      abstract: 'This paper explores deep learning applications in healthcare diagnostics...',
      url: 'https://semanticscholar.org/paper/abc123',
      citationCount: 245,
      isOpenAccess: true,
    },
    {
      paperId: 'def456',
      title: 'Machine Learning for Drug Discovery',
      authors: [{ name: 'Alice Chen' }],
      year: 2022,
      venue: 'NeurIPS',
      externalIds: { DOI: '10.1000/def456', ArXiv: '2203.12345' },
      abstract: 'We present a novel approach to drug discovery using machine learning...',
      url: 'https://semanticscholar.org/paper/def456',
      citationCount: 89,
    },
  ],
};

export const mockEmptySearchResponse: SearchResult = {
  total: 0,
  offset: 0,
  data: [],
};

export const mockMalformedResponse = {
  data: [
    {
      paperId: 'xyz789',
      title: null,
      authors: 'not-an-array',
      year: '2023',
    },
  ],
};

export const mockPartialFieldsResponse: SearchResult = {
  total: 1,
  offset: 0,
  data: [
    {
      paperId: 'partial123',
      title: 'Paper Without DOI',
      authors: [],
      year: 2022,
      url: 'https://semanticscholar.org/paper/partial123',
    },
  ],
};

export const mockPaperDetail: Paper = {
  paperId: 'abc123',
  title: 'Deep Learning in Healthcare',
  authors: [
    { name: 'John Smith', authorId: 'auth1' },
    { name: 'Jane Doe', authorId: 'auth2' },
  ],
  year: 2023,
  publicationDate: '2023-03-15',
  journal: { name: 'Nature Medicine', volume: '29', pages: '1-15' },
  externalIds: { DOI: '10.1038/example', PubMed: '12345678' },
  abstract: 'Full abstract text here...',
  url: 'https://semanticscholar.org/paper/abc123',
  citationCount: 245,
  influentialCitationCount: 12,
  isOpenAccess: true,
  openAccessPdf: { url: 'https://example.com/paper.pdf' },
  fieldsOfStudy: ['Computer Science', 'Medicine'],
};
```

### Step 3: Write Tests (TDD Approach)

Create `src/lib/citations/__tests__/semantic-scholar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPapers, getPaper, searchPapersWithCache } from '../semantic-scholar';
import { SemanticScholarError } from '../types';
import * as fixtures from './fixtures/semantic-scholar-responses';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Semantic Scholar Client', () => {
  describe('searchPapers', () => {
    it('should return papers for a valid search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fixtures.mockSuccessfulSearchResponse,
      });

      const results = await searchPapers('deep learning healthcare');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.semanticscholar.org/graph/v1/paper/search'),
        expect.any(Object)
      );
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Deep Learning in Healthcare');
      expect(results[0].externalIds?.DOI).toBe('10.1038/example');
    });

    it('should respect the limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fixtures.mockSuccessfulSearchResponse,
      });

      await searchPapers('test', 5);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'), expect.any(Object));
    });

    it('should return empty array when no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fixtures.mockEmptySearchResponse,
      });

      const results = await searchPapers('nonexistent query xyz123');

      expect(results).toEqual([]);
    });

    it('should handle papers with missing optional fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fixtures.mockPartialFieldsResponse,
      });

      const results = await searchPapers('partial');

      expect(results[0].authors).toEqual([]);
      expect(results[0].externalIds?.DOI).toBeUndefined();
    });

    it('should throw SemanticScholarError on rate limit (429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '60' }),
      });

      await expect(searchPapers('test')).rejects.toThrow(SemanticScholarError);
      await expect(searchPapers('test')).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        retryAfter: 60,
      });
    });

    it('should throw SemanticScholarError on server error (500)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(searchPapers('test')).rejects.toThrow(SemanticScholarError);
      await expect(searchPapers('test')).rejects.toMatchObject({
        code: 'SERVICE_ERROR',
      });
    });

    it('should throw SemanticScholarError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(searchPapers('test')).rejects.toThrow(SemanticScholarError);
      await expect(searchPapers('test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should URL-encode query parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fixtures.mockEmptySearchResponse,
      });

      await searchPapers('machine learning & AI');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('machine%20learning%20%26%20AI'),
        expect.any(Object)
      );
    });
  });

  describe('getPaper', () => {
    it('should return paper details for valid paperId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fixtures.mockPaperDetail,
      });

      const paper = await getPaper('abc123');

      expect(paper).not.toBeNull();
      expect(paper?.title).toBe('Deep Learning in Healthcare');
      expect(paper?.fieldsOfStudy).toContain('Medicine');
    });

    it('should return null for non-existent paperId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const paper = await getPaper('nonexistent');

      expect(paper).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache search results for 5 minutes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => fixtures.mockSuccessfulSearchResponse,
      });

      await searchPapersWithCache('cached query');
      await searchPapersWithCache('cached query');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should make new request for different queries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => fixtures.mockSuccessfulSearchResponse,
      });

      await searchPapersWithCache('query one');
      await searchPapersWithCache('query two');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

### Step 4: Implement Semantic Scholar Client

Create `src/lib/citations/semantic-scholar.ts`:

```typescript
import { Paper, SearchResult, SemanticScholarError } from './types';

const API_BASE = 'https://api.semanticscholar.org/graph/v1';
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;
const FIELDS =
  'paperId,title,authors,year,publicationDate,journal,venue,externalIds,abstract,url,citationCount,influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy';

// Rate limiting state
const requestQueue: number[] = [];
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache
const searchCache = new Map<string, { data: Paper[]; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  // Remove old requests from queue
  while (requestQueue.length > 0 && requestQueue[0] < now - RATE_WINDOW_MS) {
    requestQueue.shift();
  }

  if (requestQueue.length >= RATE_LIMIT) {
    const waitTime = requestQueue[0] + RATE_WINDOW_MS - now;
    throw new SemanticScholarError(
      'RATE_LIMITED',
      `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
      Math.ceil(waitTime / 1000)
    );
  }

  requestQueue.push(now);
}

async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await checkRateLimit();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'x-api-key': API_KEY }),
      };

      const response = await fetch(url, { ...options, headers });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        throw new SemanticScholarError(
          'RATE_LIMITED',
          `Rate limited by Semantic Scholar. Retry after ${retryAfter} seconds.`,
          retryAfter
        );
      }

      if (response.status === 404) {
        throw new SemanticScholarError('NOT_FOUND', 'Resource not found');
      }

      if (response.status === 400) {
        throw new SemanticScholarError('BAD_REQUEST', 'Invalid request');
      }

      if (!response.ok) {
        throw new SemanticScholarError('SERVICE_ERROR', `Semantic Scholar API error: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof SemanticScholarError) {
        if (error.code === 'RATE_LIMITED' || error.code === 'NOT_FOUND') {
          throw error;
        }
      }

      // Exponential backoff for retryable errors
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new SemanticScholarError('NETWORK_ERROR', lastError?.message || 'Network request failed');
}

export async function searchPapers(query: string, limit = 10): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: FIELDS,
  });

  const response = await fetchWithRetry(`${API_BASE}/paper/search?${params}`);
  const data: SearchResult = await response.json();

  return data.data || [];
}

export async function searchPapersWithCache(query: string, limit = 10): Promise<Paper[]> {
  const cacheKey = `${query}:${limit}`;
  const cached = searchCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const papers = await searchPapers(query, limit);
  searchCache.set(cacheKey, {
    data: papers,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return papers;
}

export async function getPaper(paperId: string): Promise<Paper | null> {
  try {
    const params = new URLSearchParams({ fields: FIELDS });
    const response = await fetchWithRetry(`${API_BASE}/paper/${paperId}?${params}`);
    return await response.json();
  } catch (error) {
    if (error instanceof SemanticScholarError && error.code === 'NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

export function clearCache(): void {
  searchCache.clear();
}
```

### Step 5: Run Tests

```bash
npm test src/lib/citations/__tests__/semantic-scholar.test.ts
```

Expected: All tests pass

### Step 6: Commit

```bash
git add .
git commit -m "feat: add Semantic Scholar client with rate limiting and caching"
```

---

## Task 5.2: TipTap Citation Extension

**Files:**

- Create: `src/components/editor/extensions/citation.ts`
- Create: `src/components/editor/extensions/__tests__/citation.test.ts`

### Step 1: Create TipTap Citation Mark Extension

Create `src/components/editor/extensions/citation.ts`:

```typescript
import { Mark, mergeAttributes } from '@tiptap/core';

export interface CitationAttributes {
  citationId: string;
  displayText: string;
  doi?: string;
  title?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      setCitation: (attributes: CitationAttributes) => ReturnType;
      unsetCitation: () => ReturnType;
    };
  }
}

export const Citation = Mark.create({
  name: 'citation',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-citation-id'),
        renderHTML: (attributes) => ({
          'data-citation-id': attributes.citationId,
        }),
      },
      displayText: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-display-text'),
        renderHTML: (attributes) => ({
          'data-display-text': attributes.displayText,
        }),
      },
      doi: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-doi'),
        renderHTML: (attributes) => {
          if (!attributes.doi) return {};
          return { 'data-doi': attributes.doi };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { 'data-title': attributes.title };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'cite[data-citation-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'cite',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'citation-mark cursor-pointer text-blue-600 hover:underline',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCitation:
        (attributes: CitationAttributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetCitation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default Citation;
```

### Step 2: Update Editor to Include Citation Extension

Modify `src/components/editor/Editor.tsx` to include Citation in extensions array:

```typescript
import { Citation } from './extensions/citation';

// In extensions array:
extensions: [
  StarterKit,
  Placeholder.configure({ placeholder }),
  CharacterCount,
  Citation,  // Add this
],
```

### Step 3: Commit

```bash
git add .
git commit -m "feat: add TipTap citation mark extension"
```

---

## Task 5.3: Database Schema Updates for Citations

**Files:**

- Create: `supabase/migrations/YYYYMMDD_citation_enhancements.sql`

### Step 1: Create Migration

```bash
npx supabase migration new citation_enhancements
```

### Step 2: Write Schema Enhancements

Edit the created migration file:

```sql
-- Add missing fields to citations table
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS paper_id text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS volume text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS pages text;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS publication_date date;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}';
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS citation_count integer;
ALTER TABLE public.citations ADD COLUMN IF NOT EXISTS notes text;

-- Create unique index for duplicate detection by paper_id
CREATE UNIQUE INDEX IF NOT EXISTS citations_paper_id_project_id_idx
  ON public.citations(paper_id, project_id)
  WHERE paper_id IS NOT NULL;

-- Create junction table for document-citation relationships
CREATE TABLE IF NOT EXISTS public.document_citations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  citation_id uuid REFERENCES public.citations(id) ON DELETE CASCADE NOT NULL,
  citation_number integer,
  position jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(document_id, citation_id)
);

ALTER TABLE public.document_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage document_citations in own projects"
  ON public.document_citations FOR ALL
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.projects p ON d.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Function to auto-number citations in a document
CREATE OR REPLACE FUNCTION public.get_next_citation_number(p_document_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(MAX(citation_number), 0) + 1
  FROM public.document_citations
  WHERE document_id = p_document_id;
$$ LANGUAGE sql STABLE;
```

### Step 3: Apply Migration

```bash
npx supabase db reset
```

### Step 4: Regenerate Types

```bash
npm run db:types
```

### Step 5: Commit

```bash
git add .
git commit -m "feat: enhance citations schema with paper_id and document relations"
```

---

## Task 5.4: Citations API with Duplicate Detection

**Files:**

- Create: `src/lib/api/citations.ts`
- Create: `src/lib/api/__tests__/citations.test.ts`
- Create: `src/lib/api/__tests__/fixtures/citation-fixtures.ts`
- Create: `src/app/api/citations/route.ts`
- Create: `src/app/api/citations/[id]/route.ts`
- Create: `src/app/api/citations/search/route.ts`

### Step 1: Create Test Fixtures

Create `src/lib/api/__tests__/fixtures/citation-fixtures.ts`:

```typescript
import type { Database } from '@/lib/supabase/database.types';

type CitationInsert = Database['public']['Tables']['citations']['Insert'];

export function createTestCitation(overrides: Partial<CitationInsert> = {}): CitationInsert {
  return {
    project_id: 'test-project-id',
    title: 'Test Citation',
    authors: 'Test Author',
    year: 2024,
    journal: 'Test Journal',
    doi: '10.1000/test',
    url: 'https://doi.org/10.1000/test',
    abstract: 'Test abstract content.',
    source: 'ai_fetched',
    verified: true,
    ...overrides,
  };
}

export const testCitations = {
  verified: createTestCitation({
    title: 'Verified Citation',
    verified: true,
    source: 'ai_fetched',
    paper_id: 'ss-abc123',
  }),

  unverified: createTestCitation({
    title: 'Unverified Citation',
    verified: false,
    source: 'user_added',
    doi: undefined,
    paper_id: undefined,
  }),

  minimal: {
    project_id: 'test-project-id',
    title: 'Minimal Citation',
    source: 'user_added' as const,
    verified: false,
  },
};

export function generateTestCitations(count: number, projectId: string): CitationInsert[] {
  return Array.from({ length: count }, (_, i) =>
    createTestCitation({
      project_id: projectId,
      title: `Test Citation ${i + 1}`,
      doi: `10.1000/test${i + 1}`,
      paper_id: `paper-${i + 1}`,
      year: 2020 + (i % 5),
    })
  );
}
```

### Step 2: Create Citations API Helpers

Create `src/lib/api/citations.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { Paper } from '@/lib/citations/types';

type Citation = Database['public']['Tables']['citations']['Row'];
type CitationInsert = Database['public']['Tables']['citations']['Insert'];
type CitationUpdate = Database['public']['Tables']['citations']['Update'];

export async function getCitations(projectId: string): Promise<Citation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('citations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCitation(id: string): Promise<Citation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('citations').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createCitation(citation: CitationInsert): Promise<Citation> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('citations').insert(citation).select().single();

  if (error) throw error;
  return data;
}

export async function createCitationFromPaper(projectId: string, paper: Paper): Promise<Citation> {
  const citation: CitationInsert = {
    project_id: projectId,
    paper_id: paper.paperId,
    title: paper.title,
    authors: paper.authors.map((a) => a.name).join(', '),
    year: paper.year,
    journal: paper.journal?.name,
    venue: paper.venue,
    volume: paper.journal?.volume,
    pages: paper.journal?.pages,
    doi: paper.externalIds?.DOI,
    url: paper.url,
    abstract: paper.abstract,
    publication_date: paper.publicationDate,
    external_ids: paper.externalIds,
    citation_count: paper.citationCount,
    source: 'ai_fetched',
    verified: !!paper.externalIds?.DOI,
  };

  return createCitation(citation);
}

export async function updateCitation(id: string, updates: CitationUpdate): Promise<Citation> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('citations').update(updates).eq('id', id).select().single();

  if (error) throw error;
  return data;
}

export async function deleteCitation(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('citations').delete().eq('id', id);

  if (error) throw error;
}

export async function isDuplicateCitation(
  projectId: string,
  paper: Paper
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const supabase = await createClient();

  // Check by paper_id first (Semantic Scholar ID)
  if (paper.paperId) {
    const { data: byPaperId } = await supabase
      .from('citations')
      .select('id')
      .eq('project_id', projectId)
      .eq('paper_id', paper.paperId)
      .single();

    if (byPaperId) {
      return { isDuplicate: true, existingId: byPaperId.id };
    }
  }

  // Check by DOI
  if (paper.externalIds?.DOI) {
    const { data: byDoi } = await supabase
      .from('citations')
      .select('id')
      .eq('project_id', projectId)
      .eq('doi', paper.externalIds.DOI)
      .single();

    if (byDoi) {
      return { isDuplicate: true, existingId: byDoi.id };
    }
  }

  return { isDuplicate: false };
}
```

### Step 3: Create API Routes

Create `src/app/api/citations/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getCitations, createCitation, createCitationFromPaper, isDuplicateCitation } from '@/lib/api/citations';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  try {
    const citations = await getCitations(projectId);
    return NextResponse.json(citations);
  } catch (error) {
    console.error('Error fetching citations:', error);
    return NextResponse.json({ error: 'Failed to fetch citations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, paper, ...manualCitation } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // If paper object provided, it's from Semantic Scholar
    if (paper) {
      // Check for duplicates
      const { isDuplicate, existingId } = await isDuplicateCitation(projectId, paper);
      if (isDuplicate) {
        return NextResponse.json({ error: 'Citation already exists', existingId }, { status: 409 });
      }

      const citation = await createCitationFromPaper(projectId, paper);
      return NextResponse.json(citation, { status: 201 });
    }

    // Manual citation
    const citation = await createCitation({
      project_id: projectId,
      ...manualCitation,
      source: 'user_added',
      verified: !!manualCitation.doi,
    });
    return NextResponse.json(citation, { status: 201 });
  } catch (error) {
    console.error('Error creating citation:', error);
    return NextResponse.json({ error: 'Failed to create citation' }, { status: 500 });
  }
}
```

Create `src/app/api/citations/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getCitation, updateCitation, deleteCitation } from '@/lib/api/citations';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const citation = await getCitation(params.id);
    if (!citation) {
      return NextResponse.json({ error: 'Citation not found' }, { status: 404 });
    }
    return NextResponse.json(citation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch citation' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const updates = await request.json();
    const citation = await updateCitation(params.id, updates);
    return NextResponse.json(citation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update citation' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCitation(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete citation' }, { status: 500 });
  }
}
```

Create `src/app/api/citations/search/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { searchPapersWithCache } from '@/lib/citations/semantic-scholar';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query) {
    return NextResponse.json({ error: 'Query parameter q required' }, { status: 400 });
  }

  try {
    const papers = await searchPapersWithCache(query, limit);
    return NextResponse.json({ papers, total: papers.length });
  } catch (error: any) {
    if (error.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Rate limited', retryAfter: error.retryAfter }, { status: 429 });
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

### Step 4: Commit

```bash
git add .
git commit -m "feat: add citations API with duplicate detection"
```

---

## Task 5.5: Citation Search UI Components

**Files:**

- Create: `src/components/citations/CitationCard.tsx`
- Create: `src/components/citations/CitationSearch.tsx`
- Create: `src/components/citations/__tests__/CitationCard.test.tsx`
- Create: `src/components/citations/__tests__/CitationSearch.test.tsx`

### Step 1: Create CitationCard Component

Create `src/components/citations/CitationCard.tsx`:

```typescript
'use client';

import { ExternalLink, Plus, Check, AlertCircle } from 'lucide-react';
import type { Paper } from '@/lib/citations/types';

interface CitationCardProps {
  paper: Paper;
  onAdd: (paper: Paper) => void;
  isAdded?: boolean;
  isLoading?: boolean;
}

export function CitationCard({
  paper,
  onAdd,
  isAdded = false,
  isLoading = false,
}: CitationCardProps) {
  const authors = paper.authors.length > 0
    ? paper.authors.map((a) => a.name).join(', ')
    : 'Unknown author';

  const truncatedAuthors = authors.length > 100
    ? `${authors.slice(0, 100)}...`
    : authors;

  const truncatedAbstract = paper.abstract && paper.abstract.length > 200
    ? `${paper.abstract.slice(0, 200)}...`
    : paper.abstract;

  const hasDoi = !!paper.externalIds?.DOI;

  return (
    <article
      data-testid="citation-card"
      className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
      role="article"
      aria-label={`${paper.title} by ${paper.authors[0]?.name || 'Unknown'}, ${paper.year}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isAdded && !isLoading) {
          onAdd(paper);
        }
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 data-testid="citation-title" className="font-medium text-gray-900 line-clamp-2">
            {paper.title}
          </h3>

          <p className="text-sm text-gray-600 mt-1">{truncatedAuthors}</p>

          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <span>{paper.year}</span>
            {paper.journal?.name && (
              <>
                <span>•</span>
                <span>{paper.journal.name}</span>
              </>
            )}
            {paper.venue && !paper.journal?.name && (
              <>
                <span>•</span>
                <span>{paper.venue}</span>
              </>
            )}
            {paper.citationCount !== undefined && (
              <>
                <span>•</span>
                <span>{paper.citationCount} citations</span>
              </>
            )}
          </div>

          {truncatedAbstract && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-3">{truncatedAbstract}</p>
          )}

          <div className="flex items-center gap-3 mt-3">
            {hasDoi ? (
              <a
                href={`https://doi.org/${paper.externalIds!.DOI}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                aria-label={`DOI: ${paper.externalIds!.DOI}`}
              >
                <ExternalLink className="w-3 h-3" />
                DOI
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                <AlertCircle className="w-3 h-3" />
                No DOI
              </span>
            )}

            {hasDoi && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                <Check className="w-3 h-3" />
                Verified
              </span>
            )}

            {paper.isOpenAccess && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Open Access
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAdd(paper)}
          disabled={isAdded || isLoading}
          aria-label={isAdded ? 'Already added' : 'Add citation'}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            isAdded
              ? 'bg-green-100 text-green-600 cursor-not-allowed'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          } ${isLoading ? 'opacity-50' : ''}`}
        >
          {isAdded ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>
    </article>
  );
}
```

### Step 2: Create CitationSearch Component

Create `src/components/citations/CitationSearch.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { CitationCard } from './CitationCard';
import type { Paper } from '@/lib/citations/types';

interface CitationSearchProps {
  projectId: string;
  onAdd: (paper: Paper) => Promise<void>;
  addedPaperIds?: Set<string>;
}

export function CitationSearch({
  projectId,
  onAdd,
  addedPaperIds = new Set(),
}: CitationSearchProps) {
  const [query, setQuery] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingPaperId, setAddingPaperId] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/citations/search?q=${encodeURIComponent(query)}&limit=10`
      );

      if (response.status === 429) {
        const data = await response.json();
        setError(`Rate limited. Please try again in ${data.retryAfter} seconds.`);
        return;
      }

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setPapers(data.papers);
    } catch (err) {
      setError('Failed to search papers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleAdd = useCallback(async (paper: Paper) => {
    setAddingPaperId(paper.paperId);
    try {
      await onAdd(paper);
    } finally {
      setAddingPaperId(null);
    }
  }, [onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search papers (e.g., 'machine learning healthcare')"
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={isLoading || !query.trim()}
          aria-label="Search"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
        </button>
      </div>

      {isLoading && (
        <div role="status" className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Searching Semantic Scholar...</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={search}
            className="ml-auto text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && hasSearched && papers.length === 0 && (
        <p className="text-center py-8 text-gray-500">
          No papers found for "{query}". Try different keywords.
        </p>
      )}

      {!isLoading && papers.length > 0 && (
        <div data-testid="citation-results" className="space-y-3">
          <p className="text-sm text-gray-500">
            Found {papers.length} papers
          </p>
          {papers.map((paper) => (
            <CitationCard
              key={paper.paperId}
              paper={paper}
              onAdd={handleAdd}
              isAdded={addedPaperIds.has(paper.paperId)}
              isLoading={addingPaperId === paper.paperId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Write Component Tests

Create `src/components/citations/__tests__/CitationCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitationCard } from '../CitationCard';
import type { Paper } from '@/lib/citations/types';

const mockPaper: Paper = {
  paperId: 'abc123',
  title: 'Deep Learning for Healthcare',
  authors: [{ name: 'John Smith' }, { name: 'Jane Doe' }],
  year: 2023,
  journal: { name: 'Nature Medicine' },
  externalIds: { DOI: '10.1000/example' },
  abstract: 'This paper explores deep learning applications in healthcare.',
  url: 'https://example.com/paper',
  citationCount: 245,
  isOpenAccess: true,
};

describe('CitationCard', () => {
  const mockOnAdd = vi.fn();

  it('should display paper title', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText(mockPaper.title)).toBeInTheDocument();
  });

  it('should display formatted authors', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText(/John Smith, Jane Doe/)).toBeInTheDocument();
  });

  it('should display year and journal', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('Nature Medicine')).toBeInTheDocument();
  });

  it('should display DOI as clickable link', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    const doiLink = screen.getByRole('link', { name: /doi/i });
    expect(doiLink).toHaveAttribute('href', 'https://doi.org/10.1000/example');
    expect(doiLink).toHaveAttribute('target', '_blank');
  });

  it('should show Verified badge when DOI present', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('should call onAdd when add button clicked', async () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(mockOnAdd).toHaveBeenCalledWith(mockPaper);
  });

  it('should handle missing journal gracefully', () => {
    const paperWithoutJournal = { ...mockPaper, journal: undefined };
    render(<CitationCard paper={paperWithoutJournal} onAdd={mockOnAdd} />);
    expect(screen.queryByText('Nature Medicine')).not.toBeInTheDocument();
  });

  it('should show warning when DOI missing', () => {
    const paperWithoutDOI = { ...mockPaper, externalIds: {} };
    render(<CitationCard paper={paperWithoutDOI} onAdd={mockOnAdd} />);
    expect(screen.getByText('No DOI')).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('should disable button when already added', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} isAdded />);
    expect(screen.getByRole('button', { name: /already added/i })).toBeDisabled();
  });
});
```

### Step 4: Run Tests

```bash
npm test src/components/citations/__tests__/
```

### Step 5: Commit

```bash
git add .
git commit -m "feat: add citation search UI components"
```

---

## Task 5.6: Citation List and Management Page

**Files:**

- Create: `src/components/citations/CitationList.tsx`
- Create: `src/components/citations/CitationEditDialog.tsx`
- Create: `src/app/projects/[id]/citations/page.tsx`

### Step 1: Create CitationList Component

Create `src/components/citations/CitationList.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Edit2, Trash2, ExternalLink, Check, AlertCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';

type Citation = Database['public']['Tables']['citations']['Row'];

interface CitationListProps {
  citations: Citation[];
  onEdit: (citation: Citation) => void;
  onDelete: (id: string) => void;
}

export function CitationList({ citations, onEdit, onDelete }: CitationListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (citations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No citations yet.</p>
        <p className="text-sm mt-1">Search for papers or add citations manually.</p>
      </div>
    );
  }

  return (
    <ul role="list" aria-label="Citations" className="space-y-3">
      {citations.map((citation) => (
        <li key={citation.id}>
          <article
            className="border rounded-lg p-4 hover:border-gray-300 transition-colors focus-within:ring-2 focus-within:ring-blue-500"
            tabIndex={0}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{citation.title}</h3>

                {citation.authors && (
                  <p className="text-sm text-gray-600 mt-1">{citation.authors}</p>
                )}

                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  {citation.year && <span>{citation.year}</span>}
                  {citation.journal && (
                    <>
                      <span>•</span>
                      <span>{citation.journal}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-3">
                  {citation.doi ? (
                    <a
                      href={`https://doi.org/${citation.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      DOI
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      No DOI
                    </span>
                  )}

                  {citation.verified && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3" />
                      Verified
                    </span>
                  )}

                  <span className={`text-xs px-2 py-0.5 rounded ${
                    citation.source === 'ai_fetched'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {citation.source === 'ai_fetched' ? 'AI Fetched' : 'Manual'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(citation)}
                  aria-label="Edit citation"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {deleteConfirmId === citation.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(citation.id);
                        setDeleteConfirmId(null);
                      }}
                      aria-label="Confirm delete"
                      className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(citation.id)}
                    aria-label="Delete citation"
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
```

### Step 2: Create Citations Page

Create `src/app/projects/[id]/citations/page.tsx`:

```typescript
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCitations } from '@/lib/api/citations';
import { CitationList } from '@/components/citations/CitationList';
import { CitationSearch } from '@/components/citations/CitationSearch';

export default async function CitationsPage({
  params,
}: {
  params: { id: string };
}) {
  const projectId = params.id;
  const citations = await getCitations(projectId);
  const addedPaperIds = new Set(
    citations.filter((c) => c.paper_id).map((c) => c.paper_id!)
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Citations</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Search Papers</h2>
        <Suspense fallback={<div>Loading...</div>}>
          <CitationSearchWrapper
            projectId={projectId}
            addedPaperIds={addedPaperIds}
          />
        </Suspense>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Project Citations ({citations.length})
        </h2>
        <CitationListWrapper
          projectId={projectId}
          initialCitations={citations}
        />
      </div>
    </div>
  );
}

// Client wrappers needed for interactivity
'use client';

function CitationSearchWrapper({
  projectId,
  addedPaperIds,
}: {
  projectId: string;
  addedPaperIds: Set<string>;
}) {
  const handleAdd = async (paper: Paper) => {
    const response = await fetch('/api/citations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, paper }),
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 409) {
        // Already exists
        return;
      }
      throw new Error(data.error);
    }

    // Revalidate the page
    window.location.reload();
  };

  return (
    <CitationSearch
      projectId={projectId}
      onAdd={handleAdd}
      addedPaperIds={addedPaperIds}
    />
  );
}
```

### Step 3: Commit

```bash
git add .
git commit -m "feat: add citation list and management page"
```

---

## Task 5.7: Citation Insertion in Editor

**Files:**

- Create: `src/components/editor/CitationPicker.tsx`
- Modify: `src/components/editor/Editor.tsx`
- Modify: `src/components/editor/Toolbar.tsx`

### Step 1: Create CitationPicker Component

Create `src/components/editor/CitationPicker.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';

type Citation = Database['public']['Tables']['citations']['Row'];

interface CitationPickerProps {
  projectId: string;
  onSelect: (citation: Citation, displayText: string) => void;
  onClose: () => void;
}

export function CitationPicker({
  projectId,
  onSelect,
  onClose,
}: CitationPickerProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCitations() {
      const response = await fetch(`/api/citations?projectId=${projectId}`);
      const data = await response.json();
      setCitations(data);
      setIsLoading(false);
    }
    loadCitations();
  }, [projectId]);

  const filteredCitations = citations.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase()) ||
    c.authors?.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSelect = (citation: Citation, index: number) => {
    // For numbered style: [1], [2], etc.
    const displayText = `[${index + 1}]`;
    onSelect(citation, displayText);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Insert Citation</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter citations..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredCitations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {citations.length === 0
                ? 'No citations in project. Add some first.'
                : 'No matching citations.'}
            </div>
          ) : (
            <ul role="listbox" className="divide-y">
              {filteredCitations.map((citation, index) => (
                <li key={citation.id}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => handleSelect(citation, index)}
                    className="w-full text-left p-4 hover:bg-gray-50 focus:bg-blue-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-mono text-gray-500">
                        [{index + 1}]
                      </span>
                      <div>
                        <p className="font-medium text-sm">{citation.title}</p>
                        {citation.authors && (
                          <p className="text-sm text-gray-600 mt-0.5">
                            {citation.authors}
                          </p>
                        )}
                        {citation.year && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {citation.year}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Add Citation Button to Toolbar

Modify `src/components/editor/Toolbar.tsx` to add citation button:

```typescript
import { BookOpen } from 'lucide-react';

// Add to buttons array:
{
  icon: BookOpen,
  label: 'Insert Citation',
  action: () => onInsertCitation?.(),
  isActive: false,
},

// Add onInsertCitation to props interface
interface ToolbarProps {
  editor: Editor | null;
  onInsertCitation?: () => void;
}
```

### Step 3: Integrate Citation Picker with Editor

Modify `src/components/editor/Editor.tsx`:

```typescript
import { useState, useCallback } from 'react';
import { Citation } from './extensions/citation';
import { CitationPicker } from './CitationPicker';

// Add state for picker
const [showCitationPicker, setShowCitationPicker] = useState(false);

// Add citation insertion handler
const handleInsertCitation = useCallback(
  (citation: Citation, displayText: string) => {
    editor?.chain().focus().setCitation({
      citationId: citation.id,
      displayText,
      doi: citation.doi || undefined,
      title: citation.title,
    }).insertContent(displayText).run();

    setShowCitationPicker(false);
  },
  [editor]
);

// Add keyboard shortcut
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
      e.preventDefault();
      setShowCitationPicker(true);
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);

// Render picker when open
{showCitationPicker && (
  <CitationPicker
    projectId={projectId}
    onSelect={handleInsertCitation}
    onClose={() => setShowCitationPicker(false)}
  />
)}
```

### Step 4: Commit

```bash
git add .
git commit -m "feat: add citation insertion in editor with keyboard shortcut"
```

---

## Task 5.8: Citation Formatting Service

**Files:**

- Create: `src/lib/citations/formatter.ts`
- Create: `src/lib/citations/__tests__/formatter.test.ts`

### Step 1: Create Citation Formatter

Create `src/lib/citations/formatter.ts`:

```typescript
import type { Database } from '@/lib/supabase/database.types';

type Citation = Database['public']['Tables']['citations']['Row'];

export type CitationStyle = 'numbered' | 'author-year' | 'superscript';

export interface FormattedCitation {
  inline: string;
  reference: string;
}

export function formatCitation(citation: Citation, style: CitationStyle, index: number): FormattedCitation {
  switch (style) {
    case 'numbered':
      return {
        inline: `[${index}]`,
        reference: formatNumberedReference(citation, index),
      };
    case 'author-year':
      return {
        inline: formatAuthorYear(citation),
        reference: formatAPAReference(citation),
      };
    case 'superscript':
      return {
        inline: `<sup>${index}</sup>`,
        reference: formatNumberedReference(citation, index),
      };
  }
}

function formatAuthorYear(citation: Citation): string {
  const authors = citation.authors?.split(', ') || [];
  const year = citation.year || 'n.d.';

  if (authors.length === 0) return `(${year})`;

  const lastName = (name: string) => {
    const parts = name.trim().split(' ');
    return parts[parts.length - 1];
  };

  if (authors.length === 1) {
    return `(${lastName(authors[0])}, ${year})`;
  }
  if (authors.length === 2) {
    return `(${lastName(authors[0])} & ${lastName(authors[1])}, ${year})`;
  }
  return `(${lastName(authors[0])} et al., ${year})`;
}

function formatNumberedReference(citation: Citation, index: number): string {
  const parts: string[] = [];

  parts.push(`[${index}]`);

  if (citation.authors) {
    parts.push(citation.authors);
  }

  if (citation.title) {
    parts.push(`"${citation.title}"`);
  }

  if (citation.journal) {
    parts.push(`*${citation.journal}*`);
  }

  if (citation.year) {
    parts.push(`(${citation.year})`);
  }

  if (citation.doi) {
    parts.push(`https://doi.org/${citation.doi}`);
  }

  return parts.join('. ');
}

function formatAPAReference(citation: Citation): string {
  const parts: string[] = [];

  if (citation.authors) {
    // Convert to APA author format
    const authors = citation.authors.split(', ');
    const formattedAuthors = authors.map((author) => {
      const nameParts = author.trim().split(' ');
      if (nameParts.length >= 2) {
        const lastName = nameParts.pop();
        const initials = nameParts.map((n) => `${n[0]}.`).join(' ');
        return `${lastName}, ${initials}`;
      }
      return author;
    });
    parts.push(formattedAuthors.join(', '));
  }

  if (citation.year) {
    parts.push(`(${citation.year})`);
  }

  if (citation.title) {
    parts.push(citation.title);
  }

  if (citation.journal) {
    parts.push(`*${citation.journal}*`);
  }

  if (citation.doi) {
    parts.push(`https://doi.org/${citation.doi}`);
  }

  return parts.join('. ');
}

export function generateReferenceList(citations: Citation[], style: CitationStyle): string[] {
  return citations.map((citation, index) => formatCitation(citation, style, index + 1).reference);
}
```

### Step 2: Commit

```bash
git add .
git commit -m "feat: add citation formatting service with multiple styles"
```

---

## Task 5.9: E2E Tests for Citations

**Files:**

- Create: `e2e/citations/citation-search.spec.ts`
- Create: `e2e/citations/citation-management.spec.ts`
- Create: `e2e/page-objects/CitationSearchPage.ts`
- Create: `e2e/page-objects/CitationListPage.ts`
- Create: `e2e/mocks/handlers.ts`

### Step 1: Create MSW Mock Handlers

Create `e2e/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const semanticScholarHandlers = [
  http.get('https://api.semanticscholar.org/graph/v1/paper/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';

    if (query.includes('__empty__')) {
      return HttpResponse.json({ total: 0, data: [] });
    }

    if (query.includes('__error__')) {
      return HttpResponse.json({ error: 'Server error' }, { status: 500 });
    }

    return HttpResponse.json({
      total: 2,
      data: [
        {
          paperId: 'mock-paper-1',
          title: `Mock Paper about ${query}`,
          authors: [{ name: 'Mock Author' }],
          year: 2024,
          journal: { name: 'Mock Journal' },
          externalIds: { DOI: '10.1000/mock1' },
          abstract: 'Mock abstract for testing.',
          url: 'https://example.com/paper1',
          citationCount: 100,
        },
        {
          paperId: 'mock-paper-2',
          title: 'Second Mock Paper',
          authors: [{ name: 'Another Author' }],
          year: 2023,
          externalIds: { DOI: '10.1000/mock2' },
          url: 'https://example.com/paper2',
        },
      ],
    });
  }),
];
```

### Step 2: Create Page Objects

Create `e2e/page-objects/CitationSearchPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class CitationSearchPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly resultsContainer: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search papers/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.resultsContainer = page.getByTestId('citation-results');
    this.loadingIndicator = page.getByRole('status');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async waitForResults() {
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 10000 });
    await expect(this.resultsContainer).toBeVisible();
  }

  async getCitationCards() {
    await this.waitForResults();
    return this.resultsContainer.getByTestId('citation-card').all();
  }

  async addCitation(index: number) {
    const cards = await this.getCitationCards();
    await cards[index].getByRole('button', { name: /add/i }).click();
  }
}
```

### Step 3: Write E2E Tests

Create `e2e/citations/citation-search.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { CitationSearchPage } from '../page-objects/CitationSearchPage';

test.describe('Citation Search', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate
    await page.goto('/login');
    // ... auth steps
    await page.goto('/projects/test-project/citations');
  });

  test('user can search for citations', async ({ page }) => {
    const citationSearch = new CitationSearchPage(page);

    await citationSearch.search('machine learning');
    await citationSearch.waitForResults();

    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('user can add citation from search results', async ({ page }) => {
    const citationSearch = new CitationSearchPage(page);

    await citationSearch.search('machine learning');
    await citationSearch.waitForResults();
    await citationSearch.addCitation(0);

    await expect(page.getByText('Citation added')).toBeVisible();
  });

  test('shows empty state for no results', async ({ page }) => {
    const citationSearch = new CitationSearchPage(page);

    await citationSearch.search('__empty__');

    await expect(page.getByText(/no papers found/i)).toBeVisible();
  });
});
```

### Step 4: Run E2E Tests

```bash
npm run test:e2e e2e/citations/
```

### Step 5: Commit

```bash
git add .
git commit -m "test: add E2E tests for citation features"
```

---

## Phase 5 Complete

### Verification Checklist

- [ ] `npm test src/lib/citations/` - All Semantic Scholar client tests pass
- [ ] `npm test src/components/citations/` - All citation component tests pass
- [ ] `npm run test:e2e e2e/citations/` - All citation E2E tests pass
- [ ] Citation search returns papers from Semantic Scholar
- [ ] Papers with DOIs show "Verified" badge
- [ ] Duplicate citations are detected and prevented
- [ ] Citations can be inserted in editor with Cmd+Shift+C
- [ ] Citations display with [n] numbered format
- [ ] Citation list page shows all project citations
- [ ] Citations can be manually added/edited/deleted

### Files Created

```
src/lib/citations/
├── types.ts
├── semantic-scholar.ts
├── formatter.ts
└── __tests__/
    ├── semantic-scholar.test.ts
    ├── formatter.test.ts
    └── fixtures/
        └── semantic-scholar-responses.ts

src/lib/api/
├── citations.ts
└── __tests__/
    ├── citations.test.ts
    └── fixtures/
        └── citation-fixtures.ts

src/components/citations/
├── CitationCard.tsx
├── CitationSearch.tsx
├── CitationList.tsx
├── CitationEditDialog.tsx
└── __tests__/
    ├── CitationCard.test.tsx
    └── CitationSearch.test.tsx

src/components/editor/
├── extensions/
│   └── citation.ts
└── CitationPicker.tsx

src/app/api/citations/
├── route.ts
├── [id]/
│   └── route.ts
└── search/
    └── route.ts

src/app/projects/[id]/citations/
└── page.tsx

supabase/migrations/
└── *_citation_enhancements.sql

e2e/
├── citations/
│   ├── citation-search.spec.ts
│   └── citation-management.spec.ts
├── page-objects/
│   ├── CitationSearchPage.ts
│   └── CitationListPage.ts
└── mocks/
    └── handlers.ts
```

---

## Execution Handoff

This detailed plan is ready for implementation. Execute tasks sequentially (5.1 → 5.2 → ... → 5.9).

**Key implementation notes:**

1. Run tests after each task to ensure nothing breaks
2. Task 5.1 must complete before 5.4-5.7 (API dependency)
3. Task 5.2 must complete before 5.7 (TipTap extension dependency)
4. E2E tests (5.9) require mock server setup before running
