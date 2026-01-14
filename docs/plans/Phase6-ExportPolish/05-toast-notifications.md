# Task 6.5: Toast Notifications

> **Phase 6** | [← Loading States & Error Handling](./04-loading-error-handling.md) | [Next: Command Palette →](./06-command-palette.md)

---

## Context

**This task implements a toast notification system using Zustand for state management.** Users receive visual feedback for actions like saving, errors, and success messages.

### Prerequisites

- **Task 6.3** completed (App Shell & Navigation)

### What This Task Creates

- `src/lib/constants/toast.ts` - Toast configuration constants
- `src/hooks/useToast.ts` - Zustand-based toast state
- `src/hooks/__tests__/useToast.test.ts` - Hook tests
- `src/components/ui/Toast.tsx` - Toast container component
- `src/components/ui/__tests__/Toast.test.tsx` - Component tests

### Tasks That Depend on This

- **Task 6.6** (Command Palette) - Toast integration
- **Task 6.7** (E2E Tests) - Toast flow testing

### Parallel Tasks

This task can be done in parallel with:

- **Task 6.4** (Loading States & Error Handling)

---

## Files to Create/Modify

- `src/lib/constants/toast.ts` (create)
- `src/hooks/useToast.ts` (create)
- `src/hooks/__tests__/useToast.test.ts` (create)
- `src/components/ui/Toast.tsx` (create)
- `src/components/ui/__tests__/Toast.test.tsx` (create)

---

## Steps

### Step 1: Create toast constants

Create `src/lib/constants/toast.ts`:

```typescript
/**
 * Toast notification constants.
 * Following best practice: use constants files for magic values.
 */
export const TOAST = {
  /**
   * Auto-dismiss timeout for success, info, and warning toasts.
   * 5 seconds is standard for non-critical notifications.
   */
  DEFAULT_TIMEOUT_MS: 5000,

  /**
   * Extended timeout for error toasts.
   * 10 seconds per WCAG 2.2.1 (Timing Adjustable) - users need more
   * time to read and understand error messages.
   */
  ERROR_TIMEOUT_MS: 10000,

  /**
   * Maximum number of toasts visible at once.
   * Prevents toast spam from overwhelming the UI.
   */
  MAX_VISIBLE: 5,
} as const;
```

### Step 2: Create useToast hook with Zustand

Create `src/hooks/useToast.ts`:

```typescript
'use client';

import { create } from 'zustand';
import { TOAST } from '@/lib/constants/toast';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => {
      // Limit visible toasts to prevent UI overflow
      const newToasts = [...state.toasts, { id, message, type }];
      if (newToasts.length > TOAST.MAX_VISIBLE) {
        newToasts.shift(); // Remove oldest toast
      }
      return { toasts: newToasts };
    });

    // Use appropriate timeout based on toast type (WCAG 2.2.1 compliance)
    const timeout = type === 'error' ? TOAST.ERROR_TIMEOUT_MS : TOAST.DEFAULT_TIMEOUT_MS;

    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, timeout);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
```

### Step 3: Create ToastContainer component with accessibility and touch targets

Create `src/components/ui/Toast.tsx`:

```typescript
'use client';

import { useToast } from '@/hooks/useToast';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 space-y-2"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 border rounded-lg shadow-lg min-w-[300px] max-w-[400px] animate-slide-in motion-reduce:animate-none ${styles[toast.type]}`}
            role="alert"
          >
            <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded hover:bg-black/5 transition-colors motion-reduce:transition-none"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

### Step 4: Add toast animation to globals.css

Add to `src/app/globals.css`:

```css
/* Toast slide-in animation */
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.2s ease-out;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .animate-slide-in {
    animation: none;
  }
}
```

### Step 5: Write tests for useToast hook

Create `src/hooks/__tests__/useToast.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToast } from '../useToast';
import { TOAST } from '@/lib/constants/toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the store between tests
    const { result } = renderHook(() => useToast());
    result.current.toasts.forEach((t) => result.current.removeToast(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('removes a toast manually', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-removes success toast after DEFAULT_TIMEOUT_MS', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-removes error toast after ERROR_TIMEOUT_MS', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Error', 'error');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS);
    });

    // Still there after default timeout
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(TOAST.ERROR_TIMEOUT_MS - TOAST.DEFAULT_TIMEOUT_MS);
    });

    // Gone after error timeout
    expect(result.current.toasts).toHaveLength(0);
  });

  it('generates unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('First', 'success');
      result.current.addToast('Second', 'success');
    });

    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });

  it('limits visible toasts to MAX_VISIBLE', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      for (let i = 0; i < TOAST.MAX_VISIBLE + 2; i++) {
        result.current.addToast(`Toast ${i}`, 'info');
      }
    });

    expect(result.current.toasts).toHaveLength(TOAST.MAX_VISIBLE);
  });
});
```

### Step 6: Run tests to verify useToast works

```bash
npm test -- src/hooks/__tests__/useToast.test.ts
```

**Expected:** All tests PASS

### Step 7: Write tests for ToastContainer component

Create `src/components/ui/__tests__/Toast.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastContainer } from '../Toast';
import { useToast } from '@/hooks/useToast';

// Mock the useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(),
}));

describe('ToastContainer', () => {
  const mockRemoveToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no toasts', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    const { container } = render(<ToastContainer />);
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('renders toast with message', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test message', type: 'success' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [
        { id: '1', message: 'First', type: 'success' },
        { id: '2', message: 'Second', type: 'error' },
      ],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('calls removeToast when dismiss clicked', async () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test', type: 'success' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockRemoveToast).toHaveBeenCalledWith('1');
  });

  it('has correct ARIA attributes', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test', type: 'info' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);

    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies correct styles for each toast type', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Error', type: 'error' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    const toast = screen.getByRole('alert');
    expect(toast).toHaveClass('bg-red-50');
  });

  it('dismiss button meets touch target requirements', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test', type: 'success' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    const button = screen.getByRole('button', { name: /dismiss/i });

    expect(button).toHaveClass('min-h-[44px]');
    expect(button).toHaveClass('min-w-[44px]');
  });

  it('respects reduced motion preference', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Test', type: 'success' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    const toast = screen.getByRole('alert');

    expect(toast).toHaveClass('motion-reduce:animate-none');
  });
});
```

### Step 8: Run tests to verify ToastContainer works

```bash
npm test -- src/components/ui/__tests__/Toast.test.tsx
```

**Expected:** All tests PASS

### Step 8.5: Update stores barrel export

Phase 3 established `src/lib/stores/index.ts` for Zustand stores. Update it to include the toast store:

Update `src/lib/stores/index.ts`:

```typescript
// Existing store exports...
export { useDocumentStore } from './document-store';
export { useEditorStore } from './editor-store';

// Toast store - re-export from hooks for consistency
// (The actual store lives in hooks for co-location with the hook)
export { useToast } from '@/hooks/useToast';
```

**Note:** If your toast store is a standalone Zustand store (not a hook), move it to `src/lib/stores/toast-store.ts` and update the exports accordingly:

```typescript
// Alternative: If using standalone store file
export { useToastStore } from './toast-store';
```

### Step 9: Commit

```bash
git add src/lib/constants/toast.ts src/hooks/useToast.ts src/hooks/__tests__/useToast.test.ts src/components/ui/Toast.tsx src/components/ui/__tests__/Toast.test.tsx src/app/globals.css
git commit -m "feat: add toast notification system

- Add TOAST constants for timeouts (avoiding magic numbers)
- Add Zustand-based useToast hook
- Add ToastContainer with accessibility (aria-live, role=alert)
- Success toasts auto-dismiss after 5s
- Error toasts auto-dismiss after 10s (WCAG 2.2.1 compliance)
- Limit max visible toasts to prevent UI overflow
- Dismiss button meets 44x44px touch target
- Animation respects prefers-reduced-motion"
```

**Expected:** Commit created successfully

---

## Verification Checklist

- [ ] TOAST constants defined (DEFAULT_TIMEOUT_MS, ERROR_TIMEOUT_MS, MAX_VISIBLE)
- [ ] useToast hook creates Zustand store
- [ ] Toast store added to `src/lib/stores/index.ts` barrel export
- [ ] addToast adds toast with unique ID
- [ ] removeToast removes specific toast
- [ ] Success toasts auto-dismiss after DEFAULT_TIMEOUT_MS (5s)
- [ ] Error toasts auto-dismiss after ERROR_TIMEOUT_MS (10s) per WCAG 2.2.1
- [ ] Max visible toasts limited to MAX_VISIBLE
- [ ] ToastContainer renders all active toasts
- [ ] Toast types have correct styling (success=green, error=red, etc.)
- [ ] Dismiss button removes toast immediately
- [ ] Dismiss button meets 44x44px touch target
- [ ] ARIA attributes for accessibility (aria-live="polite", role="alert")
- [ ] Animation respects prefers-reduced-motion
- [ ] All tests pass
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 6.6: Command Palette](./06-command-palette.md)**.
