# Task 2.12: Vault Page Integration (TDD)

> **Phase 2** | [← VaultSearch Component](./12-vault-search-component.md) | [Next: E2E Tests →](./14-e2e-tests.md)

---

## Context

**This task creates the vault page that integrates all components using TDD.** It includes server-side data fetching, error boundary, and optimistic updates.

### Prerequisites

- **Task 2.1** completed (VaultUpload available)
- **Task 2.3** completed (VaultItemList available)
- **Task 2.11** completed (VaultSearch available)

### What This Task Creates

- `src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx` - 6 unit tests
- `src/app/projects/[id]/vault/page.tsx` - Server component
- `src/app/projects/[id]/vault/VaultPageClient.tsx` - Client component with error boundary

### Tasks That Depend on This

- **Task 2.13** (E2E Tests) - tests this page

---

## Files to Create/Modify

- `src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx` (create)
- `src/app/projects/[id]/vault/page.tsx` (create)
- `src/app/projects/[id]/vault/VaultPageClient.tsx` (create)

---

## Steps

### Step 1: Write failing tests for VaultPageClient

Create `src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultPageClient } from '../VaultPageClient';

// Mock child components
vi.mock('@/components/vault/VaultUpload', () => ({
  VaultUpload: vi.fn(({ onUpload }) => (
    <div data-testid="vault-upload">
      <button onClick={onUpload}>Upload</button>
    </div>
  )),
}));

vi.mock('@/components/vault/VaultItemList', () => ({
  VaultItemList: vi.fn(({ items, onDelete, onRetry }) => (
    <div data-testid="vault-item-list">
      {items.map((item: any) => (
        <div key={item.id} data-testid={`item-${item.id}`}>
          {item.filename}
          <button onClick={() => onDelete(item.id)}>Delete</button>
          <button onClick={() => onRetry(item.id)}>Retry</button>
        </div>
      ))}
    </div>
  )),
}));

vi.mock('@/components/vault/VaultSearch', () => ({
  VaultSearch: vi.fn(() => <div data-testid="vault-search">Search</div>),
}));

vi.mock('react-error-boundary', () => ({
  ErrorBoundary: vi.fn(({ children }) => <div>{children}</div>),
}));

global.fetch = vi.fn();

const mockItems = [
  { id: 'item-1', filename: 'test1.pdf', type: 'pdf', extraction_status: 'success' },
  { id: 'item-2', filename: 'test2.docx', type: 'docx', extraction_status: 'pending' },
];

describe('VaultPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockItems),
    });
  });

  it('renders all vault components', () => {
    render(<VaultPageClient projectId="project-1" initialItems={mockItems} />);

    expect(screen.getByTestId('vault-upload')).toBeInTheDocument();
    expect(screen.getByTestId('vault-item-list')).toBeInTheDocument();
    expect(screen.getByTestId('vault-search')).toBeInTheDocument();
  });

  it('displays initial items', () => {
    render(<VaultPageClient projectId="project-1" initialItems={mockItems} />);

    expect(screen.getByText('test1.pdf')).toBeInTheDocument();
    expect(screen.getByText('test2.docx')).toBeInTheDocument();
  });

  it('refreshes items after upload', async () => {
    render(<VaultPageClient projectId="project-1" initialItems={mockItems} />);

    await userEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/vault?projectId=project-1');
    });
  });

  it('performs optimistic delete', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<VaultPageClient projectId="project-1" initialItems={mockItems} />);

    await userEvent.click(screen.getAllByText('Delete')[0]);

    // Item should be removed immediately (optimistic)
    await waitFor(() => {
      expect(screen.queryByText('test1.pdf')).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/vault/item-1', { method: 'DELETE' });
  });

  it('rolls back delete on failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: false });

    render(<VaultPageClient projectId="project-1" initialItems={mockItems} />);

    await userEvent.click(screen.getAllByText('Delete')[0]);

    // Should roll back after failure
    await waitFor(() => {
      expect(screen.getByText('test1.pdf')).toBeInTheDocument();
    });
  });

  it('triggers re-extraction on retry', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<VaultPageClient projectId="project-1" initialItems={mockItems} />);

    await userEvent.click(screen.getAllByText('Retry')[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/vault/extract', expect.objectContaining({
        method: 'POST',
      }));
    });
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx
```

**Expected:** FAIL - Cannot find module '../VaultPageClient'

---

### Step 3: Create vault page server component (Next.js 14+ params)

Create `src/app/projects/[id]/vault/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { VaultPageClient } from './VaultPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VaultPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !project) {
    redirect('/projects');
  }

  const { data: items } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return <VaultPageClient projectId={id} initialItems={items || []} />;
}
```

---

### Step 4: Create vault page client with error boundary

Create `src/app/projects/[id]/vault/VaultPageClient.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { VaultUpload } from '@/components/vault/VaultUpload';
import { VaultItemList } from '@/components/vault/VaultItemList';
import { VaultSearch } from '@/components/vault/VaultSearch';
import type { VaultItem } from '@/lib/vault/types';

interface Props {
  projectId: string;
  initialItems: VaultItem[];
}

function VaultErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-800 font-medium">Something went wrong loading the vault.</p>
      <p className="text-red-600 text-sm mt-1">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}

function VaultContent({ projectId, initialItems }: Props) {
  const [items, setItems] = useState<VaultItem[]>(initialItems);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    const response = await fetch(`/api/vault?projectId=${projectId}`);
    if (response.ok) {
      const data = await response.json();
      setItems(data);
    }
  }, [projectId]);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic update
    const previousItems = items;
    setDeletingIds(prev => new Set(prev).add(id));
    setItems(prev => prev.filter(item => item.id !== id));

    try {
      const response = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
    } catch (error) {
      // Rollback on error
      setItems(previousItems);
      // Note: In production, send to error tracking (e.g., Sentry)
      // and show user-friendly toast notification
      setDeleteError('Failed to delete file. Please try again.');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [items]);

  const handleRetry = useCallback(async (id: string) => {
    await fetch('/api/vault/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id }),
    });
    refreshItems();
  }, [refreshItems]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Knowledge Vault</h1>

      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {deleteError}
          <button
            onClick={() => setDeleteError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-8">
        <VaultUpload projectId={projectId} onUpload={refreshItems} />
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Search</h2>
        <VaultSearch projectId={projectId} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Uploaded Files</h2>
        <VaultItemList
          items={items}
          onDelete={handleDelete}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}

export function VaultPageClient(props: Props) {
  return (
    <ErrorBoundary FallbackComponent={VaultErrorFallback}>
      <VaultContent {...props} />
    </ErrorBoundary>
  );
}
```

---

### Step 5: Run tests to verify they pass

```bash
npm test src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx
```

**Expected:** PASS - 6 tests passed

---

### Step 6: Install react-error-boundary if not present

```bash
npm install react-error-boundary
```

**Expected:** Package installed (or already present)

---

### Step 7: Commit vault page

```bash
git add src/app/projects/
git commit -m "feat: add vault page with unit tests, error boundary and optimistic updates (TDD)"
```

---

## Verification Checklist

- [ ] `react-error-boundary` package installed
- [ ] `src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx` exists with 6 tests
- [ ] `src/app/projects/[id]/vault/page.tsx` exists
- [ ] `src/app/projects/[id]/vault/VaultPageClient.tsx` exists
- [ ] All 6 tests pass
- [ ] Page redirects to login if not authenticated
- [ ] Page redirects to projects if project not found
- [ ] Page fetches initial items server-side (excludes soft-deleted)
- [ ] Upload triggers refresh of items list
- [ ] Delete uses optimistic updates with rollback
- [ ] Retry button triggers re-extraction
- [ ] Error boundary catches and displays errors
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.13: E2E Tests](./14-e2e-tests.md)**.
