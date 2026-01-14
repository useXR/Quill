# Task 12: Document Metadata Editing

> **Phase 1** | [← E2E Tests](./11-e2e-tests.md) | [Next: Edit Project Page →](./13-edit-project-page.md)

---

## Context

**This task adds inline editing for document metadata (title).** Users can click on the document title to edit it directly in the editor header, with autosave integration.

> **Note:** This task uses `lucide-react` for the edit icon. The icon package is already installed from previous tasks (verify with `npm ls lucide-react`).

### Prerequisites

- **Task 7** completed (Documents CRUD API with title update support - `08-documents-crud.md`)
- **Task 8** completed (Autosave hook for debounced saves - `09-autosave-hook.md`)
- **Task 10** completed (E2E test infrastructure - `11-e2e-tests.md`)

### What This Task Creates

- `src/hooks/__tests__/useEditableTitle.test.ts` - Hook tests
- `src/hooks/useEditableTitle.ts` - Title editing hook with autosave
- `src/hooks/index.ts` - Updated exports
- `src/components/editor/__tests__/EditableTitle.test.tsx` - Component tests
- `src/components/editor/EditableTitle.tsx` - Inline editable title component
- Updated `src/components/editor/DocumentEditor.tsx` - Integration with editable title
- `e2e/pages/EditorPage.ts` - Extended with title editing methods
- `e2e/editor/document-metadata.spec.ts` - E2E tests for title editing

### Tasks That Depend on This

- **Task 13** (Edit Project Page)
- **Verification** (Phase 1 completion)

---

## Files to Create/Modify

- `src/hooks/__tests__/useEditableTitle.test.ts` (create)
- `src/hooks/useEditableTitle.ts` (create)
- `src/hooks/index.ts` (modify - add export)
- `src/components/editor/__tests__/EditableTitle.test.tsx` (create)
- `src/components/editor/EditableTitle.tsx` (create)
- `src/components/editor/DocumentEditor.tsx` (modify)
- `src/components/editor/__tests__/DocumentEditor.test.tsx` (modify)
- `e2e/pages/EditorPage.ts` (modify)
- `e2e/editor/document-metadata.spec.ts` (create)

---

## Steps

### Step 12.1: Write failing test for useEditableTitle hook - initialization tests

Create `src/hooks/__tests__/useEditableTitle.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEditableTitle } from '../useEditableTitle';

describe('useEditableTitle', () => {
  const mockSave = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with provided title', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test Document', onSave: mockSave }));

      expect(result.current.title).toBe('Test Document');
      expect(result.current.isEditing).toBe(false);
    });

    it('should enter edit mode on startEditing', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
      });

      expect(result.current.isEditing).toBe(true);
    });

    it('should update title on setTitle', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('New Title');
      });

      expect(result.current.title).toBe('New Title');
    });
  });
});
```

### Step 12.2: Run test to verify it fails

```bash
npm test src/hooks/__tests__/useEditableTitle.test.ts
```

**Expected:** FAIL with "Cannot find module '../useEditableTitle'"

### Step 12.3: Add editing state transition tests

Append to `src/hooks/__tests__/useEditableTitle.test.ts`:

```typescript
describe('editing state transitions', () => {
  it('should save and exit edit mode on finishEditing', async () => {
    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('Updated Title');
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    expect(mockSave).toHaveBeenCalledWith('Updated Title');
    expect(result.current.isEditing).toBe(false);
  });

  it('should not save if title is unchanged', async () => {
    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('should revert to original title on cancelEditing', () => {
    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Original', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('Changed');
    });

    expect(result.current.title).toBe('Changed');

    act(() => {
      result.current.cancelEditing();
    });

    expect(result.current.title).toBe('Original');
    expect(result.current.isEditing).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('should track saving state', async () => {
    let resolveSave: () => void;
    mockSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('New Title');
    });

    // Start the save (don't await)
    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.finishEditing();
    });

    // Now isSaving should be true
    expect(result.current.isSaving).toBe(true);

    // Resolve the save
    await act(async () => {
      resolveSave!();
      await savePromise;
    });

    expect(result.current.isSaving).toBe(false);
  });
});
```

### Step 12.4: Add validation and error handling tests

Append to `src/hooks/__tests__/useEditableTitle.test.ts`:

```typescript
describe('validation and error handling', () => {
  it('should trim whitespace from title before saving', async () => {
    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('  Trimmed Title  ');
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    expect(mockSave).toHaveBeenCalledWith('Trimmed Title');
  });

  it('should not save empty title', async () => {
    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('');
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    expect(mockSave).not.toHaveBeenCalled();
    expect(result.current.title).toBe('Test'); // Reverts to original
  });

  it('should enforce maxLength and not save if exceeded', async () => {
    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave, maxLength: 10 }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('This is way too long');
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    // Should not save - title exceeds maxLength
    expect(mockSave).not.toHaveBeenCalled();
    expect(result.current.title).toBe('Test'); // Reverts to original
  });

  it('should handle save errors', async () => {
    mockSave.mockRejectedValue(new Error('Save failed'));

    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    act(() => {
      result.current.startEditing();
      result.current.setTitle('New Title');
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    expect(result.current.error?.message).toBe('Save failed');
    expect(result.current.isEditing).toBe(true); // Stay in edit mode on error
  });

  it('should clear error when starting new edit', async () => {
    mockSave.mockRejectedValueOnce(new Error('Save failed'));

    const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

    // First save fails
    act(() => {
      result.current.startEditing();
      result.current.setTitle('Failed');
    });

    await act(async () => {
      await result.current.finishEditing();
    });

    expect(result.current.error).not.toBeNull();

    // Cancel and start new edit
    act(() => {
      result.current.cancelEditing();
      result.current.startEditing();
    });

    expect(result.current.error).toBeNull();
  });
});
```

### Step 12.5: Add prop change and edge case tests

Append to `src/hooks/__tests__/useEditableTitle.test.ts`:

```typescript
describe('prop changes', () => {
  it('should update when initialTitle prop changes while not editing', () => {
    const { result, rerender } = renderHook(
      ({ initialTitle }) => useEditableTitle({ initialTitle, onSave: mockSave }),
      { initialProps: { initialTitle: 'First' } }
    );

    expect(result.current.title).toBe('First');

    rerender({ initialTitle: 'Second' });

    expect(result.current.title).toBe('Second');
  });

  it('should NOT update title when prop changes during active editing', () => {
    const { result, rerender } = renderHook(
      ({ initialTitle }) => useEditableTitle({ initialTitle, onSave: mockSave }),
      { initialProps: { initialTitle: 'First' } }
    );

    // Enter edit mode and make changes
    act(() => {
      result.current.startEditing();
      result.current.setTitle('User Edit');
    });

    // External update arrives
    rerender({ initialTitle: 'External Update' });

    // Should keep user's editing state, not overwrite
    expect(result.current.title).toBe('User Edit');
  });
});
```

### Step 12.6: Implement useEditableTitle hook

Create `src/hooks/useEditableTitle.ts`:

```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseEditableTitleOptions {
  initialTitle: string;
  onSave: (title: string) => Promise<void>;
  maxLength?: number;
}

export interface UseEditableTitleReturn {
  title: string;
  setTitle: (title: string) => void;
  isEditing: boolean;
  isSaving: boolean;
  error: Error | null;
  startEditing: () => void;
  finishEditing: () => Promise<void>;
  cancelEditing: () => void;
}

export function useEditableTitle({ initialTitle, onSave, maxLength }: UseEditableTitleOptions): UseEditableTitleReturn {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the original title when editing starts
  const originalTitleRef = useRef(initialTitle);

  // Track editing state for blur handler (avoids stale closure)
  const isEditingRef = useRef(isEditing);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Update title when prop changes (only when not editing)
  useEffect(() => {
    if (!isEditing) {
      setTitle(initialTitle);
      originalTitleRef.current = initialTitle;
    }
  }, [initialTitle, isEditing]);

  const startEditing = useCallback(() => {
    originalTitleRef.current = title;
    setIsEditing(true);
    setError(null);
  }, [title]);

  const finishEditing = useCallback(async () => {
    const trimmedTitle = title.trim();

    // Don't save empty titles
    if (!trimmedTitle) {
      setTitle(originalTitleRef.current);
      setIsEditing(false);
      return;
    }

    // Don't save if unchanged
    if (trimmedTitle === originalTitleRef.current) {
      setIsEditing(false);
      return;
    }

    // Validate maxLength if specified
    if (maxLength && trimmedTitle.length > maxLength) {
      setTitle(originalTitleRef.current);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedTitle);
      originalTitleRef.current = trimmedTitle;
      setTitle(trimmedTitle);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save title'));
      // Stay in edit mode on error so user can retry
    } finally {
      setIsSaving(false);
    }
  }, [title, onSave, maxLength]);

  const cancelEditing = useCallback(() => {
    setTitle(originalTitleRef.current);
    setIsEditing(false);
    setError(null);
  }, []);

  return {
    title,
    setTitle,
    isEditing,
    isSaving,
    error,
    startEditing,
    finishEditing,
    cancelEditing,
  };
}
```

### Step 12.7: Run hook tests to verify they pass

```bash
npm test src/hooks/__tests__/useEditableTitle.test.ts
```

**Expected:** PASS

### Step 12.8: Export hook from index

Add to `src/hooks/index.ts`:

```typescript
export { useEditableTitle } from './useEditableTitle';
export type { UseEditableTitleOptions, UseEditableTitleReturn } from './useEditableTitle';
```

### Step 12.9: Write failing test for EditableTitle component - display mode

Create `src/components/editor/__tests__/EditableTitle.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableTitle } from '../EditableTitle';

describe('EditableTitle Component', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe('Display Mode', () => {
    it('should render title as heading', () => {
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      expect(screen.getByRole('heading', { name: 'My Document' })).toBeInTheDocument();
    });

    it('should show edit button on hover/focus', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const container = screen.getByTestId('editable-title');
      await user.hover(container);

      expect(screen.getByRole('button', { name: /edit title/i })).toBeInTheDocument();
    });

    it('should enter edit mode on heading click', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('My Document');
    });

    it('should enter edit mode on edit button click', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const container = screen.getByTestId('editable-title');
      await user.hover(container);
      await user.click(screen.getByRole('button', { name: /edit title/i }));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should enter edit mode on Enter key when heading focused', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      heading.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should enter edit mode on Space key when heading focused', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      heading.focus();
      await user.keyboard(' ');

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
```

### Step 12.10: Run test to verify it fails

```bash
npm test src/components/editor/__tests__/EditableTitle.test.tsx
```

**Expected:** FAIL with "Cannot find module '../EditableTitle'"

### Step 12.11: Add edit mode tests

Append to `src/components/editor/__tests__/EditableTitle.test.tsx`:

```typescript
  describe('Edit Mode', () => {
    it('should focus input when entering edit mode', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('should select all text when entering edit mode', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe('My Document'.length);
    });

    it('should save on Enter key', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'New Title{Enter}');

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('New Title');
      });
    });

    it('should save on blur', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Blurred Title');
      await user.tab(); // Blur the input

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Blurred Title');
      });
    });

    it('should cancel on Escape key', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Cancelled');
      await user.keyboard('{Escape}');

      // Should revert and exit edit mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'My Document' })).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show saving indicator', async () => {
      mockOnSave.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Saving Title{Enter}');

      // Should show saving state
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });
    });

    it('should show error message on save failure', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Failed Title{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });

      // Should stay in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should return focus to heading after successful save', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'New Title{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });

      // Focus should be on the heading
      expect(screen.getByRole('heading')).toHaveFocus();
    });
  });
```

### Step 12.12: Add accessibility tests

Append to `src/components/editor/__tests__/EditableTitle.test.tsx`:

```typescript
  describe('Accessibility', () => {
    it('should have proper aria-label for input', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Document title');
    });

    it('should announce saving state to screen readers with role="status"', async () => {
      mockOnSave.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.type(screen.getByRole('textbox'), 'x{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('should announce errors with role="alert"', async () => {
      mockOnSave.mockRejectedValue(new Error('Save failed'));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.type(screen.getByRole('textbox'), 'x{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('should have heading with tabIndex for keyboard access', () => {
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      expect(heading).toHaveAttribute('tabIndex', '0');
    });

    it('should have aria-describedby on heading', () => {
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      expect(heading).toHaveAttribute('aria-describedby', 'edit-title-hint');
      // Note: The hint text is visually hidden (sr-only) but still in DOM
      expect(document.getElementById('edit-title-hint')).toBeInTheDocument();
    });
  });
```

### Step 12.13: Add validation tests

Append to `src/components/editor/__tests__/EditableTitle.test.tsx`:

```typescript
  describe('Validation', () => {
    it('should not allow empty title', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.keyboard('{Enter}');

      // Should revert to original and not save
      expect(mockOnSave).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'My Document' })).toBeInTheDocument();
    });

    it('should trim whitespace', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), '  Trimmed  {Enter}');

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Trimmed');
      });
    });

    it('should enforce max length', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} maxLength={20} />);

      await user.click(screen.getByRole('heading'));

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '20');
    });
  });
```

### Step 12.14: Implement EditableTitle component - display mode

Create `src/components/editor/EditableTitle.tsx`:

```typescript
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useEditableTitle } from '@/hooks/useEditableTitle';
import { Pencil } from 'lucide-react';

interface EditableTitleProps {
  title: string;
  onSave: (title: string) => Promise<void>;
  maxLength?: number;
  className?: string;
}

export function EditableTitle({
  title: initialTitle,
  onSave,
  maxLength = 255,
  className = '',
}: EditableTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Refs for timeout cleanup
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track editing state for blur handler (avoids stale closure)
  const isEditingRef = useRef(false);

  const {
    title,
    setTitle,
    isEditing,
    isSaving,
    error,
    startEditing,
    finishEditing,
    cancelEditing,
  } = useEditableTitle({ initialTitle, onSave, maxLength });

  // Keep ref in sync with state
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  // Focus and select all text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Return focus to heading after save/cancel
  const handleFinishEditing = useCallback(async () => {
    await finishEditing();
    // Focus heading after save completes (when not in error state)
    // Clear any existing timeout first
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      if (!isEditingRef.current && headingRef.current) {
        headingRef.current.focus();
      }
    }, 0);
  }, [finishEditing]);

  const handleCancelEditing = useCallback(() => {
    cancelEditing();
    // Focus heading after cancel
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      headingRef.current?.focus();
    }, 0);
  }, [cancelEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFinishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEditing();
      }
    },
    [handleFinishEditing, handleCancelEditing]
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow click events to fire first
    // Use ref to check current editing state (avoids stale closure)
    // Clear any existing timeout first
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      if (isEditingRef.current) {
        handleFinishEditing();
      }
    }, 100);
  }, [handleFinishEditing]);

  const handleHeadingKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startEditing();
      }
    },
    [startEditing]
  );

  if (isEditing) {
    return (
      <div data-testid="editable-title" className={`relative ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          maxLength={maxLength}
          aria-label="Document title"
          className="w-full text-2xl font-semibold bg-transparent border-b-2 border-[var(--color-accent-primary)] focus:outline-none px-1 py-0.5"
          style={{ fontFamily: 'var(--font-heading)' }}
        />
        {isSaving && (
          <span
            role="status"
            aria-live="polite"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-tertiary)]"
          >
            Saving...
          </span>
        )}
        {error && (
          <p className="text-sm text-[var(--color-error)] mt-1" role="alert">
            Failed to save title. Press Enter to retry.
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="editable-title" className={`group relative flex items-center gap-2 ${className}`}>
      <h1
        ref={headingRef}
        className="text-2xl font-semibold text-[var(--color-ink-primary)] px-1 py-0.5 cursor-pointer rounded hover:bg-[var(--color-surface-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
        style={{ fontFamily: 'var(--font-heading)' }}
        onClick={startEditing}
        onKeyDown={handleHeadingKeyDown}
        tabIndex={0}
        aria-describedby="edit-title-hint"
      >
        {title}
      </h1>
      <span id="edit-title-hint" className="sr-only">
        Click or press Enter to edit
      </span>
      <button
        type="button"
        onClick={startEditing}
        aria-label="Edit title"
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-surface-secondary)]"
      >
        <Pencil size={16} className="text-[var(--color-ink-tertiary)]" />
      </button>
    </div>
  );
}
```

### Step 12.15: Run component tests to verify they pass

```bash
npm test src/components/editor/__tests__/EditableTitle.test.tsx
```

**Expected:** PASS

### Step 12.16: Integrate EditableTitle into DocumentEditor

Modify `src/components/editor/DocumentEditor.tsx`.

Add import at line 5 (after SaveStatus import):

```typescript
import { EditableTitle } from './EditableTitle';
```

Add title save handler after the existing `saveContent` function (around line 107):

```typescript
// Save title function
const saveTitle = useCallback(
  async (newTitle: string) => {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: newTitle,
      }),
    });

    const data: ApiResponse | Document = await response.json();

    if (!response.ok) {
      throw new Error((data as ApiResponse).error || 'Failed to save title');
    }

    const savedDoc = data as Document;
    setDocument(savedDoc);
    setVersion(savedDoc.version ?? version + 1); // Update version to prevent conflicts
    onSave?.(savedDoc);
  },
  [documentId, version, onSave]
);
```

Update the return statement (around line 153) to include the EditableTitle:

```typescript
return (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <EditableTitle
        title={document?.title || 'Untitled Document'}
        onSave={saveTitle}
      />
      <SaveStatus status={status} lastSavedAt={lastSavedAt} error={error} onRetry={handleRetry} />
    </div>
    <Editor
      content={initialContent}
      placeholder={placeholder}
      characterLimit={characterLimit}
      onChange={handleChange}
    />
  </div>
);
```

**Note:** Use `||` instead of `??` for title fallback to handle empty string `''` case.

### Step 12.17: Update DocumentEditor tests

Modify `src/components/editor/__tests__/DocumentEditor.test.tsx` to add title editing tests.

Add to imports:

```typescript
import userEvent from '@testing-library/user-event';
```

Add test describe block:

```typescript
describe('Title Editing', () => {
  it('should display document title', async () => {
    const mockDocument = {
      id: 'doc-123',
      title: 'Test Document',
      content: { type: 'doc', content: [] },
      version: 1,
    };

    render(<DocumentEditor documentId="doc-123" initialDocument={mockDocument} />);

    expect(screen.getByRole('heading', { name: 'Test Document' })).toBeInTheDocument();
  });

  it('should allow editing title inline', async () => {
    const user = userEvent.setup();
    const mockDocument = {
      id: 'doc-123',
      title: 'Original Title',
      content: { type: 'doc', content: [] },
      version: 1,
    };

    render(<DocumentEditor documentId="doc-123" initialDocument={mockDocument} />);

    await user.click(screen.getByRole('heading', { name: 'Original Title' }));

    expect(screen.getByRole('textbox', { name: /document title/i })).toBeInTheDocument();
  });

  it('should show Untitled Document for empty title', () => {
    const mockDocument = {
      id: 'doc-123',
      title: '',
      content: { type: 'doc', content: [] },
      version: 1,
    };

    render(<DocumentEditor documentId="doc-123" initialDocument={mockDocument} />);

    expect(screen.getByRole('heading', { name: 'Untitled Document' })).toBeInTheDocument();
  });
});
```

### Step 12.18: Run all DocumentEditor tests

```bash
npm test src/components/editor/__tests__/DocumentEditor.test.tsx
```

**Expected:** PASS

### Step 12.19: Extend EditorPage Page Object for E2E tests

Modify `e2e/pages/EditorPage.ts` to add title editing methods.

First, check current file structure. Add new locators in the class properties section (look for other `readonly` locator declarations):

```typescript
// Title editing
readonly documentTitle: Locator;
readonly titleInput: Locator;
readonly titleEditButton: Locator;
readonly titleSavingIndicator: Locator;
readonly titleError: Locator;
```

Initialize them in the constructor (add after other locator initializations):

```typescript
// Title editing
this.documentTitle = page.getByTestId('editable-title').getByRole('heading');
this.titleInput = page.getByRole('textbox', { name: 'Document title' });
this.titleEditButton = page.getByRole('button', { name: /edit title/i });
this.titleSavingIndicator = page.getByTestId('editable-title').getByText(/saving/i);
this.titleError = page.getByTestId('editable-title').getByRole('alert');
```

Add new methods at end of class (before closing brace):

```typescript
/**
 * Get the current document title.
 */
async getDocumentTitle(): Promise<string> {
  return (await this.documentTitle.textContent()) || '';
}

/**
 * Edit the document title.
 */
async editTitle(newTitle: string) {
  // Click title to enter edit mode
  await this.documentTitle.click();

  // Wait for input to appear
  await this.titleInput.waitFor({ state: 'visible', ...VISIBILITY_WAIT });

  // Clear and type new title
  await this.titleInput.clear();
  await this.titleInput.fill(newTitle);

  // Press Enter to save
  await this.page.keyboard.press('Enter');
}

/**
 * Cancel title editing with Escape.
 */
async cancelTitleEdit() {
  await this.page.keyboard.press('Escape');
}

/**
 * Wait for title save to complete.
 */
async waitForTitleSaved() {
  // Wait for input to disappear (means save completed)
  await this.titleInput.waitFor({ state: 'hidden', ...API_CALL_WAIT });
}

/**
 * Expect title to have specific value.
 */
async expectTitle(expected: string) {
  await expect(this.documentTitle).toContainText(expected);
}

/**
 * Expect title save error.
 */
async expectTitleError() {
  await expect(this.titleError).toBeVisible(API_CALL_WAIT);
}
```

**Note:** Make sure to import `VISIBILITY_WAIT` and `API_CALL_WAIT` from `../config/timeouts` if not already imported.

### Step 12.20: Create E2E test file with setup and helpers

Create `e2e/editor/document-metadata.spec.ts`:

```typescript
/**
 * Document Metadata E2E tests
 *
 * Tests for editing document metadata (title) including:
 * - Inline title editing
 * - Save on Enter and blur
 * - Cancel on Escape
 * - Error handling
 * - Accessibility
 */
import { test, expect } from '../fixtures/test-fixtures';
import { VISIBILITY_WAIT, API_CALL_WAIT } from '../config/timeouts';
import { EditorPage } from '../pages/EditorPage';
import { checkA11y } from '../helpers/axe';

// Original title to reset to between tests
const ORIGINAL_TITLE = 'Original Document Title';

// Helper to create a test project via API
async function createTestProject(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      title: `E2E Metadata Test ${Date.now()}`,
      description: 'Test project for metadata E2E tests',
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()}`);
  }

  const project = await response.json();
  return project.id;
}

// Helper to create a test document via API
async function createTestDocument(
  page: import('@playwright/test').Page,
  projectId: string,
  title: string
): Promise<string> {
  const response = await page.request.post('/api/documents', {
    data: {
      project_id: projectId,
      title,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create document: ${response.status()}`);
  }

  const document = await response.json();
  return document.id;
}

// Helper to reset document title via API
async function resetDocumentTitle(page: import('@playwright/test').Page, documentId: string): Promise<void> {
  const response = await page.request.patch(`/api/documents/${documentId}`, {
    data: { title: ORIGINAL_TITLE },
  });
  if (!response.ok()) {
    throw new Error(`Failed to reset document title: ${response.status()}`);
  }
}

// Helper to delete project via API (cleanup)
async function deleteTestProject(page: import('@playwright/test').Page, projectId: string): Promise<void> {
  await page.request.delete(`/api/projects/${projectId}`);
}

test.describe('Document Metadata Editing', () => {
  // Test data scoped to this file
  let testProjectId: string;
  let testDocumentId: string;

  // Create test project and document once for all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    // Create project via API
    testProjectId = await createTestProject(page);

    // Create document via API with known title
    testDocumentId = await createTestDocument(page, testProjectId, ORIGINAL_TITLE);

    await context.close();
  });

  // Cleanup after all tests
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    // Delete test project (cascades to documents)
    await deleteTestProject(page, testProjectId);

    await context.close();
  });

  test.describe('Title Display', () => {
    test('should display document title in editor header', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      await editorPage.expectTitle(ORIGINAL_TITLE);
    });

    test('should show edit button on hover', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Hover over title
      await page.getByTestId('editable-title').hover();

      // Edit button should be visible
      await expect(editorPage.titleEditButton).toBeVisible(VISIBILITY_WAIT);
    });
  });

  test.describe('Title Editing', () => {
    // Reset title before each test to ensure consistent state
    test.beforeEach(async ({ page }) => {
      await resetDocumentTitle(page, testDocumentId);
    });

    test('should enter edit mode on title click', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Click title
      await editorPage.documentTitle.click();

      // Input should appear with title value
      await expect(editorPage.titleInput).toBeVisible();
      await expect(editorPage.titleInput).toHaveValue(ORIGINAL_TITLE);
    });

    test('should enter edit mode on edit button click', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Hover to show edit button
      await page.getByTestId('editable-title').hover();

      // Click edit button
      await editorPage.titleEditButton.click();

      // Input should appear
      await expect(editorPage.titleInput).toBeVisible();
    });

    test('should focus and select text when entering edit mode', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Click title
      await editorPage.documentTitle.click();

      // Input should be focused
      await expect(editorPage.titleInput).toBeFocused();
    });

    test('should save title on Enter', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Edit title
      const newTitle = `Updated Title ${Date.now()}`;
      await editorPage.editTitle(newTitle);

      // Wait for save to complete
      await editorPage.waitForTitleSaved();

      // Title should be updated
      await editorPage.expectTitle(newTitle);
    });

    test('should save title on blur', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();

      const newTitle = `Blur Save Title ${Date.now()}`;
      await editorPage.titleInput.fill(newTitle);

      // Click elsewhere to blur
      await editorPage.editor.click();

      // Wait for save using auto-waiting assertion
      await editorPage.waitForTitleSaved();

      // Title should be updated
      await editorPage.expectTitle(newTitle);
    });

    test('should cancel edit on Escape', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      await editorPage.titleInput.fill('Cancelled Title');

      // Press Escape
      await editorPage.cancelTitleEdit();

      // Should exit edit mode without saving
      await expect(editorPage.titleInput).not.toBeVisible();

      // Title should be unchanged
      await editorPage.expectTitle(ORIGINAL_TITLE);
    });

    test('should not save empty title', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();

      // Press Enter with empty title
      await page.keyboard.press('Enter');

      // Should exit edit mode and revert
      await expect(editorPage.titleInput).not.toBeVisible();
      await editorPage.expectTitle(ORIGINAL_TITLE);
    });

    test('should trim whitespace from title', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Edit with whitespace
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      await editorPage.titleInput.fill('  Trimmed Title  ');
      await page.keyboard.press('Enter');

      // Wait for save
      await editorPage.waitForTitleSaved();

      // Title should be trimmed
      await editorPage.expectTitle('Trimmed Title');
    });
  });

  test.describe('Title Persistence', () => {
    test('should persist title after page reload', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Edit title
      const persistentTitle = `Persistent Title ${Date.now()}`;
      await editorPage.editTitle(persistentTitle);
      await editorPage.waitForTitleSaved();

      // Reload page
      await page.reload();
      await editorPage.waitForEditorReady();

      // Title should persist
      await editorPage.expectTitle(persistentTitle);
    });
  });

  test.describe('Error Handling', () => {
    test('should show error on save failure', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/documents/**', async (route) => {
        if (route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON();
          // Only fail title updates
          if (body?.title) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Internal server error' }),
            });
            return;
          }
        }
        await route.continue();
      });

      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Try to edit title
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      await editorPage.titleInput.fill('Failed Title');
      await page.keyboard.press('Enter');

      // Should show error
      await editorPage.expectTitleError();

      // Should stay in edit mode
      await expect(editorPage.titleInput).toBeVisible();
    });

    test('should allow retry after error', async ({ page }) => {
      let failCount = 0;

      // Mock API failure on first attempt, success on retry
      await page.route('**/api/documents/**', async (route) => {
        if (route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON();
          if (body?.title && failCount === 0) {
            failCount++;
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Temporary error' }),
            });
            return;
          }
        }
        await route.continue();
      });

      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // First attempt fails
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      const newTitle = `Retry Title ${Date.now()}`;
      await editorPage.titleInput.fill(newTitle);
      await page.keyboard.press('Enter');

      // Wait for error
      await editorPage.expectTitleError();

      // Retry (press Enter again)
      await page.keyboard.press('Enter');

      // Should succeed this time
      await editorPage.waitForTitleSaved();
      await editorPage.expectTitle(newTitle);
    });
  });

  test.describe('Accessibility', () => {
    test('should pass accessibility audit in display mode', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Run accessibility check - fail on violations
      await checkA11y(page, { detailedReport: true });
    });

    test('should pass accessibility audit in edit mode', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();

      // Run accessibility check - fail on violations
      await checkA11y(page, { detailedReport: true });
    });

    test('should have proper aria-label on title input', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();

      await expect(editorPage.titleInput).toHaveAttribute('aria-label', 'Document title');
    });

    test('should support keyboard navigation', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Focus editable title heading
      const heading = page.getByTestId('editable-title').getByRole('heading');
      await heading.focus();

      // Press Enter to activate edit mode
      await page.keyboard.press('Enter');

      // Input should be visible and focused
      await expect(editorPage.titleInput).toBeVisible();
      await expect(editorPage.titleInput).toBeFocused();
    });
  });
});
```

### Step 12.21: Run E2E tests for document metadata

```bash
npx playwright test e2e/editor/document-metadata.spec.ts
```

**Expected:** PASS

### Step 12.22: Run all tests

```bash
npm test && npx playwright test
```

**Expected:** All unit and E2E tests pass

### Step 12.23: Commit

```bash
git add src/hooks/useEditableTitle.ts src/hooks/__tests__/useEditableTitle.test.ts src/hooks/index.ts src/components/editor/EditableTitle.tsx src/components/editor/__tests__/EditableTitle.test.tsx src/components/editor/DocumentEditor.tsx src/components/editor/__tests__/DocumentEditor.test.tsx e2e/pages/EditorPage.ts e2e/editor/document-metadata.spec.ts
git commit -m "feat: add inline document title editing with validation and error handling"
```

---

## Verification Checklist

- [ ] useEditableTitle hook tests pass (including prop change during editing test)
- [ ] Hook handles editing state transitions correctly
- [ ] Hook validates empty titles
- [ ] Hook validates maxLength (in logic, not just HTML attribute)
- [ ] Hook trims whitespace
- [ ] Hook handles save errors gracefully
- [ ] Hook clears error when starting new edit
- [ ] EditableTitle component tests pass
- [ ] Component shows title as heading in display mode
- [ ] Component shows edit button on hover
- [ ] Component enters edit mode on click or keyboard
- [ ] Component saves on Enter and blur
- [ ] Component cancels on Escape
- [ ] Component shows saving indicator with role="status"
- [ ] Component shows error state with role="alert"
- [ ] Component returns focus to heading after save/cancel
- [ ] Component has proper ARIA attributes (aria-describedby, tabIndex)
- [ ] Component cleans up timeouts on unmount (no memory leaks)
- [ ] No nested interactive elements (heading is clickable, not wrapped in button)
- [ ] DocumentEditor integrates EditableTitle
- [ ] DocumentEditor updates version after title save
- [ ] DocumentEditor uses `||` for empty title fallback
- [ ] Hook exported from src/hooks/index.ts
- [ ] EditorPage Page Object extended with title methods
- [ ] EditorPage uses VISIBILITY_WAIT and API_CALL_WAIT consistently
- [ ] E2E tests reset document state in beforeEach
- [ ] E2E tests clean up test data in afterAll
- [ ] E2E tests use auto-waiting assertions (not hardcoded timeouts)
- [ ] E2E tests cover display, editing, persistence, errors
- [ ] E2E accessibility tests run without skipFailures
- [ ] All tests pass
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 13: Edit Project Page](./13-edit-project-page.md)**.
