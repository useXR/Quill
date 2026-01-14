# Task 2.3: VaultItemList Component (TDD)

> **Phase 2** | [← VaultItemCard Component](./03-vault-item-card-component.md) | [Next: Vault API Helpers →](./05-vault-api-helpers.md)

---

## Context

**This task creates the list container component that renders multiple vault items.** It handles empty states and delegates item rendering to VaultItemCard.

> **Design System:** This component follows the "Scholarly Craft" aesthetic. See [`docs/design-system.md`](../../design-system.md) for full specifications.

### Prerequisites

- **Task 2.2** completed (VaultItemCard available)

### What This Task Creates

- `src/components/vault/__tests__/VaultItemList.test.tsx` - 3 unit tests
- `src/components/vault/VaultItemList.tsx` - List container component

### Tasks That Depend on This

- **Task 2.12** (Vault Page) - integrates this component

---

## Files to Create/Modify

- `src/components/vault/__tests__/VaultItemList.test.tsx` (create)
- `src/components/vault/VaultItemList.tsx` (create)

---

## Steps

### Step 1: Write failing tests for VaultItemList

Create `src/components/vault/__tests__/VaultItemList.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils/render';
import { VaultItemList } from '../VaultItemList';
import { createMockVaultItem, mockVaultItems } from '@/lib/vault/__tests__/fixtures';
import type { VaultItem } from '@/lib/vault/types';

// Note: Use custom render from @/test-utils which includes providers
// Use mockVaultItems and createMockVaultItem factory from fixtures

const mockItems: VaultItem[] = [
  createMockVaultItem({
    id: '1',
    filename: 'research-paper.pdf',
    type: 'pdf',
    extraction_status: 'success',
    chunk_count: 5,
  }),
  createMockVaultItem({
    id: '2',
    filename: 'notes.docx',
    type: 'docx',
    extraction_status: 'pending',
    chunk_count: 0,
  }),
];

describe('VaultItemList', () => {
  it('renders list of vault items', () => {
    render(<VaultItemList items={mockItems} onDelete={() => {}} />);

    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.docx')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<VaultItemList items={[]} onDelete={() => {}} />);

    expect(screen.getByText(/no files uploaded/i)).toBeInTheDocument();
  });

  it('passes onDelete to each item', () => {
    const mockDelete = vi.fn();
    render(<VaultItemList items={mockItems} onDelete={mockDelete} />);

    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/components/vault/__tests__/VaultItemList.test.tsx
```

**Expected:** FAIL - Cannot find module '../VaultItemList'

---

### Step 3: Implement VaultItemList

Create `src/components/vault/VaultItemList.tsx`:

> **Design System:** Uses Quill design tokens for empty states and spacing. See [`docs/design-system.md`](../../design-system.md).

```typescript
'use client';

import { FileText } from 'lucide-react';
import { VaultItemCard } from './VaultItemCard';
import type { VaultItem } from '@/lib/vault/types';

interface VaultItemListProps {
  items: VaultItem[];
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function VaultItemList({ items, onDelete, onRetry }: VaultItemListProps) {
  if (items.length === 0) {
    return (
      <div className="
        flex flex-col items-center justify-center
        py-16 px-4
        text-center
      ">
        {/* Subtle document illustration */}
        <FileText className="w-16 h-16 text-ink-subtle mb-4" />
        <h3 className="font-display text-lg font-bold text-ink-primary mb-2">
          No files uploaded yet
        </h3>
        <p className="font-ui text-sm text-ink-tertiary max-w-sm">
          Upload PDFs, DOCX, or TXT files to build your knowledge vault.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <VaultItemCard
          key={item.id}
          item={item}
          onDelete={onDelete}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
```

---

### Step 4: Run tests to verify they pass

```bash
npm test src/components/vault/__tests__/VaultItemList.test.tsx
```

**Expected:** PASS - 3 tests passed

---

### Step 5: Commit VaultItemList

```bash
git add src/components/vault/
git commit -m "feat: add VaultItemList component (TDD)"
```

---

## Verification Checklist

- [ ] `src/components/vault/__tests__/VaultItemList.test.tsx` exists with 3 tests
- [ ] `src/components/vault/VaultItemList.tsx` exists
- [ ] All tests pass
- [ ] Tests use custom render from `@/test-utils/render` (includes providers)
- [ ] Tests use `createMockVaultItem` factory from fixtures
- [ ] Component renders all items using VaultItemCard
- [ ] Component shows empty state message when no items
- [ ] Component passes onDelete and onRetry to child cards
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.4: Vault API Helpers](./05-vault-api-helpers.md)**.
