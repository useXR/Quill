# Tasks 5.24-5.32: UI Components

> **Phase 5** | [← API Routes](./06-api-routes.md) | [Next: E2E Tests →](./08-e2e-tests.md)

---

## Context

**This task creates React components for citation management.** Components follow TDD with tests first, then implementation.

### Prerequisites

- **Tasks 5.21-5.23** completed (API routes ready)

### What This Task Creates

- `src/components/citations/CitationCard.tsx` - paper display card
- `src/components/citations/CitationSearch.tsx` - search interface
- `src/components/citations/CitationList.tsx` - citation list view
- `src/components/citations/CitationPicker.tsx` - editor citation picker
- `src/lib/citations/formatter.ts` - citation formatting utilities
- Test files for each component

### Tasks That Depend on This

- **Tasks 5.33-5.35** (E2E Tests) - tests these components in browser

### Best Practices Applied

- **ConfirmDialog Component** - Use `@/components/ui/ConfirmDialog` instead of `window.confirm()` (Best Practice: Phase 4)
- **Form Hydration** - Add `data-hydrated="true"` attribute via useEffect (Best Practice: Phase 1)
- **Loading States** - Implement loading states for async buttons (Best Practice: React §3)
- **Reduced Motion** - Use `motion-reduce:animate-none` on animations (Best Practice: Design System §3)
- **Request Cancellation** - Use AbortController for search requests (Best Practice: Infrastructure Phase 2)
- **Optimistic Updates** - Remove items from UI immediately on delete, rollback on failure (Best Practice: Infrastructure Phase 2)

---

## Files to Create

- `src/components/citations/__tests__/CitationCard.test.tsx`
- `src/components/citations/CitationCard.tsx`
- `src/components/citations/__tests__/CitationSearch.test.tsx`
- `src/components/citations/CitationSearch.tsx`
- `src/components/citations/__tests__/CitationList.test.tsx`
- `src/components/citations/CitationList.tsx`
- `src/components/citations/__tests__/CitationPicker.test.tsx`
- `src/components/citations/CitationPicker.tsx`
- `src/lib/citations/__tests__/formatter.test.ts`
- `src/lib/citations/formatter.ts`

---

## Task 5.24: CitationCard Tests (RED)

### Step 1: Write failing tests

Create `src/components/citations/__tests__/CitationCard.test.tsx`:

```typescript
// src/components/citations/__tests__/CitationCard.test.tsx
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
  abstract: 'This paper explores deep learning applications.',
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

  it('should show Verified badge when DOI present', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('should show No DOI warning when missing', () => {
    const paperWithoutDOI = { ...mockPaper, externalIds: {} };
    render(<CitationCard paper={paperWithoutDOI} onAdd={mockOnAdd} />);
    expect(screen.getByText('No DOI')).toBeInTheDocument();
  });

  it('should call onAdd when button clicked', async () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /add citation/i }));
    expect(mockOnAdd).toHaveBeenCalledWith(mockPaper);
  });

  it('should show loading state while adding', async () => {
    // Simulate async onAdd
    const slowOnAdd = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<CitationCard paper={mockPaper} onAdd={slowOnAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /add citation/i }));
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
  });

  it('should disable button when already added', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} isAdded />);
    expect(screen.getByRole('button', { name: /already added/i })).toBeDisabled();
  });

  it('should display citation count', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText(/245/)).toBeInTheDocument();
  });

  it('should show Open Access badge when applicable', () => {
    render(<CitationCard paper={mockPaper} onAdd={mockOnAdd} />);
    expect(screen.getByText(/open access/i)).toBeInTheDocument();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test src/components/citations/__tests__/CitationCard.test.tsx
```

**Expected:** FAIL (component not found)

### Step 3: Commit

```bash
git add src/components/citations/__tests__/CitationCard.test.tsx
git commit -m "test(citations): add failing CitationCard tests (RED)"
```

---

## Task 5.25: CitationCard Implementation (GREEN)

### Step 1: Implement CitationCard component

Create `src/components/citations/CitationCard.tsx`:

```typescript
// src/components/citations/CitationCard.tsx
'use client';

import { useState } from 'react';
import type { Paper } from '@/lib/citations/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, ExternalLink, BookOpen, Loader2 } from 'lucide-react';

interface CitationCardProps {
  paper: Paper;
  onAdd: (paper: Paper) => Promise<void> | void;
  isAdded?: boolean;
}

export function CitationCard({ paper, onAdd, isAdded = false }: CitationCardProps) {
  // Loading state for async button (Best Practice: React §3)
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
    <Card data-testid="citation-card" className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium leading-tight">
          {paper.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 pb-2">
        <p className="text-sm text-muted-foreground">{authors}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {paper.journal?.name && <span>{paper.journal.name}</span>}
          {paper.year && <span>({paper.year})</span>}
        </div>

        <div className="flex flex-wrap gap-1">
          {hasDOI ? (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-600">
              <AlertCircle className="mr-1 h-3 w-3" />
              No DOI
            </Badge>
          )}

          {paper.isOpenAccess && (
            <Badge variant="outline" className="text-blue-600">
              <BookOpen className="mr-1 h-3 w-3" />
              Open Access
            </Badge>
          )}

          {paper.citationCount !== undefined && (
            <Badge variant="secondary">
              {paper.citationCount} citations
            </Badge>
          )}
        </div>

        {paper.abstract && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {paper.abstract}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2 pt-2">
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          <ExternalLink className="mr-1 inline h-3 w-3" />
          View Paper
        </a>

        <Button
          size="sm"
          onClick={handleAdd}
          disabled={isAdded || isLoading}
          variant={isAdded ? 'outline' : 'default'}
        >
          {isLoading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin motion-reduce:animate-none" />
          ) : null}
          {isAdded ? 'Already Added' : isLoading ? 'Adding...' : 'Add Citation'}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Step 2: Run tests to verify they pass

```bash
npm test src/components/citations/__tests__/CitationCard.test.tsx
```

**Expected:** All tests PASS

### Step 3: Commit

```bash
git add src/components/citations/CitationCard.tsx
git commit -m "feat(citations): implement CitationCard component (GREEN)"
```

---

## Task 5.26: CitationSearch Tests (RED)

### Step 1: Write failing tests

Create `src/components/citations/__tests__/CitationSearch.test.tsx`:

```typescript
// src/components/citations/__tests__/CitationSearch.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitationSearch } from '../CitationSearch';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CitationSearch', () => {
  const mockOnAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        papers: [
          {
            paperId: 'test-1',
            title: 'Test Paper',
            authors: [{ name: 'Author' }],
            year: 2024,
            url: 'https://example.com',
          },
        ],
        total: 1,
      }),
    });
  });

  it('should render search input', () => {
    render(<CitationSearch onAdd={mockOnAdd} />);
    expect(screen.getByPlaceholderText(/search papers/i)).toBeInTheDocument();
  });

  it('should fetch results on search', async () => {
    render(<CitationSearch onAdd={mockOnAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'machine learning');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/citations/search?q=machine%20learning')
      );
    });
  });

  it('should display results', async () => {
    render(<CitationSearch onAdd={mockOnAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Test Paper')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<CitationSearch onAdd={mockOnAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should show empty state for no results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ papers: [], total: 0 }),
    });

    render(<CitationSearch onAdd={mockOnAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'nonexistent');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no papers found/i)).toBeInTheDocument();
    });
  });

  it('should show error on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<CitationSearch onAdd={mockOnAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should cancel previous request when new search initiated', async () => {
    // First request takes longer than second
    let resolveFirst: (value: any) => void;
    const firstRequest = new Promise(resolve => { resolveFirst = resolve; });

    mockFetch
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          papers: [{ paperId: 'second', title: 'Second Result', authors: [], year: 2024, url: '' }],
          total: 1,
        }),
      });

    render(<CitationSearch onAdd={mockOnAdd} />);

    // Start first search
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'first');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    // Start second search before first completes (Best Practice: Infrastructure Phase 2)
    await userEvent.clear(screen.getByPlaceholderText(/search/i));
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'second');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    // Resolve first request after second - should be ignored
    resolveFirst!({
      ok: true,
      json: async () => ({
        papers: [{ paperId: 'first', title: 'First Result', authors: [], year: 2024, url: '' }],
        total: 1,
      }),
    });

    await waitFor(() => {
      // Should show second result, not first (first was aborted)
      expect(screen.getByText('Second Result')).toBeInTheDocument();
    });

    expect(screen.queryByText('First Result')).not.toBeInTheDocument();
  });

  it('should not show error when request is aborted', async () => {
    // AbortError should be silently ignored (Best Practice: Infrastructure Phase 2)
    const abortError = new DOMException('Aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    render(<CitationSearch onAdd={mockOnAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    // Should NOT show an error alert for abort
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test src/components/citations/__tests__/CitationSearch.test.tsx
```

**Expected:** FAIL

### Step 3: Commit

```bash
git add src/components/citations/__tests__/CitationSearch.test.tsx
git commit -m "test(citations): add failing CitationSearch tests (RED)"
```

---

## Task 5.27: CitationSearch Implementation (GREEN)

### Step 1: Implement CitationSearch component

Create `src/components/citations/CitationSearch.tsx`:

```typescript
// src/components/citations/CitationSearch.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import type { Paper } from '@/lib/citations/types';
import { CitationCard } from './CitationCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search } from 'lucide-react';

interface CitationSearchProps {
  onAdd: (paper: Paper) => void;
  addedPaperIds?: Set<string>;
}

export function CitationSearch({ onAdd, addedPaperIds = new Set() }: CitationSearchProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // Request cancellation pattern (Best Practice: Infrastructure Phase 2)
  const abortControllerRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Form hydration pattern (Best Practice: Phase 1)
  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;

    // Cancel previous request (Best Practice: Infrastructure Phase 2)
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/citations/search?q=${encodeURIComponent(query)}&limit=10`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setPapers(data.papers);
      setHasSearched(true);
    } catch (err) {
      // Ignore aborted requests (user cancelled by starting new search)
      if ((err as Error).name === 'AbortError') return;
      // Display error via state, not console (Best Practice: Phase 2)
      setError((err as Error).message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Use form element for proper semantics and hydration tracking */}
      <form ref={formRef} onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search papers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search papers"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            // Reduced motion support (Best Practice: Design System §3)
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" role="status" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Search</span>
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasSearched && papers.length === 0 && !isLoading && !error && (
        <p className="text-center text-muted-foreground">No papers found</p>
      )}

      <div data-testid="citation-results" className="grid gap-4 md:grid-cols-2">
        {papers.map((paper) => (
          <CitationCard
            key={paper.paperId}
            paper={paper}
            onAdd={onAdd}
            isAdded={addedPaperIds.has(paper.paperId)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Step 2: Run tests to verify they pass

```bash
npm test src/components/citations/__tests__/CitationSearch.test.tsx
```

**Expected:** All tests PASS

### Step 3: Commit

```bash
git add src/components/citations/CitationSearch.tsx
git commit -m "feat(citations): implement CitationSearch component (GREEN)"
```

---

## Tasks 5.28-5.32: Remaining Components

Follow the same RED-GREEN pattern for each remaining component:

### Task 5.28-5.29: CitationList

**Tests to write:**

- Renders list of citations
- Shows empty state when no citations
- Handles delete with ConfirmDialog (NOT window.confirm!)
- Shows loading state
- Handles errors
- Optimistically removes item from UI on delete
- Rolls back on delete failure

**Implementation:** Component that displays project citations with delete functionality.

**IMPORTANT:**

1. Use `ConfirmDialog` component from `@/components/ui/ConfirmDialog` for delete confirmation. Never use `window.confirm()` (Best Practice: Phase 4).
2. Use optimistic updates for delete operations (Best Practice: Infrastructure Phase 2).

```typescript
// Example usage in CitationList.tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';

interface Citation {
  id: string;
  title: string;
  // ... other fields
}

interface CitationListProps {
  initialCitations: Citation[];
  onDelete: (id: string) => Promise<void>;
}

function CitationList({ initialCitations, onDelete }: CitationListProps) {
  // Local state for optimistic updates (Best Practice: Infrastructure Phase 2)
  const [citations, setCitations] = useState<Citation[]>(initialCitations);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    // Store reference for potential rollback
    const deletedCitation = citations.find(c => c.id === deleteTarget);
    const originalIndex = citations.findIndex(c => c.id === deleteTarget);

    // Optimistically remove from UI (Best Practice: Infrastructure Phase 2)
    setCitations(prev => prev.filter(c => c.id !== deleteTarget));
    setDeleteTarget(null);

    try {
      await onDelete(deleteTarget);
      toast({ description: 'Citation deleted' });
    } catch (error) {
      // Rollback on failure - reinsert at original position
      setCitations(prev => {
        const newCitations = [...prev];
        newCitations.splice(originalIndex, 0, deletedCitation!);
        return newCitations;
      });
      toast({
        variant: 'destructive',
        description: 'Failed to delete citation. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      {citations.length === 0 ? (
        <p className="text-muted-foreground">No citations yet</p>
      ) : (
        <ul>
          {citations.map(citation => (
            <li key={citation.id}>
              {citation.title}
              <button onClick={() => setDeleteTarget(citation.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Use ConfirmDialog, NOT window.confirm (Best Practice: Phase 4) */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Citation"
        description="Are you sure you want to delete this citation? This action can be undone within 30 days."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  );
}
```

### Task 5.30-5.31: CitationPicker

**Tests to write:**

- Opens as dialog/modal
- Integrates search functionality
- Inserts citation into editor
- Closes on selection
- Shows recently added citations

**Implementation:** Dialog component for selecting citations to insert into editor.

### Task 5.32: Citation Formatter

Create `src/lib/citations/__tests__/formatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatAPA, formatChicago, formatMLA, formatBibTeX } from '../formatter';

describe('Citation Formatter', () => {
  const citation = {
    title: 'Test Paper',
    authors: 'John Smith, Jane Doe',
    year: 2024,
    journal: 'Nature',
    volume: '123',
    pages: '45-67',
    doi: '10.1000/test',
  };

  describe('formatAPA', () => {
    it('should format citation in APA style', () => {
      const result = formatAPA(citation);
      expect(result).toContain('Smith, J.');
      expect(result).toContain('(2024)');
      expect(result).toContain('Nature');
    });
  });

  describe('formatChicago', () => {
    it('should format citation in Chicago style', () => {
      const result = formatChicago(citation);
      expect(result).toContain('Smith, John');
    });
  });

  describe('formatMLA', () => {
    it('should format citation in MLA style', () => {
      const result = formatMLA(citation);
      expect(result).toContain('Smith, John');
    });
  });

  describe('formatBibTeX', () => {
    it('should generate valid BibTeX entry', () => {
      const result = formatBibTeX(citation);
      expect(result).toContain('@article{');
      expect(result).toContain('title = {Test Paper}');
    });
  });
});
```

Create `src/lib/citations/formatter.ts`:

```typescript
interface CitationData {
  title: string;
  authors: string;
  year: number;
  journal?: string;
  volume?: string;
  pages?: string;
  doi?: string;
}

export function formatAPA(citation: CitationData): string {
  const authorList = citation.authors.split(', ');
  const formattedAuthors = authorList
    .map((author) => {
      const parts = author.trim().split(' ');
      const lastName = parts.pop();
      const initials = parts.map((p) => p[0] + '.').join(' ');
      return `${lastName}, ${initials}`;
    })
    .join(', ');

  let result = `${formattedAuthors} (${citation.year}). ${citation.title}.`;

  if (citation.journal) {
    result += ` ${citation.journal}`;
    if (citation.volume) result += `, ${citation.volume}`;
    if (citation.pages) result += `, ${citation.pages}`;
  }

  if (citation.doi) {
    result += ` https://doi.org/${citation.doi}`;
  }

  return result;
}

export function formatChicago(citation: CitationData): string {
  const authorList = citation.authors.split(', ');
  const firstAuthor = authorList[0].trim().split(' ');
  const lastName = firstAuthor.pop();
  const firstName = firstAuthor.join(' ');

  let result = `${lastName}, ${firstName}`;

  if (authorList.length > 1) {
    result += `, et al`;
  }

  result += `. "${citation.title}."`;

  if (citation.journal) {
    result += ` ${citation.journal}`;
    if (citation.volume) result += ` ${citation.volume}`;
    if (citation.pages) result += `: ${citation.pages}`;
  }

  result += ` (${citation.year}).`;

  return result;
}

export function formatMLA(citation: CitationData): string {
  const authorList = citation.authors.split(', ');
  const firstAuthor = authorList[0].trim().split(' ');
  const lastName = firstAuthor.pop();
  const firstName = firstAuthor.join(' ');

  let result = `${lastName}, ${firstName}`;

  if (authorList.length > 1) {
    result += `, et al`;
  }

  result += `. "${citation.title}."`;

  if (citation.journal) {
    result += ` ${citation.journal}`;
    if (citation.volume) result += `, vol. ${citation.volume}`;
    if (citation.pages) result += `, pp. ${citation.pages}`;
  }

  result += `, ${citation.year}.`;

  return result;
}

export function formatBibTeX(citation: CitationData): string {
  const key = citation.title.toLowerCase().replace(/\s+/g, '_').slice(0, 20);

  return `@article{${key},
  title = {${citation.title}},
  author = {${citation.authors}},
  year = {${citation.year}},
  journal = {${citation.journal || ''}},
  volume = {${citation.volume || ''}},
  pages = {${citation.pages || ''}},
  doi = {${citation.doi || ''}}
}`;
}
```

---

## Verification Checklist

- [ ] `CitationCard.tsx` exists and tests pass
- [ ] `CitationSearch.tsx` exists and tests pass
  - [ ] Uses form element with `data-hydrated` attribute
  - [ ] Uses `aria-label` on search input
  - [ ] Uses AbortController for request cancellation (Infrastructure Phase 2)
  - [ ] Ignores AbortError on cancelled requests
- [ ] `CitationList.tsx` exists and tests pass
  - [ ] Uses `ConfirmDialog` component (NOT `window.confirm()`)
  - [ ] Uses optimistic updates for delete (Infrastructure Phase 2)
  - [ ] Rolls back optimistic update on API failure
- [ ] `CitationPicker.tsx` exists and tests pass
- [ ] `formatter.ts` exists and tests pass
- [ ] All component tests pass (15+ tests)
- [ ] Components render correctly
- [ ] User interactions work
- [ ] Error states handled (via state, not console.error)
- [ ] Loading states implemented for async buttons
- [ ] Reduced motion support (`motion-reduce:animate-none`) on all spinners
- [ ] Form hydration pattern used (`data-hydrated="true"`)
- [ ] No `window.confirm()` or `window.alert()` usage
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Tasks 5.33-5.35: E2E Tests](./08-e2e-tests.md)**.
