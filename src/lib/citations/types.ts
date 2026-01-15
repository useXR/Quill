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
