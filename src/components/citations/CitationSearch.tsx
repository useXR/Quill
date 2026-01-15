'use client';

import { useState, useEffect, useRef } from 'react';
import type { Paper } from '@/lib/citations/types';
import { CitationCard } from './CitationCard';
import { Loader2, Search, AlertCircle } from 'lucide-react';

interface CitationSearchProps {
  onAdd: (paper: Paper) => Promise<void> | void;
  addedPaperIds?: Set<string>;
}

export function CitationSearch({ onAdd, addedPaperIds = new Set() }: CitationSearchProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/citations/search?q=${encodeURIComponent(query)}&limit=10`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const retryAfter = data.retryAfter || 60;
          throw new Error(`Too many requests. Please wait ${retryAfter} seconds and try again.`);
        }
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();
      setPapers(data.papers);
      setHasSearched(true);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          placeholder="Search papers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search papers"
          className="flex-1 px-4 py-2.5 bg-surface font-ui text-base text-ink-primary placeholder:text-ink-subtle border border-ink-faint rounded-md shadow-sm transition-all duration-150 hover:border-ink-subtle focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-quill hover:bg-quill-dark text-white font-ui font-semibold text-sm rounded-md shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" role="status" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Search</span>
        </button>
      </form>

      {error && (
        <div role="alert" className="flex items-start gap-3 p-4 bg-error-light border border-error/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="font-ui text-sm text-error-dark">{error}</p>
        </div>
      )}

      {hasSearched && papers.length === 0 && !isLoading && !error && (
        <p className="text-center font-ui text-ink-tertiary py-8">No papers found</p>
      )}

      <div data-testid="citation-results" className="grid gap-4 md:grid-cols-2">
        {papers.map((paper) => (
          <CitationCard key={paper.paperId} paper={paper} onAdd={onAdd} isAdded={addedPaperIds.has(paper.paperId)} />
        ))}
      </div>
    </div>
  );
}
