'use client';

import { useState } from 'react';
import type { Paper } from '@/lib/citations/types';
import { CheckCircle, AlertCircle, ExternalLink, BookOpen, Loader2 } from 'lucide-react';

interface CitationCardProps {
  paper: Paper;
  onAdd: (paper: Paper) => Promise<void> | void;
  isAdded?: boolean;
}

export function CitationCard({ paper, onAdd, isAdded = false }: CitationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const authors = paper.authors.map((a) => a.name).join(', ');
  const hasDOI = !!paper.externalIds?.DOI;

  const handleAdd = async () => {
    setIsLoading(true);
    try {
      await onAdd(paper);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="citation-card"
      className="flex flex-col p-4 bg-surface border border-ink-faint rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
    >
      <h3 className="font-display text-lg font-medium text-ink-primary">{paper.title}</h3>
      <p className="font-ui text-sm text-ink-secondary mt-1">{authors}</p>

      <div className="flex flex-wrap items-center gap-2 mt-2 font-ui text-xs text-ink-tertiary">
        {paper.journal?.name && <span>{paper.journal.name}</span>}
        {paper.year && <span>({paper.year})</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {hasDOI ? (
          <span className="inline-flex items-center px-2.5 py-1 font-ui text-xs font-medium bg-success-light text-success rounded-md">
            <CheckCircle className="mr-1 h-3 w-3" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 font-ui text-xs font-medium bg-warning-light text-warning rounded-md">
            <AlertCircle className="mr-1 h-3 w-3" />
            No DOI
          </span>
        )}
        {paper.isOpenAccess && (
          <span className="inline-flex items-center px-2.5 py-1 font-ui text-xs font-medium bg-info-light text-info rounded-md">
            <BookOpen className="mr-1 h-3 w-3" />
            Open Access
          </span>
        )}
        {paper.citationCount !== undefined && (
          <span className="inline-flex items-center px-2.5 py-1 font-ui text-xs font-medium bg-bg-secondary text-ink-secondary rounded-md">
            {paper.citationCount} citations
          </span>
        )}
      </div>

      {paper.abstract && <p className="line-clamp-2 font-ui text-xs text-ink-tertiary mt-2">{paper.abstract}</p>}

      <div className="flex justify-between items-center mt-4 pt-2 border-t border-ink-faint">
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-ui text-xs text-quill hover:text-quill-dark hover:underline transition-colors"
        >
          <ExternalLink className="mr-1 inline h-3 w-3" />
          View Paper
        </a>
        <button
          onClick={handleAdd}
          disabled={isAdded || isLoading}
          className={`px-4 py-2 font-ui text-sm font-semibold rounded-md shadow-sm transition-all duration-150
            ${
              isAdded
                ? 'bg-surface border border-ink-faint text-ink-secondary cursor-not-allowed'
                : 'bg-quill text-white hover:bg-quill-dark disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
        >
          {isLoading && <Loader2 className="mr-1 h-3 w-3 inline animate-spin motion-reduce:animate-none" />}
          {isAdded ? 'Already Added' : isLoading ? 'Adding...' : 'Add Citation'}
        </button>
      </div>
    </div>
  );
}
