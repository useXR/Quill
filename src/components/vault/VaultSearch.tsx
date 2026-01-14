'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, FileText, Loader2, X } from 'lucide-react';
import type { SearchResult } from '@/lib/vault/types';

interface VaultSearchProps {
  projectId: string;
  onResultSelect?: (result: SearchResult) => void;
}

type SearchState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export function VaultSearch({ projectId, onResultSelect }: VaultSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();

    setSearchState('loading');
    setError(null);

    try {
      const response = await fetch('/api/vault/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          query: query.trim(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.results.length === 0) {
        setSearchState('empty');
        setResults([]);
      } else {
        setSearchState('success');
        setResults(data.results);
      }
    } catch (err) {
      // Don't show error for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setSearchState('error');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
    }
  }, [query, projectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleDismissError = () => {
    setError(null);
    setSearchState('idle');
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    }
  };

  const isSearchDisabled = !query.trim();

  return (
    <div className="w-full">
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-tertiary" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your vault..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface text-ink-primary font-ui border border-ink-faint rounded-md shadow-sm transition-all duration-150 hover:border-ink-subtle focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill placeholder:text-ink-subtle"
          />
        </div>
        <button
          type="submit"
          disabled={isSearchDisabled || searchState === 'loading'}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-quill hover:bg-quill-dark active:bg-quill-darker text-white font-ui font-semibold text-sm rounded-md shadow-sm hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-quill"
          aria-label="Search"
        >
          {searchState === 'loading' ? (
            <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Search className="w-5 h-5" aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">Search</span>
        </button>
      </form>

      {/* Error State */}
      {searchState === 'error' && error && (
        <div role="alert" className="flex items-start gap-3 mt-4 p-4 bg-error-light border border-error/20 rounded-lg">
          <p className="flex-1 text-sm font-ui text-error-dark">{error}</p>
          <button
            type="button"
            onClick={handleDismissError}
            className="p-1 rounded-md text-error hover:bg-error/10 focus:outline-none focus:ring-2 focus:ring-error"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {searchState === 'empty' && (
        <div className="mt-6 py-8 text-center">
          <Search className="mx-auto w-12 h-12 text-ink-subtle mb-3" aria-hidden="true" />
          <p className="font-ui text-ink-secondary">No results found.</p>
          <p className="font-ui text-sm text-ink-tertiary mt-1">Try different keywords or phrases.</p>
        </div>
      )}

      {/* Results */}
      {searchState === 'success' && results.length > 0 && (
        <div className="mt-4 space-y-3" role="list" aria-label="Search results">
          {results.map((result, index) => (
            <button
              key={`${result.vaultItemId}-${result.chunkIndex}`}
              type="button"
              onClick={() => handleResultClick(result)}
              className="w-full text-left p-4 bg-surface border border-ink-faint rounded-lg shadow-sm hover:shadow-md hover:border-ink-subtle transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2"
              role="listitem"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-ink-tertiary flex-shrink-0" aria-hidden="true" />
                  <span className="font-ui font-medium text-ink-primary truncate">{result.filename}</span>
                </div>
                <span className="flex-shrink-0 ml-2 px-2 py-0.5 bg-quill-lighter text-quill text-xs font-ui font-medium rounded">
                  {Math.round(result.similarity * 100)}%
                </span>
              </div>
              <p className="font-ui text-sm text-ink-secondary line-clamp-2">{result.content}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
