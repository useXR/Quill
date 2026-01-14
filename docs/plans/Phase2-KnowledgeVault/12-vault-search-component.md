# Task 2.11: VaultSearch Component (TDD)

> **Phase 2** | [← Semantic Search](./11-semantic-search.md) | [Next: Vault Page Integration →](./13-vault-page-integration.md)

---

## Context

**This task creates the search UI component with request cancellation using TDD.** It provides a search input, displays results, and handles loading/empty states.

### Prerequisites

- **Task 2.10** completed (search API available)

### What This Task Creates

- `src/components/vault/__tests__/VaultSearch.test.tsx` - 5 unit tests
- `src/components/vault/VaultSearch.tsx` - Search UI component
- `src/components/vault/index.ts` - Barrel export

### Tasks That Depend on This

- **Task 2.12** (Vault Page) - integrates this component

---

## Files to Create/Modify

- `src/components/vault/__tests__/VaultSearch.test.tsx` (create)
- `src/components/vault/VaultSearch.tsx` (create)
- `src/components/vault/index.ts` (create)

---

## Steps

### Step 1: Write failing tests for VaultSearch

Create `src/components/vault/__tests__/VaultSearch.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils/render';
import userEvent from '@testing-library/user-event';
import { VaultSearch } from '../VaultSearch';

// Note: Use custom render from @/test-utils which includes providers

global.fetch = vi.fn();

describe('VaultSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input and button', () => {
    render(<VaultSearch projectId="project-1" />);

    expect(screen.getByPlaceholderText(/search your vault/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('disables search button when query is empty', () => {
    render(<VaultSearch projectId="project-1" />);

    const button = screen.getByRole('button', { name: /search/i });
    expect(button).toBeDisabled();
  });

  it('calls API on search submit', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    render(<VaultSearch projectId="project-1" />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test query');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/vault/search', expect.any(Object));
    });
  });

  it('displays search results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          content: 'Test result content',
          similarity: 0.85,
          vaultItemId: 'item-1',
          filename: 'test.pdf',
          chunkIndex: 0,
        }]
      }),
    });

    render(<VaultSearch projectId="project-1" />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test query');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/test result content/i)).toBeInTheDocument();
      expect(screen.getByText(/test.pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/85%/i)).toBeInTheDocument();
    });
  });

  it('shows no results message when empty', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    render(<VaultSearch projectId="project-1" />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test query');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/components/vault/__tests__/VaultSearch.test.tsx
```

**Expected:** FAIL - Cannot find module '../VaultSearch'

---

### Step 3: Implement VaultSearch with request cancellation

Create `src/components/vault/VaultSearch.tsx`:

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, FileText, Loader2 } from 'lucide-react';
import type { SearchResult } from '@/lib/vault/types';

interface VaultSearchProps {
  projectId: string;
  onResultSelect?: (result: SearchResult) => void;
}

export function VaultSearch({ projectId, onResultSelect }: VaultSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setSearching(true);
    setSearched(false);
    setSearchError(null);

    try {
      const response = await fetch('/api/vault/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, query }),
        signal: abortControllerRef.current.signal,
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      } else {
        setResults([]);
        setSearchError('Search failed. Please try again.');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      // Note: In production, consider sending to error tracking (e.g., Sentry)
      setSearchError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [projectId, query]);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your vault..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          aria-label="Search"
        >
          {searching ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" /> : 'Search'}
        </button>
      </form>

      {searchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {searchError}
          <button
            onClick={() => setSearchError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {searched && !searchError && results.length === 0 && (
        <p className="text-gray-500 text-center py-4">No results found.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </h3>
          {results.map((result) => (
            <div
              key={`${result.vaultItemId}-${result.chunkIndex}`}
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => onResultSelect?.(result)}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  {result.filename}
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(result.similarity * 100)}% match
                </span>
              </div>
              <p className="text-gray-700 text-sm line-clamp-3">
                {result.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 4: Run tests to verify they pass

```bash
npm test src/components/vault/__tests__/VaultSearch.test.tsx
```

**Expected:** PASS - 5 tests passed

---

### Step 5: Commit VaultSearch component

```bash
git add src/components/vault/
git commit -m "feat: add VaultSearch component with request cancellation (TDD)"
```

---

### Step 6: Create barrel export for vault components

Create `src/components/vault/index.ts`:

```typescript
export { VaultUpload } from './VaultUpload';
export { VaultItemCard } from './VaultItemCard';
export { VaultItemList } from './VaultItemList';
export { VaultSearch } from './VaultSearch';
```

---

### Step 7: Commit barrel export

```bash
git add src/components/vault/index.ts
git commit -m "chore: add barrel export for vault components"
```

---

## Verification Checklist

- [ ] `src/components/vault/__tests__/VaultSearch.test.tsx` exists with 5 tests
- [ ] `src/components/vault/VaultSearch.tsx` exists
- [ ] `src/components/vault/index.ts` exists with all exports
- [ ] All tests pass
- [ ] Tests use custom render from `@/test-utils/render` (includes providers)
- [ ] Search button disabled when query empty
- [ ] Loading state shown during search
- [ ] Results displayed with similarity percentage
- [ ] "No results found" message for empty results
- [ ] Error state displayed via UI (not console.error)
- [ ] Request cancellation prevents stale results
- [ ] Spinner respects `prefers-reduced-motion` (uses `motion-safe:animate-spin`)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.12: Vault Page Integration](./13-vault-page-integration.md)**.
