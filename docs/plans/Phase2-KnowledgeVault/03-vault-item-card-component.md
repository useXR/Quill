# Task 2.2: VaultItemCard Component (TDD)

> **Phase 2** | [← VaultUpload Component](./02-vault-upload-component.md) | [Next: VaultItemList Component →](./04-vault-item-list-component.md)

---

## Context

**This task creates the card component that displays a single vault item's information and status.** It shows filename, file type icon, extraction status, and action buttons.

> **Design System:** This component follows the "Scholarly Craft" aesthetic with warm paper tones and refined borders. See [`docs/design-system.md`](../../design-system.md) for full specifications.

### Prerequisites

- **Task 2.0** completed (types available)

### What This Task Creates

- `src/components/vault/__tests__/VaultItemCard.test.tsx` - 7 unit tests
- `src/components/vault/VaultItemCard.tsx` - Item card component

### Tasks That Depend on This

- **Task 2.3** (VaultItemList) - uses this component to render items

### Parallel Tasks

This task can be done in parallel with:

- **Task 2.1** (VaultUpload)
- **Task 2.4** (Vault API Helpers)

---

## Files to Create/Modify

- `src/components/vault/__tests__/VaultItemCard.test.tsx` (create)
- `src/components/vault/VaultItemCard.tsx` (create)

---

## Steps

### Step 1: Write failing tests for VaultItemCard

Create `src/components/vault/__tests__/VaultItemCard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils/render';
import userEvent from '@testing-library/user-event';
import { VaultItemCard } from '../VaultItemCard';
import { createMockVaultItem } from '@/lib/vault/__tests__/fixtures';
import type { VaultItem } from '@/lib/vault/types';

// Note: Use custom render from @/test-utils which includes providers
// Use createMockVaultItem factory from fixtures for test data

// Use the factory function to create test data
const mockItem = createMockVaultItem({
  id: '1',
  filename: 'research-paper.pdf',
  extraction_status: 'success',
  chunk_count: 5,
});

describe('VaultItemCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filename', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
  });

  it('shows extraction status', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('shows chunk count for processed items', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByText(/5 chunks/i)).toBeInTheDocument();
  });

  it('shows file type icon', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', async () => {
    const mockDelete = vi.fn();
    render(<VaultItemCard item={mockItem} onDelete={mockDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockDelete).toHaveBeenCalledWith('1');
  });

  it('shows retry button when status is failed', async () => {
    const failedItem = { ...mockItem, extraction_status: 'failed' };
    const mockRetry = vi.fn();
    render(<VaultItemCard item={failedItem} onDelete={() => {}} onRetry={mockRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledWith('1');
  });

  it('shows spinner for processing states', () => {
    const processingItem = { ...mockItem, extraction_status: 'extracting' };
    render(<VaultItemCard item={processingItem} onDelete={() => {}} />);

    expect(screen.getByTestId('status-spinner')).toBeInTheDocument();
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/components/vault/__tests__/VaultItemCard.test.tsx
```

**Expected:** FAIL - Cannot find module '../VaultItemCard'

---

### Step 3: Implement VaultItemCard

Create `src/components/vault/VaultItemCard.tsx`:

> **Design System:** Uses Quill design tokens for consistent "Scholarly Craft" aesthetic. See [`docs/design-system.md`](../../design-system.md).

```typescript
'use client';

import { FileText, File, Trash2, RefreshCw, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { VaultItem } from '@/lib/vault/types';

interface VaultItemCardProps {
  item: VaultItem;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

const statusIcons = {
  pending: Clock,
  downloading: Loader2,
  extracting: Loader2,
  chunking: Loader2,
  embedding: Loader2,
  success: CheckCircle,
  partial: AlertCircle,
  failed: AlertCircle,
};

// Design system: semantic colors for status indicators
const statusColors = {
  pending: 'text-warning',
  downloading: 'text-quill',
  extracting: 'text-quill',
  chunking: 'text-quill',
  embedding: 'text-quill',
  success: 'text-success',
  partial: 'text-warning',
  failed: 'text-error',
};

export function VaultItemCard({ item, onDelete, onRetry }: VaultItemCardProps) {
  const FileIcon = item.type === 'pdf' ? FileText : File;
  const StatusIcon = statusIcons[item.extraction_status as keyof typeof statusIcons] || Clock;
  const statusColor = statusColors[item.extraction_status as keyof typeof statusColors] || 'text-ink-tertiary';
  const isProcessing = ['downloading', 'extracting', 'chunking', 'embedding'].includes(item.extraction_status || '');

  return (
    <div className="
      flex items-center justify-between p-4
      bg-surface border border-ink-faint rounded-lg
      shadow-sm
      transition-all duration-200
      hover:shadow-md hover:border-ink-subtle
    ">
      <div className="flex items-center gap-3">
        <FileIcon
          data-testid={`file-icon-${item.type}`}
          className="w-8 h-8 text-ink-tertiary"
        />
        <div>
          <p className="font-ui font-medium text-ink-primary">{item.filename}</p>
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon
              data-testid={isProcessing ? 'status-spinner' : undefined}
              className={`w-4 h-4 ${statusColor} ${isProcessing ? 'motion-safe:animate-spin' : ''}`}
            />
            <span className="font-ui text-ink-secondary capitalize">{item.extraction_status}</span>
            {item.chunk_count > 0 && (
              <span className="font-ui text-ink-tertiary">• {item.chunk_count} chunks</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {item.extraction_status === 'failed' && onRetry && (
          <button
            onClick={() => onRetry(item.id)}
            className="
              p-2 rounded-md
              text-quill hover:bg-quill-lighter
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
            aria-label="Retry extraction"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="
            p-2 rounded-md
            text-error hover:bg-error-light
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2
          "
          aria-label="Delete file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

---

### Step 4: Run tests to verify they pass

```bash
npm test src/components/vault/__tests__/VaultItemCard.test.tsx
```

**Expected:** PASS - 7 tests passed

---

### Step 5: Commit VaultItemCard

```bash
git add src/components/vault/
git commit -m "feat: add VaultItemCard component with status display (TDD)"
```

---

## Verification Checklist

- [ ] `src/components/vault/__tests__/VaultItemCard.test.tsx` exists with 7 tests
- [ ] `src/components/vault/VaultItemCard.tsx` exists
- [ ] All tests pass
- [ ] Tests use custom render from `@/test-utils/render` (includes providers)
- [ ] Tests use `createMockVaultItem` factory from fixtures
- [ ] Component displays filename and file type icon
- [ ] Component shows extraction status with appropriate icon/color
- [ ] Component shows chunk count for successful extractions
- [ ] Delete button works and calls onDelete
- [ ] Retry button shows for failed items
- [ ] Spinner shows for processing states
- [ ] Spinner respects `prefers-reduced-motion` (uses `motion-safe:animate-spin`)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.3: VaultItemList Component](./04-vault-item-list-component.md)**.
