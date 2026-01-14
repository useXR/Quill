# Task 8: Autosave Hook

> **Phase 1** | [← Documents CRUD](./08-documents-crud.md) | [Next: Word Count →](./10-word-count.md)

---

## Context

**This task implements autosave with debouncing and retry logic.** Saves documents automatically after user stops typing, with visual feedback.

> **Note:** This task uses constants from `@/lib/constants` for debounce timing and retry limits, and uses lodash `isEqual` for deep comparison to avoid unnecessary saves.

### Prerequisites

- **Task 3** completed (Editor with toolbar)
- **Task 7** completed (Documents update API)

### What This Task Creates

- `src/hooks/__tests__/useAutosave.test.ts` - Autosave hook tests
- `src/hooks/useAutosave.ts` - Autosave hook
- `src/components/editor/SaveStatus.tsx` - Save status indicator
- `src/components/editor/DocumentEditor.tsx` - Document editor with autosave

### Tasks That Depend on This

- **Task 9** (Word Count) - Integrates with DocumentEditor

---

## Files to Create/Modify

- `src/hooks/__tests__/useAutosave.test.ts` (create)
- `src/hooks/useAutosave.ts` (create)
- `src/components/editor/__tests__/SaveStatus.test.tsx` (create)
- `src/components/editor/SaveStatus.tsx` (create)
- `src/components/editor/__tests__/DocumentEditor.test.tsx` (create)
- `src/components/editor/DocumentEditor.tsx` (create)

---

## Steps

### Step 8.1: Write failing test for useAutosave

Create `src/hooks/__tests__/useAutosave.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAutosave, SaveStatus } from '../useAutosave';

// Mock timers for debounce testing
vi.useFakeTimers();

describe('useAutosave', () => {
  const mockSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should start with idle status', () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 1000 }));

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('should debounce saves by configured ms', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 1000 }));

    // Trigger multiple saves rapidly
    act(() => {
      result.current.triggerSave('content 1');
      result.current.triggerSave('content 2');
      result.current.triggerSave('content 3');
    });

    // Should show pending status
    expect(result.current.status).toBe('pending');

    // Should not have called save yet
    expect(mockSave).not.toHaveBeenCalled();

    // Advance timers past debounce
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Should only save once with latest content
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('content 3');
  });

  it('should retry with exponential backoff on failure', async () => {
    mockSave
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 100, maxRetries: 3 }));

    act(() => {
      result.current.triggerSave('content');
    });

    // Initial attempt
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('error');

    // First retry (1000ms backoff)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockSave).toHaveBeenCalledTimes(2);

    // Second retry (2000ms backoff)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('saved');
  });

  it('should save immediately on saveNow()', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 5000 }));

    act(() => {
      result.current.triggerSave('content');
    });

    // Don't wait for debounce, call saveNow
    await act(async () => {
      await result.current.saveNow();
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('content');
  });

  it('should track lastSavedAt timestamp', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 100 }));

    expect(result.current.lastSavedAt).toBeNull();

    act(() => {
      result.current.triggerSave('content');
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });
});
```

### Step 8.2: Run test to verify it fails

```bash
npm test src/hooks/__tests__/useAutosave.test.ts
```

**Expected:** FAIL with "Cannot find module '../useAutosave'"

### Step 8.3: Implement useAutosave hook

Create `src/hooks/useAutosave.ts`:

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { EDITOR } from '@/lib/constants';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  save: (content: string) => Promise<void>;
  debounceMs?: number;
  maxRetries?: number;
  saveOnBlur?: boolean;
}

interface UseAutosaveReturn {
  triggerSave: (content: string) => void;
  saveNow: () => Promise<void>;
  status: SaveStatus;
  error: Error | null;
  lastSavedAt: Date | null;
}

export function useAutosave({
  save,
  debounceMs = EDITOR.AUTOSAVE_DEBOUNCE_MS,
  maxRetries = EDITOR.MAX_RETRIES,
  saveOnBlur = true,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pendingContentRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSave = useCallback(
    async (content: string) => {
      setStatus('saving');
      setError(null);

      try {
        await save(content);
        setStatus('saved');
        setLastSavedAt(new Date());
        lastSavedContentRef.current = content;
        retryCountRef.current = 0;
        pendingContentRef.current = null;
      } catch (err) {
        const saveError = err instanceof Error ? err : new Error('Save failed');

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setStatus('error');

          // Exponential backoff: 1s, 2s, 4s...
          const backoffMs = Math.pow(2, retryCountRef.current - 1) * 1000;

          retryTimerRef.current = setTimeout(() => {
            performSave(content);
          }, backoffMs);
        } else {
          setStatus('error');
          setError(saveError);
          retryCountRef.current = 0;
        }
      }
    },
    [save, maxRetries]
  );

  const triggerSave = useCallback(
    (content: string) => {
      // Skip if content hasn't changed (deep equality check)
      if (isEqual(content, lastSavedContentRef.current)) {
        return;
      }

      pendingContentRef.current = content;
      setStatus('pending');

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        if (pendingContentRef.current !== null) {
          performSave(pendingContentRef.current);
        }
      }, debounceMs);
    },
    [debounceMs, performSave]
  );

  const saveNow = useCallback(async () => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Save immediately if there's pending content
    if (pendingContentRef.current !== null) {
      await performSave(pendingContentRef.current);
    }
  }, [performSave]);

  // Handle window blur
  useEffect(() => {
    if (!saveOnBlur) return;

    const handleBlur = () => {
      if (pendingContentRef.current !== null) {
        // Clear debounce and save immediately
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        performSave(pendingContentRef.current);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [saveOnBlur, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return {
    triggerSave,
    saveNow,
    status,
    error,
    lastSavedAt,
  };
}
```

### Step 8.4: Run test to verify it passes

```bash
npm test src/hooks/__tests__/useAutosave.test.ts
```

**Expected:** PASS

### Step 8.5: Create SaveStatus component

Create `src/components/editor/SaveStatus.tsx` with visual status indicator.

See original plan for full implementation.

### Step 8.6: Create DocumentEditor component

Create `src/components/editor/DocumentEditor.tsx` integrating editor with autosave.

See original plan for full implementation.

### Step 8.7: Run all autosave tests

```bash
npm test -- --testPathPattern="(useAutosave|SaveStatus|DocumentEditor)"
```

**Expected:** PASS

### Step 8.8: Commit

```bash
git add src/hooks src/components/editor/SaveStatus.tsx src/components/editor/DocumentEditor.tsx
git commit -m "feat: add autosave hook with debouncing, retry, and conflict detection"
```

---

## Verification Checklist

- [ ] useAutosave hook tests pass
- [ ] Uses constants from `@/lib/constants` for defaults
- [ ] Deep equality check skips unchanged content (lodash `isEqual`)
- [ ] Debouncing works correctly
- [ ] Retry with exponential backoff works
- [ ] SaveNow triggers immediate save
- [ ] SaveStatus displays correctly for all states
- [ ] DocumentEditor integrates autosave
- [ ] Version tracking for conflict detection
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 9: Word/Character Count](./10-word-count.md)**.
