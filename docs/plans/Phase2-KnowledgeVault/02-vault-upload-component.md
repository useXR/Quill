# Task 2.1: VaultUpload Component (TDD)

> **Phase 2** | [← Infrastructure Setup](./01-infrastructure-setup.md) | [Next: VaultItemCard Component →](./03-vault-item-card-component.md)

---

## Context

**This task creates the drag-and-drop file upload component using Test-Driven Development.** It handles file selection, validation, and upload to the API.

> **Design System:** This component follows the "Scholarly Craft" aesthetic. See [`docs/design-system.md`](../../design-system.md) for full specifications.

### Prerequisites

- **Task 2.0** completed (constants and types available)

### What This Task Creates

- `src/components/vault/__tests__/VaultUpload.test.tsx` - 7 unit tests
- `src/components/vault/VaultUpload.tsx` - Upload component with drag-drop

### Tasks That Depend on This

- **Task 2.12** (Vault Page) - integrates this component

### Parallel Tasks

This task can be done in parallel with:

- **Task 2.2** (VaultItemCard)
- **Task 2.4** (Vault API Helpers)

---

## Files to Create/Modify

- `src/components/vault/__tests__/VaultUpload.test.tsx` (create)
- `src/components/vault/VaultUpload.tsx` (create)

---

## Steps

### Step 1: Write failing test for upload zone rendering

Create `src/components/vault/__tests__/VaultUpload.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils/render';
import userEvent from '@testing-library/user-event';
import { VaultUpload } from '../VaultUpload';

// Note: Use custom render from @/test-utils which includes providers
// See docs/best-practices/testing-best-practices.md for details

global.fetch = vi.fn();

describe('VaultUpload', () => {
  const mockOnUpload = vi.fn();
  const defaultProps = {
    projectId: 'test-project-id',
    onUpload: mockOnUpload,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
  });

  it('renders upload zone with instructions', () => {
    render(<VaultUpload {...defaultProps} />);
    expect(screen.getByText(/drag files here/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf, docx, or txt/i)).toBeInTheDocument();
  });
});
```

---

### Step 2: Run test to verify it fails

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** FAIL - Cannot find module '../VaultUpload'

---

### Step 3: Create minimal VaultUpload component

Create `src/components/vault/VaultUpload.tsx`:

```typescript
'use client';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  return (
    <div>
      <p>Drag files here</p>
      <p>PDF, DOCX, or TXT</p>
    </div>
  );
}
```

---

### Step 4: Run test to verify it passes

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** PASS - 1 test passed

---

### Step 5: Add test for drag-over state

Add to test file:

```typescript
  it('shows drag-over state when file is dragged over', () => {
    render(<VaultUpload {...defaultProps} />);
    const dropZone = screen.getByTestId('vault-upload-zone');

    fireEvent.dragOver(dropZone);
    // Design system: drag-over uses quill accent border
    expect(dropZone).toHaveClass('border-quill');
  });

  it('resets drag state on drag leave', () => {
    render(<VaultUpload {...defaultProps} />);
    const dropZone = screen.getByTestId('vault-upload-zone');

    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    // Design system: default border is ink-faint
    expect(dropZone).not.toHaveClass('border-quill');
  });
```

---

### Step 6: Run tests to verify they fail

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** FAIL - Unable to find element by [data-testid="vault-upload-zone"]

---

### Step 7: Implement drag state

Update `src/components/vault/VaultUpload.tsx`:

> **Design System:** Uses Quill design tokens for the "Scholarly Craft" aesthetic. See [`docs/design-system.md`](../../design-system.md).

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div
      data-testid="vault-upload-zone"
      className={`
        border-2 border-dashed rounded-lg p-8 text-center
        transition-all duration-150
        ${dragOver
          ? 'border-quill bg-quill-lighter'
          : 'border-ink-faint bg-bg-secondary hover:border-ink-subtle hover:bg-surface-hover'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <Upload className="w-8 h-8 mx-auto mb-3 text-ink-tertiary" />
      <p className="font-ui font-medium text-ink-primary">Drag files here</p>
      <p className="font-ui text-sm text-ink-tertiary mt-1">PDF, DOCX, or TXT</p>
    </div>
  );
}
```

---

### Step 8: Run tests to verify they pass

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** PASS - 3 tests passed

---

### Step 9: Add test for file size validation

Add to test file:

```typescript
  it('validates file size before upload', async () => {
    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 101 * 1024 * 1024 });

    await userEvent.upload(input, largeFile);

    expect(screen.getByText(/file exceeds/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types', async () => {
    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const exeFile = new File(['x'], 'malware.exe', { type: 'application/x-executable' });
    await userEvent.upload(input, exeFile);

    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
```

---

### Step 10: Run tests to verify they fail

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** FAIL - Unable to find element by [data-testid="vault-file-input"]

---

### Step 11: Add file input element with validation

Update component to add hidden file input with validation logic (see full implementation in original plan Step 2.1.11).

---

### Step 12: Run tests to verify they pass

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** PASS - 5 tests passed

---

### Step 13: Add test for upload submission

Add to test file:

```typescript
  it('calls API and onUpload after successful upload', async () => {
    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, validFile);

    expect(global.fetch).toHaveBeenCalledWith('/api/vault/upload', expect.any(Object));
    expect(mockOnUpload).toHaveBeenCalled();
  });

  it('shows uploading state during upload', async () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({ items: [] }) }), 100))
    );

    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    userEvent.upload(input, validFile);

    expect(await screen.findByText(/uploading/i)).toBeInTheDocument();
  });
```

---

### Step 14: Run tests to verify they fail

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** FAIL - fetch not called / uploading text not found

---

### Step 15: Implement full upload logic

Update to complete component with:

- Upload state management
- FormData construction
- API call with error handling
- Visual feedback

See full implementation in original plan Step 2.1.15.

---

### Step 16: Run all tests

```bash
npm test src/components/vault/__tests__/VaultUpload.test.tsx
```

**Expected:** PASS - 7 tests passed

---

### Step 17: Commit VaultUpload component

```bash
git add src/components/vault/
git commit -m "feat: add VaultUpload component with drag-drop and validation (TDD)"
```

---

## Verification Checklist

- [ ] `src/components/vault/__tests__/VaultUpload.test.tsx` exists with 7 tests
- [ ] `src/components/vault/VaultUpload.tsx` exists
- [ ] All tests pass
- [ ] Tests use custom render from `@/test-utils/render` (includes providers)
- [ ] Component handles drag-over visual state
- [ ] Component validates file types and sizes
- [ ] Component shows upload progress
- [ ] Component calls API on valid files
- [ ] Spinner uses `motion-safe:animate-spin` for reduced motion support
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.2: VaultItemCard Component](./03-vault-item-card-component.md)**.
