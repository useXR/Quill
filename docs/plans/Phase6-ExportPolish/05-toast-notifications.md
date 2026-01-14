# Task 6.5: Toast Notifications

> **Phase 6** | [← Loading States & Error Handling](./04-loading-error-handling.md) | [Next: Command Palette →](./06-command-palette.md)

---

## Design System Context

Toast notifications follow the **Scholarly Craft** aesthetic with understated, professional feedback that doesn't disrupt focused writing.

### Key Design Tokens for This Task

| Toast Type | Background                   | Border              | Text                          | Icon Color     |
| ---------- | ---------------------------- | ------------------- | ----------------------------- | -------------- |
| Success    | `bg-success-light` (#dcfce7) | `border-success/20` | `text-success-dark` (#14532d) | `text-success` |
| Error      | `bg-error-light` (#fee2e2)   | `border-error/20`   | `text-error-dark` (#7f1d1d)   | `text-error`   |
| Warning    | `bg-warning-light` (#fef3c7) | `border-warning/20` | `text-warning-dark` (#854d0e) | `text-warning` |
| Info       | `bg-info-light` (#dbeafe)    | `border-info/20`    | `text-info-dark` (#1e3a8a)    | `text-info`    |

### Typography

- **Toast Message:** `font-ui text-sm` (Source Sans 3, 14px)
- **No headings in toasts** - keep messages concise

### Layout & Spacing

- **Container:** Fixed bottom-right, `z-50`, `space-y-2`
- **Toast:** `px-4 py-3`, `min-w-[300px] max-w-[400px]`, `rounded-lg`, `shadow-lg`
- **Dismiss Button:** 44x44px touch target (`min-h-[44px] min-w-[44px]`)

### Animation

- **Slide-in:** `animate-slide-in` (custom keyframe, 0.2s ease-out)
- **Reduced Motion:** `motion-reduce:animate-none`

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

/**
 * Toast notification container with Scholarly Craft styling.
 * Uses semantic design tokens for each toast type (success, error, warning, info).
 */

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

// Design system semantic colors for toast types
const styles = {
  success: 'bg-success-light border-success/20 text-success-dark',
  error: 'bg-error-light border-error/20 text-error-dark',
  info: 'bg-info-light border-info/20 text-info-dark',
  warning: 'bg-warning-light border-warning/20 text-warning-dark',
};

const iconStyles = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-info',
  warning: 'text-warning',
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
            className={`flex items-center gap-3 px-4 py-3 border rounded-lg shadow-lg min-w-[300px] max-w-[400px] animate-slide-in motion-reduce:animate-none font-ui text-sm ${styles[toast.type]}`}
            role="alert"
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${iconStyles[toast.type]}`} aria-hidden="true" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-md hover:bg-black/5 transition-colors motion-reduce:transition-none"
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

  it('applies correct design system styles for each toast type', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: '1', message: 'Error', type: 'error' }],
      addToast: vi.fn(),
      removeToast: mockRemoveToast,
    });

    render(<ToastContainer />);
    const toast = screen.getByRole('alert');
    // Verify design system token usage (not generic Tailwind colors)
    expect(toast).toHaveClass('bg-error-light');
    expect(toast).toHaveClass('text-error-dark');
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

## Timeout Constants

**IMPORTANT:** Add toast-specific timeout constants to the centralized E2E timeouts file.

### Add to `e2e/config/timeouts.ts`

```typescript
// Add to existing TIMEOUTS object
export const TIMEOUTS = {
  // ... existing timeouts ...

  /** Timeout for toast auto-dismiss verification (5s default + 2s buffer) */
  TOAST_AUTO_DISMISS: 7000,
} as const;

// Add pre-built wait options
export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST_AUTO_DISMISS };
```

This timeout provides a 2-second buffer beyond the 5-second default auto-dismiss to account for test execution variability.

---

## E2E Page Object

**IMPORTANT:** Page objects must be created in the same task as the feature they test, not deferred to Task 6.7. This ensures consistent test patterns and reduces integration issues.

### Create `e2e/pages/ToastPage.ts`

Create the ToastPage page object following the existing pattern from Phase 0:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, TOAST_WAIT } from '../config/timeouts';

/**
 * Page object for toast notification interactions.
 * Follows Phase 0 page object pattern from LoginPage.ts.
 */
export class ToastPage {
  readonly page: Page;
  readonly toastContainer: Locator;
  readonly toast: Locator;
  readonly dismissButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastContainer = page.locator('[role="status"][aria-live="polite"]');
    this.toast = page.getByRole('alert');
    this.dismissButton = this.toast.getByRole('button', { name: /dismiss/i });
  }

  async expectToastVisible(textPattern?: string | RegExp) {
    await expect(this.toast.first()).toBeVisible(TOAST_WAIT);
    if (textPattern) {
      await expect(this.toast.first()).toContainText(textPattern);
    }
  }

  async expectToastNotVisible() {
    await expect(this.toast).not.toBeVisible();
  }

  async dismiss() {
    await this.dismissButton.first().click();
  }

  async waitForAutoDismiss() {
    await expect(this.toast.first()).toBeVisible(TOAST_WAIT);
    await expect(this.toast).not.toBeVisible({ timeout: TIMEOUTS.TOAST_AUTO_DISMISS });
  }

  async getToastCount(): Promise<number> {
    return await this.toast.count();
  }

  async expectToastCount(count: number) {
    await expect(this.toast).toHaveCount(count);
  }

  async expectMaxToastsVisible(maxCount: number) {
    const count = await this.getToastCount();
    expect(count).toBeLessThanOrEqual(maxCount);
  }

  async getAllToastMessages(): Promise<string[]> {
    const toasts = await this.toast.all();
    const messages: string[] = [];
    for (const toast of toasts) {
      const text = await toast.textContent();
      if (text) messages.push(text);
    }
    return messages;
  }
}
```

---

## E2E Tests

**IMPORTANT:** E2E tests must be created as part of this task, not deferred to Task 6.7. This follows the incremental testing pattern established in earlier phases.

### Create `e2e/notifications/toast.spec.ts`

Create E2E tests covering toast notification functionality. **Note:** This task uses the `ToastPage` page object created above.

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ToastPage } from '../pages/ToastPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Toast Notifications', () => {
  let toastPage: ToastPage;

  test.beforeEach(async ({ page, loginAsWorker }) => {
    await loginAsWorker();
    toastPage = new ToastPage(page);
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
  });

  test('toast appears on action', async ({ page }) => {
    // Trigger an action that shows a toast (e.g., create project)
    await page.getByRole('link', { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill('Toast Test Project');
    await page.getByRole('button', { name: /create/i }).click();

    // Toast should appear
    await toastPage.expectToastVisible();
  });

  test('success toast auto-dismisses after 5 seconds', async ({ page }) => {
    // Trigger success action
    await page.getByRole('link', { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill('Auto Dismiss Test');
    await page.getByRole('button', { name: /create/i }).click();

    // Toast should appear and auto-dismiss
    await toastPage.waitForAutoDismiss();
  });

  test('toast can be manually dismissed', async ({ page }) => {
    // Trigger action that shows toast
    await page.getByRole('link', { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill('Manual Dismiss Test');
    await page.getByRole('button', { name: /create/i }).click();

    // Toast should appear
    await toastPage.expectToastVisible();

    // Click dismiss button
    await toastPage.dismiss();

    // Toast should be gone immediately
    await toastPage.expectToastNotVisible();
  });

  test('toast has aria-live="polite" for screen readers', async () => {
    // Check aria-live attribute on container
    await expect(toastPage.toastContainer).toHaveAttribute('aria-live', 'polite');
  });

  test('dismiss button meets 44px touch target', async ({ page }) => {
    // Trigger action that shows toast
    await page.getByRole('link', { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill('Touch Target Test');
    await page.getByRole('button', { name: /create/i }).click();

    await toastPage.expectToastVisible();

    const box = await toastPage.dismissButton.first().boundingBox();

    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('error toast has longer display time', async ({ page }) => {
    // Mock an API error to trigger error toast
    await page.route('**/api/projects', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      })
    );

    await page.getByRole('link', { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill('Error Test');
    await page.getByRole('button', { name: /create/i }).click();

    // Error toast should appear
    await toastPage.expectToastVisible();

    // Should still be visible after 5s (default timeout)
    await page.waitForTimeout(5500);
    await toastPage.expectToastVisible();

    // Should dismiss after 10s total (error timeout)
    await expect(toastPage.toast).not.toBeVisible({ timeout: 5500 });
  });

  test('toast stacking behavior limits visible toasts', async ({ page }) => {
    // Create a test page that can trigger multiple toasts rapidly
    // or use the API to inject toasts
    await page.evaluate(() => {
      const addToast = (window as any).__TOAST_STORE__?.addToast;
      if (addToast) {
        // Trigger 7 toasts rapidly (exceeds MAX_VISIBLE of 5)
        for (let i = 0; i < 7; i++) {
          addToast(`Test toast ${i + 1}`, 'info');
        }
      }
    });

    // Allow toasts to render
    await page.waitForTimeout(500);

    // Should not exceed MAX_VISIBLE (5)
    await toastPage.expectMaxToastsVisible(5);
  });

  test('multiple toasts stack vertically', async ({ page }) => {
    // Trigger multiple actions that show toasts
    await page.evaluate(() => {
      const addToast = (window as any).__TOAST_STORE__?.addToast;
      if (addToast) {
        addToast('First toast', 'success');
        addToast('Second toast', 'info');
        addToast('Third toast', 'warning');
      }
    });

    // Allow toasts to render
    await page.waitForTimeout(500);

    // Should have multiple toasts
    const count = await toastPage.getToastCount();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify they are stacked (get bounding boxes)
    const toasts = await toastPage.toast.all();
    if (toasts.length >= 2) {
      const box1 = await toasts[0].boundingBox();
      const box2 = await toasts[1].boundingBox();

      if (box1 && box2) {
        // Toasts should be vertically stacked (different Y positions)
        expect(box1.y).not.toBe(box2.y);
      }
    }
  });

  test('oldest toast is removed when exceeding max', async ({ page }) => {
    // Trigger exactly MAX_VISIBLE + 1 toasts
    await page.evaluate(() => {
      const addToast = (window as any).__TOAST_STORE__?.addToast;
      if (addToast) {
        addToast('Toast 1 - oldest', 'info');
        addToast('Toast 2', 'info');
        addToast('Toast 3', 'info');
        addToast('Toast 4', 'info');
        addToast('Toast 5', 'info');
        addToast('Toast 6 - newest', 'info');
      }
    });

    // Allow toasts to render
    await page.waitForTimeout(500);

    // Get all toast messages
    const messages = await toastPage.getAllToastMessages();

    // The oldest toast should have been removed
    const hasOldest = messages.some((m) => m.includes('Toast 1'));
    const hasNewest = messages.some((m) => m.includes('Toast 6'));

    expect(hasOldest).toBe(false); // Oldest removed
    expect(hasNewest).toBe(true); // Newest kept
  });
});
```

### Run E2E Tests

```bash
npm run test:e2e -- --grep "Toast Notifications"
```

**Expected:** All toast notification E2E tests pass

---

## E2E Verification

Before proceeding to the next task, verify:

- [ ] All unit tests pass (`npm test -- src/hooks/__tests__/useToast.test.ts src/components/ui/__tests__/Toast.test.tsx`)
- [ ] E2E tests pass (`npm run test:e2e -- --grep "Toast Notifications"`)
- [ ] Toast appears on user actions
- [ ] Success toast auto-dismisses after 5 seconds
- [ ] Error toast stays visible for 10 seconds
- [ ] Manual dismiss works immediately
- [ ] `aria-live="polite"` verified on container
- [ ] `TIMEOUTS.TOAST_AUTO_DISMISS` added to `e2e/config/timeouts.ts`

**Do not proceed to Task 6.6 until all E2E tests pass.**

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

## Additional E2E Tests

Add to `e2e/notifications/toast.spec.ts`:

```typescript
test('maximum 5 toasts visible at once', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  // Trigger 7 toasts rapidly
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Test ' + i } }))
    );
  }
  // Verify max 5 visible
  const toasts = await page.getByRole('status').all();
  expect(toasts.length).toBeLessThanOrEqual(5);
});

test('export success shows toast', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();
  // Navigate to document
  // Trigger export
  // Verify success toast appears
  await expect(page.getByRole('status')).toContainText(/exported|success/i);
});

test('API error shows error toast', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  // Mock API error
  await page.route('**/api/projects', (route) => route.fulfill({ status: 500 }));
  // Trigger action
  // Verify error toast
  await expect(page.getByRole('status')).toContainText(/error|failed/i);
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/notifications/
```

**Gate:** All tests must pass before proceeding to Task 6.6.

---

## Next Steps

After this task, proceed to **[Task 6.6: Command Palette](./06-command-palette.md)**.
