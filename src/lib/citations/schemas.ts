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
