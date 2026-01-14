# Tasks 5.24-5.32: UI Components

> **Phase 5** | [← API Routes](./06-api-routes.md) | [Next: E2E Tests →](./08-e2e-tests.md)

---

## Context

**This task creates React components for citation management.** Components follow TDD with tests first, then implementation.

### Design System Requirements

All citation UI components must implement the **Scholarly Craft** design system from `docs/design-system.md`. This ensures visual consistency with the rest of the application.

#### Typography

| Element                  | Class                                               | Font              |
| ------------------------ | --------------------------------------------------- | ----------------- |
| Citation title           | `font-display text-lg font-medium text-ink-primary` | Libre Baskerville |
| Author names             | `font-ui text-sm text-ink-secondary`                | Source Sans 3     |
| Metadata (year, journal) | `font-ui text-xs text-ink-tertiary`                 | Source Sans 3     |
| Button text              | `font-ui text-sm font-semibold`                     | Source Sans 3     |
| Badge text               | `font-ui text-xs font-medium`                       | Source Sans 3     |

#### Colors (Tailwind v4 `@theme` tokens)

| Element           | Token                                         | Hex                         |
| ----------------- | --------------------------------------------- | --------------------------- |
| Card background   | `bg-surface`                                  | #ffffff                     |
| Card border       | `border-ink-faint`                            | #d6d3d1                     |
| Primary text      | `text-ink-primary`                            | #1c1917                     |
| Secondary text    | `text-ink-secondary`                          | #44403c                     |
| Muted text        | `text-ink-tertiary`                           | #78716c                     |
| Primary button    | `bg-quill hover:bg-quill-dark`                | #7c3aed / #6d28d9           |
| Verified badge    | `bg-success-light text-success`               | #dcfce7 / #166534           |
| No DOI badge      | `bg-warning-light text-warning`               | #fef3c7 / #a16207           |
| Open Access badge | `bg-info-light text-info`                     | #dbeafe / #1e40af           |
| Error alert       | `bg-error-light border-error text-error-dark` | #fee2e2 / #991b1b / #7f1d1d |

#### Spacing & Layout

| Element             | Tokens                      |
| ------------------- | --------------------------- |
| Card padding        | `p-4` or `p-6`              |
| Card gap (internal) | `gap-2`                     |
| Results grid        | `grid gap-4 md:grid-cols-2` |
| Badge spacing       | `px-2.5 py-1`               |
| Button padding      | `px-4 py-2.5`               |

#### Shadows & Radius

| Element       | Token                                               |
| ------------- | --------------------------------------------------- |
| Card at rest  | `shadow-sm rounded-lg`                              |
| Card on hover | `shadow-md` (via `hover:shadow-md`)                 |
| Buttons       | `rounded-md shadow-sm`                              |
| Badges        | `rounded-md`                                        |
| Focus ring    | `focus:ring-2 focus:ring-quill focus:ring-offset-2` |

#### Motion

| Interaction     | Duration                                  | Easing           |
| --------------- | ----------------------------------------- | ---------------- |
| Button hover    | `duration-150`                            | `transition-all` |
| Card hover      | `duration-200`                            | `transition-all` |
| Loading spinner | `animate-spin motion-reduce:animate-none` | CSS animation    |

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

## Task 5.23a: Citations Page Route (CRITICAL)

> **CRITICAL**: This page route MUST be created for E2E tests to pass. Tests reference `/projects/${projectId}/citations` but this route does not exist without this task.

### Context

E2E tests navigate to `/projects/${projectId}/citations` to test citation functionality. Without this page route, all citation E2E tests will fail with 404 errors.

### Files to Create

- `src/app/projects/[id]/citations/page.tsx`
- `src/app/projects/[id]/citations/layout.tsx` (optional, for navigation)

### Step 1: Create Citations Page

Create `src/app/projects/[id]/citations/page.tsx`:

```typescript
// src/app/projects/[id]/citations/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCitations } from '@/lib/api/citations';
import { CitationSearch } from '@/components/citations/CitationSearch';
import { CitationList } from '@/components/citations/CitationList';
import { Loader2 } from 'lucide-react';

interface CitationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CitationsPage({ params }: CitationsPageProps) {
  // IMPORTANT: Next.js 16 requires awaiting params (Best Practice: Phase 4)
  const { id: projectId } = await params;

  // Require authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Verify user owns this project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    redirect('/projects');
  }

  // Load initial citations
  const citations = await getCitations(projectId);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink-primary">
          Citations
        </h1>
        <p className="font-ui text-sm text-ink-secondary mt-1">
          Manage citations for {project.title}
        </p>
      </header>

      {/* Citation Search Section */}
      <section className="mb-8">
        <h2 className="font-ui text-lg font-medium text-ink-primary mb-4">
          Search Papers
        </h2>
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-ink-tertiary" /></div>}>
          <CitationSearch
            onAdd={async (paper) => {
              'use server';
              // Server action to add citation
              const { createCitationFromPaper } = await import('@/lib/api/citations');
              await createCitationFromPaper(projectId, paper);
            }}
          />
        </Suspense>
      </section>

      {/* Citation List Section */}
      <section>
        <h2 className="font-ui text-lg font-medium text-ink-primary mb-4">
          Project Citations
        </h2>
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-ink-tertiary" /></div>}>
          <CitationList
            initialCitations={citations}
            onDelete={async (id) => {
              'use server';
              // Server action to delete citation
              const { deleteCitation } = await import('@/lib/api/citations');
              await deleteCitation(id);
            }}
          />
        </Suspense>
      </section>
    </div>
  );
}

// Page metadata
export async function generateMetadata({ params }: CitationsPageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('title')
    .eq('id', projectId)
    .single();

  return {
    title: project ? `Citations - ${project.title}` : 'Citations',
    description: 'Manage project citations',
  };
}
```

### Step 2: Add navigation link (optional)

If the project has a navigation/sidebar component, add a link to the citations page:

```typescript
// In project navigation component
<Link
  href={`/projects/${projectId}/citations`}
  className="nav-link"
>
  <BookMarked className="h-4 w-4" />
  Citations
</Link>
```

### Step 3: Add unit test for page

Create `src/app/projects/[id]/citations/__tests__/page.test.tsx`:

```typescript
// src/app/projects/[id]/citations/__tests__/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: { id: 'proj-1', title: 'Test Project' }, error: null })),
          })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/api/citations', () => ({
  getCitations: vi.fn(() => []),
}));

describe('Citations Page', () => {
  it('should render page title', async () => {
    const CitationsPage = (await import('../page')).default;
    render(await CitationsPage({ params: Promise.resolve({ id: 'proj-1' }) }));
    expect(screen.getByText('Citations')).toBeInTheDocument();
  });

  it('should render search section', async () => {
    const CitationsPage = (await import('../page')).default;
    render(await CitationsPage({ params: Promise.resolve({ id: 'proj-1' }) }));
    expect(screen.getByText('Search Papers')).toBeInTheDocument();
  });
});
```

### Step 4: Commit

```bash
git add src/app/projects/[id]/citations/
git commit -m "feat(citations): add citations page route (CRITICAL for E2E)"
```

---

## Verification Checklist - Citations Page Route

- [ ] **CRITICAL**: `src/app/projects/[id]/citations/page.tsx` exists
- [ ] Page requires authentication (redirects to login if not authenticated)
- [ ] Page verifies user owns the project (redirects if not owner)
- [ ] Page renders CitationSearch component
- [ ] Page renders CitationList component
- [ ] Page loads initial citations from database
- [ ] Next.js 16 async params pattern used (`params` awaited)
- [ ] Page is accessible at `/projects/${projectId}/citations`
- [ ] Unit test exists and passes
- [ ] Changes committed

---

### CRITICAL: Citations Page Route E2E Test

After creating the citations page route (Task 5.23a), immediately verify with E2E:

Create `e2e/citations/citation-navigation.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citations Page Navigation', () => {
  test('citations page loads for authenticated user', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByRole('heading', { name: /citations/i })).toBeVisible();
  });

  test('unauthenticated access redirects to login', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await expect(page).toHaveURL(/\/login/);
  });
});
```

### E2E Test Execution After Task 5.23a (Required Before Proceeding)

```bash
npm run test:e2e e2e/citations/citation-navigation.spec.ts
```

**Gate:** Page must load successfully before creating UI components.

### Incremental E2E Execution Points

**After Task 5.27 (CitationSearch):**

```bash
npm run test:e2e e2e/citations/citation-search.spec.ts
```

**After Task 5.29 (CitationList):**

```bash
npm run test:e2e e2e/citations/citation-management.spec.ts
```

**After Task 5.31 (CitationPicker + Toolbar Integration):**

```bash
npm run test:e2e e2e/citations/citation-editor-integration.spec.ts
```

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
    // Design System: Card with surface background, subtle border, warm shadow
    <Card
      data-testid="citation-card"
      className="
        flex flex-col
        bg-surface
        border border-ink-faint rounded-lg
        shadow-sm
        transition-all duration-200
        hover:shadow-md hover:border-ink-subtle
      "
    >
      <CardHeader className="pb-2">
        {/* Design System: Citation titles use font-display (Libre Baskerville) for scholarly authority */}
        <CardTitle className="font-display text-lg font-medium leading-tight text-ink-primary">
          {paper.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 pb-2">
        {/* Design System: Author names use font-ui (Source Sans 3) for readability */}
        <p className="font-ui text-sm text-ink-secondary">{authors}</p>

        {/* Design System: Metadata uses tertiary ink color */}
        <div className="flex flex-wrap items-center gap-2 font-ui text-xs text-ink-tertiary">
          {paper.journal?.name && <span>{paper.journal.name}</span>}
          {paper.year && <span>({paper.year})</span>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {/* Design System: Semantic badges with appropriate colors */}
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

        {paper.abstract && (
          <p className="line-clamp-2 font-ui text-xs text-ink-tertiary">
            {paper.abstract}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2 pt-2">
        {/* Design System: Links use quill brand color */}
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-ui text-xs text-quill hover:text-quill-dark hover:underline transition-colors duration-150"
        >
          <ExternalLink className="mr-1 inline h-3 w-3" />
          View Paper
        </a>

        {/* Design System: Primary button with quill color, proper focus ring */}
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={isAdded || isLoading}
          className={`
            font-ui text-sm font-semibold
            px-4 py-2
            rounded-md shadow-sm
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isAdded
              ? 'bg-surface border border-ink-faint text-ink-secondary hover:bg-surface-hover'
              : 'bg-quill text-white hover:bg-quill-dark active:bg-quill-darker'
            }
          `}
        >
          {isLoading ? (
            // Design System: Reduced motion support for accessibility
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
    <div className="space-y-6">
      {/* Use form element for proper semantics and hydration tracking */}
      {/* Design System: Search form with proper spacing and visual hierarchy */}
      <form ref={formRef} onSubmit={handleSearch} className="flex gap-3">
        {/* Design System: Input with surface background, subtle border, focus ring */}
        <Input
          placeholder="Search papers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search papers"
          className="
            flex-1
            px-4 py-2.5
            bg-surface
            font-ui text-base text-ink-primary
            placeholder:text-ink-subtle
            border border-ink-faint rounded-md
            shadow-sm
            transition-all duration-150
            hover:border-ink-subtle
            focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill
          "
        />
        {/* Design System: Primary button with quill color */}
        <Button
          type="submit"
          disabled={isLoading}
          className="
            inline-flex items-center justify-center
            px-4 py-2.5
            bg-quill hover:bg-quill-dark active:bg-quill-darker
            text-white font-ui font-semibold text-sm
            rounded-md shadow-sm hover:shadow-md
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-quill
          "
        >
          {isLoading ? (
            // Reduced motion support (Best Practice: Design System §3)
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" role="status" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Search</span>
        </Button>
      </form>

      {/* Design System: Error alert with semantic colors */}
      {error && (
        <div
          role="alert"
          className="
            flex items-start gap-3
            p-4
            bg-error-light
            border border-error/20 rounded-lg
          "
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="font-ui text-sm text-error-dark">{error}</p>
        </div>
      )}

      {/* Design System: Empty state with tertiary text */}
      {hasSearched && papers.length === 0 && !isLoading && !error && (
        <p className="text-center font-ui text-ink-tertiary py-8">No papers found</p>
      )}

      {/* Design System: Results grid with consistent gap */}
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
        // Design System: Empty state with centered text, tertiary color
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="font-ui text-ink-tertiary">No citations yet</p>
        </div>
      ) : (
        // Design System: Citation list with cards
        <ul className="space-y-4" role="list" aria-label="Citations">
          {citations.map(citation => (
            <li
              key={citation.id}
              className="
                flex items-center justify-between
                p-4
                bg-surface
                border border-ink-faint rounded-lg
                shadow-sm
                transition-all duration-200
                hover:shadow-md
              "
            >
              <div className="flex-1 min-w-0">
                {/* Design System: Citation title with font-display */}
                <h3 className="font-display text-base font-medium text-ink-primary truncate">
                  {citation.title}
                </h3>
              </div>
              {/* Design System: Ghost button for destructive secondary action */}
              <button
                onClick={() => setDeleteTarget(citation.id)}
                className="
                  ml-4 p-2
                  text-ink-tertiary hover:text-error
                  rounded-md
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                "
                aria-label="Delete citation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Use ConfirmDialog, NOT window.confirm (Best Practice: Phase 4) */}
      {/* Design System: Destructive dialog with error colors */}
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

---

## CitationPicker Integration

> **CRITICAL**: The CitationPicker must be integrated into the editor toolbar to allow users to insert citations. Without this integration, users cannot add citations to their documents.

### Step 1: Add CitationPicker trigger button to Toolbar

Update `src/components/editor/Toolbar.tsx` to include a citation button:

```typescript
// src/components/editor/Toolbar.tsx
import { CitationPicker } from '@/components/citations/CitationPicker';
import { BookMarked } from 'lucide-react';

// Add to toolbar button group:
<CitationPicker
  trigger={
    <button
      type="button"
      className="toolbar-button"
      aria-label="Insert citation"
      title="Insert citation"
    >
      <BookMarked className="h-4 w-4" />
    </button>
  }
  onSelect={(citation) => {
    // Insert citation into editor at cursor position
    editor.commands.setCitation({
      citationId: citation.id,
      displayText: `[${citation.citationNumber}]`,
      doi: citation.doi,
      title: citation.title,
    });
  }}
  projectId={projectId}
/>
```

### Step 2: Wire CitationPicker to insert citations

The `onSelect` callback must:

1. Get the citation data from CitationPicker
2. Generate display text (e.g., "[1]" for first citation)
3. Call `editor.commands.setCitation()` to insert the citation mark
4. Close the picker modal

### Step 3: Add unit test for toolbar integration

```typescript
// src/components/editor/__tests__/Toolbar.test.tsx
it('should render citation button in toolbar', () => {
  render(<Toolbar editor={mockEditor} projectId="test-project" />);
  expect(screen.getByRole('button', { name: /insert citation/i })).toBeInTheDocument();
});

it('should open CitationPicker on button click', async () => {
  render(<Toolbar editor={mockEditor} projectId="test-project" />);
  await userEvent.click(screen.getByRole('button', { name: /insert citation/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

### Step 4: Commit

```bash
git add src/components/editor/Toolbar.tsx
git commit -m "feat(editor): add CitationPicker trigger to toolbar"
```

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

### Component Implementation

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
- [ ] **CRITICAL**: CitationPicker trigger button added to editor toolbar
- [ ] **CRITICAL**: CitationPicker wired to insert citations via `editor.commands.setCitation()`
- [ ] All component tests pass (15+ tests)
- [ ] Components render correctly
- [ ] User interactions work
- [ ] Error states handled (via state, not console.error)
- [ ] Loading states implemented for async buttons
- [ ] Reduced motion support (`motion-reduce:animate-none`) on all spinners
- [ ] Form hydration pattern used (`data-hydrated="true"`)
- [ ] No `window.confirm()` or `window.alert()` usage
- [ ] Changes committed

### Design System Compliance (Scholarly Craft)

- [ ] **Typography**: Citation titles use `font-display` (Libre Baskerville)
- [ ] **Typography**: UI text uses `font-ui` (Source Sans 3)
- [ ] **Colors**: Cards use `bg-surface`, `border-ink-faint`
- [ ] **Colors**: Text uses `text-ink-primary`, `text-ink-secondary`, `text-ink-tertiary`
- [ ] **Colors**: Primary buttons use `bg-quill hover:bg-quill-dark`
- [ ] **Colors**: Verified badge uses `bg-success-light text-success`
- [ ] **Colors**: No DOI badge uses `bg-warning-light text-warning`
- [ ] **Colors**: Open Access badge uses `bg-info-light text-info`
- [ ] **Colors**: Error alerts use `bg-error-light text-error-dark`
- [ ] **Spacing**: Cards use `p-4` or `p-6` padding
- [ ] **Spacing**: Results grid uses `gap-4`
- [ ] **Radius**: Cards use `rounded-lg`
- [ ] **Radius**: Buttons and badges use `rounded-md`
- [ ] **Shadows**: Cards at rest use `shadow-sm`
- [ ] **Shadows**: Cards on hover use `shadow-md`
- [ ] **Motion**: Transitions use `duration-150` or `duration-200`
- [ ] **Focus**: All interactive elements have `focus:ring-2 focus:ring-quill focus:ring-offset-2`
- [ ] **Accessibility**: Reduced motion support with `motion-reduce:animate-none`

---

## E2E Tests

> **IMPORTANT**: UI components should be tested with E2E tests to verify user workflows in a real browser environment.

### CitationEditorPage Page Object (CRITICAL)

> **CRITICAL**: All citation E2E tests that involve the editor MUST use the `CitationEditorPage` page object for consistency and maintainability.

Create `e2e/pages/CitationEditorPage.ts`:

```typescript
// e2e/pages/CitationEditorPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for citation interactions within the document editor.
 * Encapsulates all citation-related editor operations for consistent test patterns.
 */
export class CitationEditorPage {
  readonly page: Page;
  readonly editor: Locator;
  readonly citationPickerButton: Locator;
  readonly citationPickerDialog: Locator;
  readonly pickerSearchInput: Locator;
  readonly pickerSearchButton: Locator;
  readonly pickerResults: Locator;
  readonly pickerCloseButton: Locator;
  readonly citationMarks: Locator;
  readonly citationTooltip: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editor = page.locator('[role="textbox"]');
    this.citationPickerButton = page.getByRole('button', { name: /insert citation/i });
    this.citationPickerDialog = page.getByRole('dialog');
    this.pickerSearchInput = page.getByRole('dialog').getByPlaceholder(/search/i);
    this.pickerSearchButton = page.getByRole('dialog').getByRole('button', { name: /search/i });
    this.pickerResults = page.getByRole('dialog').getByTestId('citation-results');
    this.pickerCloseButton = page.getByRole('dialog').getByRole('button', { name: /close/i });
    this.citationMarks = page.locator('cite[data-citation-id]');
    this.citationTooltip = page.getByRole('tooltip');
  }

  /**
   * Navigate to the document editor page
   */
  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  }

  /**
   * Open the citation picker modal from the toolbar
   */
  async openCitationPicker() {
    await this.citationPickerButton.click();
    await expect(this.citationPickerDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Search for papers within the citation picker
   */
  async searchInPicker(query: string) {
    await this.pickerSearchInput.fill(query);
    await this.pickerSearchButton.click();
    // Wait for results to load using toPass pattern (Best Practice: Phase 2)
    await expect(async () => {
      const cards = await this.pickerResults.getByTestId('citation-card').count();
      expect(cards).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  /**
   * Select a citation from picker results by index
   */
  async selectCitationFromPicker(index: number) {
    const addButtons = this.pickerResults.getByRole('button', { name: /add/i });
    await addButtons.nth(index).click();
    // Dialog should close after selection
    await expect(this.citationPickerDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Close the citation picker without selecting
   */
  async closeCitationPicker() {
    await this.pickerCloseButton.click();
    await expect(this.citationPickerDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Verify a citation exists in the editor
   */
  async expectCitationInEditor(citationId?: string) {
    if (citationId) {
      await expect(this.page.locator(`cite[data-citation-id="${citationId}"]`)).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    } else {
      await expect(this.citationMarks.first()).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    }
  }

  /**
   * Get count of citations in the editor
   */
  async getCitationCount(): Promise<number> {
    return await this.citationMarks.count();
  }

  /**
   * Hover over a citation to show tooltip
   */
  async hoverCitation(index: number = 0) {
    await this.citationMarks.nth(index).hover();
    await expect(this.citationTooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Click "View Paper" link in citation tooltip
   * Returns the URL that would be opened
   */
  async clickViewPaperLink(): Promise<string> {
    const viewPaperLink = this.citationTooltip.getByRole('link', { name: /view paper/i });
    const href = await viewPaperLink.getAttribute('href');
    // Verify link opens in new tab
    const target = await viewPaperLink.getAttribute('target');
    expect(target).toBe('_blank');
    return href || '';
  }

  /**
   * Complete workflow: open picker, search, select citation
   */
  async insertCitation(searchQuery: string, resultIndex: number = 0) {
    await this.openCitationPicker();
    await this.searchInPicker(searchQuery);
    await this.selectCitationFromPicker(resultIndex);
    await this.expectCitationInEditor();
  }

  /**
   * Wait for editor to be ready (hydrated)
   */
  async waitForEditorReady() {
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    // Wait for form hydration (Best Practice: Phase 1)
    await expect(async () => {
      const hydrated = await this.page.locator('form[data-hydrated="true"]').count();
      expect(hydrated).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.HYDRATION });
  }
}
```

### E2E Test Files to Create

Create the following E2E test files for comprehensive coverage:

#### 1. Citation Search E2E Tests

Create `e2e/citations/citation-search.spec.ts`:

```typescript
// Test search UI functionality
// - Search input renders and accepts text
// - Search results display correctly
// - Empty state shows for no results
// - Error state shows for API failures
// - Rate limit message displays
// - Verified/No DOI badges render correctly
```

#### 2. Citation List E2E Tests

Create `e2e/citations/citation-list.spec.ts`:

```typescript
// Test citation list functionality
// - List displays project citations
// - Empty state shows when no citations
// - Delete button opens ConfirmDialog (NOT window.confirm)
// - Cancel button in dialog keeps citation
// - Confirm delete removes citation from list
// - Optimistic update shows immediate removal
// - Rollback on delete failure restores citation
```

#### 3. Citation Picker E2E Tests

Create `e2e/citations/citation-picker.spec.ts`:

```typescript
// Test picker modal functionality
// - Picker opens on toolbar button click
// - Search within picker works
// - Selecting citation closes picker
// - Selected citation data is correct
// - Recently added citations are shown
// - Close button dismisses picker
```

#### 4. Citation Editor Integration E2E Tests (CRITICAL)

Create `e2e/citations/citation-editor-integration.spec.ts`:

```typescript
// e2e/citations/citation-editor-integration.spec.ts
// CRITICAL: Import from test-fixtures (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Editor Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  test('user can insert citation into editor via picker', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Open CitationPicker from toolbar
    await page.getByRole('button', { name: /insert citation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.DIALOG });

    // Search for a paper
    await page.getByPlaceholder(/search/i).fill('test paper');
    await page.keyboard.press('Enter');

    // Wait for results and select first
    await expect(page.getByTestId('citation-card').first()).toBeVisible({ timeout: TIMEOUTS.API_CALL });
    await page.getByRole('button', { name: /add/i }).first().click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });

    // Citation should appear in editor content
    await expect(page.locator('cite[data-citation-id]')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('citation persists after save and reload', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Insert a citation
    await page.getByRole('button', { name: /insert citation/i }).click();
    await page.getByPlaceholder(/search/i).fill('persistent');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /add/i }).first().click();

    // Wait for autosave (or trigger manual save)
    await page.waitForTimeout(2000); // Allow autosave

    // Reload page
    await page.reload();

    // Citation should still be visible
    await expect(page.locator('cite[data-citation-id]')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });

  test('citation displays correct information on hover', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Insert citation
    await page.getByRole('button', { name: /insert citation/i }).click();
    await page.getByPlaceholder(/search/i).fill('hover test');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /add/i }).first().click();

    // Hover over citation
    const citation = page.locator('cite[data-citation-id]');
    await citation.hover();

    // Tooltip/popover should show citation details
    await expect(page.getByText(/hover test/i)).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('multiple citations can be inserted', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Insert first citation
    await page.getByRole('button', { name: /insert citation/i }).click();
    await page.getByPlaceholder(/search/i).fill('first');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /add/i }).first().click();

    // Insert second citation
    await page.getByRole('button', { name: /insert citation/i }).click();
    await page.getByPlaceholder(/search/i).fill('second');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /add/i }).first().click();

    // Both citations should be visible
    const citations = page.locator('cite[data-citation-id]');
    await expect(citations).toHaveCount(2);
  });
});
```

### Commit E2E Tests

```bash
git add e2e/citations/
git commit -m "test(e2e): add citation UI component E2E tests"
```

---

## E2E Test: View Paper Link

> **CRITICAL**: The "View Paper" link must open the paper's external URL in a new tab. This is essential for researchers to access the full paper.

### Test Coverage Required

Create or update `e2e/citations/citation-view-paper.spec.ts`:

```typescript
// e2e/citations/citation-view-paper.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { CitationEditorPage } from '../pages/CitationEditorPage';
import { CitationSearchPage } from '../pages/CitationSearchPage';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation View Paper Link', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  test('View Paper link in CitationCard opens external URL in new tab', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('test paper');
    await citationSearch.waitForResults();

    // Find the View Paper link in the first card
    const viewPaperLink = page
      .getByTestId('citation-card')
      .first()
      .getByRole('link', { name: /view paper/i });
    await expect(viewPaperLink).toBeVisible();

    // Verify link attributes for new tab behavior
    const href = await viewPaperLink.getAttribute('href');
    const target = await viewPaperLink.getAttribute('target');
    const rel = await viewPaperLink.getAttribute('rel');

    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//); // Must be a valid URL
    expect(target).toBe('_blank'); // Opens in new tab
    expect(rel).toContain('noopener'); // Security: prevents window.opener access
    expect(rel).toContain('noreferrer'); // Security: prevents referrer leaking
  });

  test('View Paper link in tooltip opens external URL in new tab', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Insert a citation
    await citationEditor.insertCitation('view paper test');

    // Hover to show tooltip
    await citationEditor.hoverCitation(0);

    // Get the View Paper link URL
    const url = await citationEditor.clickViewPaperLink();
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
  });

  test('View Paper link click captures new tab URL correctly', async ({ page, context, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('new tab test');
    await citationSearch.waitForResults();

    // Listen for new page (tab) to be opened
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page
        .getByTestId('citation-card')
        .first()
        .getByRole('link', { name: /view paper/i })
        .click(),
    ]);

    // Verify the new tab opened with correct URL
    await newPage.waitForLoadState();
    const url = newPage.url();
    expect(url).toMatch(/example\.com/); // Mock returns example.com URLs

    await newPage.close();
  });

  test('View Paper link is keyboard accessible', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('keyboard accessible');
    await citationSearch.waitForResults();

    // Tab to the View Paper link
    const viewPaperLink = page
      .getByTestId('citation-card')
      .first()
      .getByRole('link', { name: /view paper/i });

    // Focus the link
    await viewPaperLink.focus();
    await expect(viewPaperLink).toBeFocused();

    // Verify it has visible focus indicator (design system requirement)
    const focusStyles = await viewPaperLink.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        outlineStyle: computed.outlineStyle,
        outlineColor: computed.outlineColor,
      };
    });

    // Should have some form of focus indicator
    expect(focusStyles.outlineStyle).not.toBe('none');
  });
});
```

---

## E2E Test: Manual Citation Entry (If UI Exists)

> **NOTE**: Manual citation entry allows users to add citations without searching Semantic Scholar. This is useful for sources not in the database or for offline work.

### Test Coverage Required (If Feature Implemented)

Create `e2e/citations/citation-manual-entry.spec.ts`:

```typescript
// e2e/citations/citation-manual-entry.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { CitationEditorPage } from '../pages/CitationEditorPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Manual Citation Entry', () => {
  test('user can add citation manually without searching', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Open citation picker
    await citationEditor.openCitationPicker();

    // Find and click "Add manually" or similar button
    const manualEntryButton = page.getByRole('button', { name: /add manually|manual entry|create citation/i });

    // Skip test if manual entry UI doesn't exist
    if (!(await manualEntryButton.isVisible())) {
      test.skip();
      return;
    }

    await manualEntryButton.click();

    // Fill in manual citation form
    const titleInput = page.getByLabel(/title/i);
    const authorsInput = page.getByLabel(/authors?/i);
    const yearInput = page.getByLabel(/year/i);
    const doiInput = page.getByLabel(/doi/i);

    await titleInput.fill('Manually Added Paper Title');
    await authorsInput.fill('Manual Author, Second Author');
    await yearInput.fill('2024');
    await doiInput.fill('10.1234/manual-entry');

    // Submit the manual citation
    await page.getByRole('button', { name: /add citation|save|submit/i }).click();

    // Verify citation appears in editor
    await citationEditor.expectCitationInEditor();

    // Hover and verify manual entry data is shown
    await citationEditor.hoverCitation(0);
    await expect(page.getByRole('tooltip').getByText(/Manually Added Paper Title/i)).toBeVisible();
  });

  test('manual citation entry validates required fields', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.openCitationPicker();

    const manualEntryButton = page.getByRole('button', { name: /add manually|manual entry|create citation/i });

    if (!(await manualEntryButton.isVisible())) {
      test.skip();
      return;
    }

    await manualEntryButton.click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /add citation|save|submit/i }).click();

    // Should show validation errors
    await expect(page.getByText(/title is required|please enter a title/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('manual citation entry shows "No DOI" badge when DOI not provided', async ({
    page,
    workerCtx,
    loginAsWorker,
  }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.openCitationPicker();

    const manualEntryButton = page.getByRole('button', { name: /add manually|manual entry|create citation/i });

    if (!(await manualEntryButton.isVisible())) {
      test.skip();
      return;
    }

    await manualEntryButton.click();

    // Fill only required fields (no DOI)
    await page.getByLabel(/title/i).fill('Paper Without DOI');
    await page.getByLabel(/authors?/i).fill('Author Name');
    await page.getByLabel(/year/i).fill('2023');

    await page.getByRole('button', { name: /add citation|save|submit/i }).click();

    // Verify citation was added
    await citationEditor.expectCitationInEditor();

    // Hover and verify "No DOI" indicator is shown
    await citationEditor.hoverCitation(0);
    await expect(page.getByRole('tooltip').getByText(/no doi/i)).toBeVisible();
  });

  test('manual citation entry cancellation works', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.openCitationPicker();

    const manualEntryButton = page.getByRole('button', { name: /add manually|manual entry|create citation/i });

    if (!(await manualEntryButton.isVisible())) {
      test.skip();
      return;
    }

    await manualEntryButton.click();

    // Fill some data
    await page.getByLabel(/title/i).fill('Should Not Be Added');

    // Cancel
    await page.getByRole('button', { name: /cancel|back/i }).click();

    // Close picker
    await citationEditor.closeCitationPicker();

    // Verify no citation was added
    const count = await citationEditor.getCitationCount();
    expect(count).toBe(0);
  });
});
```

### Implementation Note for Manual Entry

If manual citation entry UI is to be implemented, add a "Manual Entry" tab or button to the CitationPicker component:

```typescript
// In CitationPicker.tsx
<Tabs defaultValue="search">
  <TabsList>
    <TabsTrigger value="search">Search</TabsTrigger>
    <TabsTrigger value="manual">Add Manually</TabsTrigger>
  </TabsList>
  <TabsContent value="search">
    {/* Existing search UI */}
  </TabsContent>
  <TabsContent value="manual">
    <ManualCitationForm onSubmit={handleManualAdd} />
  </TabsContent>
</Tabs>
```

---

## Next Steps

After this task, proceed to **[Tasks 5.33-5.35: E2E Tests](./08-e2e-tests.md)**.
