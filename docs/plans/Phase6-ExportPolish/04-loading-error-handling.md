# Task 6.4: Loading States & Error Handling

> **Phase 6** | [← App Shell & Navigation](./03-app-shell-navigation.md) | [Next: Toast Notifications →](./05-toast-notifications.md)

---

## Design System Context

Loading states and error handling follow the **Scholarly Craft** aesthetic with calm, professional feedback that doesn't disrupt the focused writing experience.

### Key Design Tokens for This Task

| Element              | Design Token                   | Purpose                                      |
| -------------------- | ------------------------------ | -------------------------------------------- |
| Skeleton backgrounds | `bg-bg-tertiary`               | #efecea - subtle pulse animation base        |
| Spinner color        | `text-quill`                   | #7c3aed - brand-consistent loading indicator |
| Error background     | `bg-error-light`               | #fee2e2 - soft red for error states          |
| Error text           | `text-error-dark`              | #7f1d1d - accessible contrast on light bg    |
| Success background   | `bg-success-light`             | #dcfce7 - soft green for success states      |
| Retry button         | `bg-quill hover:bg-quill-dark` | Primary action styling                       |

### Typography

- **Error Headings:** `font-display text-lg font-semibold text-ink-primary`
- **Error Messages:** `font-ui text-sm text-ink-secondary`
- **Skeleton Text:** Hidden with `aria-hidden="true"`, screen reader text via `.sr-only`

### Animation Standards

- **Skeleton Pulse:** `animate-pulse motion-reduce:animate-none`
- **Spinner:** `animate-spin motion-reduce:animate-none`
- **All animations:** Must respect `prefers-reduced-motion`

---

## Context

**This task implements loading states, error boundaries, and error handling infrastructure.** Users see appropriate feedback during loading and when errors occur.

### Prerequisites

- **Task 6.3** completed (App Shell & Navigation)

### What This Task Creates

- `src/lib/errors.ts` - Custom error classes
- `src/lib/__tests__/errors.test.ts` - Error class tests
- `src/components/ui/Skeleton.tsx` - Loading skeleton components
- `src/components/ui/__tests__/Skeleton.test.tsx` - Skeleton tests
- `src/components/ui/Spinner.tsx` - Loading spinner
- `src/components/ui/ErrorFallback.tsx` - Error display component
- `src/components/ui/ErrorBoundary.tsx` - React error boundary
- `src/app/error.tsx` - Global error page
- `src/app/loading.tsx` - Global loading page

### Tasks That Depend on This

- **Task 6.6** (Command Palette) - Error handling integration
- **Task 6.7** (E2E Tests) - Error state testing

### Parallel Tasks

This task can be done in parallel with:

- **Task 6.5** (Toast Notifications)

---

## Files to Create/Modify

- `src/lib/errors.ts` (create)
- `src/lib/__tests__/errors.test.ts` (create)
- `src/components/ui/Skeleton.tsx` (create)
- `src/components/ui/__tests__/Skeleton.test.tsx` (create)
- `src/components/ui/Spinner.tsx` (create)
- `src/components/ui/ErrorFallback.tsx` (create)
- `src/components/ui/ErrorBoundary.tsx` (create)
- `src/app/error.tsx` (create)
- `src/app/loading.tsx` (create)

---

## Steps

### Step 1: Create error classes

Create `src/lib/errors.ts`:

```typescript
/**
 * Custom error classes for the application.
 * Following the error handling pattern from best practices.
 *
 * @example
 * if (!item) {
 *   throw new NotFoundError('Item', itemId);
 * }
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network connection failed') {
    super(message, 'NETWORK_ERROR', 0, true);
    this.name = 'NetworkError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401, true);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, false);
    this.name = 'NotFoundError';
  }
}

export class AITimeoutError extends AppError {
  constructor(message = 'AI request timed out') {
    super(message, 'AI_TIMEOUT', 504, true);
    this.name = 'AITimeoutError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true);
    this.name = 'ValidationError';
  }
}
```

### Step 2: Create Skeleton component

Create `src/components/ui/Skeleton.tsx`:

```typescript
/**
 * Skeleton loading components with Scholarly Craft styling.
 * Design tokens: bg-bg-tertiary for skeleton backgrounds, border-ink-faint for borders
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`bg-bg-tertiary rounded animate-pulse motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function DocumentListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-surface border border-ink-faint rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading editor">
      <div className="flex gap-2 p-2 bg-bg-secondary border-b border-ink-faint">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="w-8 h-8 rounded-md" />
        ))}
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <span className="sr-only">Loading editor...</span>
    </div>
  );
}
```

### Step 3: Create Spinner component

Create `src/components/ui/Spinner.tsx`:

```typescript
/**
 * Loading spinner with Scholarly Craft styling.
 * Design tokens: text-quill for brand-consistent spinner color
 */

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin motion-reduce:animate-none text-quill ${sizeClasses[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
      <span className="sr-only">Loading...</span>
    </svg>
  );
}
```

### Step 4: Create ErrorFallback component with focus management

Create `src/components/ui/ErrorFallback.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';

/**
 * Error fallback component with Scholarly Craft styling.
 * Design tokens: text-ink-*, bg-quill for retry button
 */

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the heading when the error is displayed for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="p-8 text-center" role="alert">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-lg font-semibold text-ink-primary mb-2 outline-none"
      >
        Something went wrong
      </h2>
      <p className="font-ui text-sm text-ink-secondary mb-6">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2.5 min-h-[44px] bg-quill hover:bg-quill-dark text-white font-ui font-semibold text-sm rounded-md shadow-sm hover:shadow-md transition-all duration-150 motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2"
      >
        Try Again
      </button>
    </div>
  );
}
```

### Step 5: Create ErrorBoundary component with structured logging

Create `src/components/ui/ErrorBoundary.tsx`:

```typescript
'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Use structured logging instead of console.error
    logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        componentStack: errorInfo.componentStack,
      },
      'ErrorBoundary caught unhandled error'
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
        )
      );
    }
    return this.props.children;
  }
}
```

### Step 6: Create global error page with focus management

Create `src/app/error.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';

/**
 * Global error page with Scholarly Craft styling.
 * Design tokens: bg-bg-primary, text-ink-*, bg-quill for retry button
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the heading when the error page mounts for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary" role="alert">
      <div className="max-w-md text-center p-8">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-xl font-semibold text-ink-primary mb-2 outline-none"
        >
          Something went wrong
        </h1>
        <p className="font-ui text-sm text-ink-secondary mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2.5 min-h-[44px] bg-quill hover:bg-quill-dark text-white font-ui font-semibold text-sm rounded-md shadow-sm hover:shadow-md transition-all duration-150 motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

### Step 7: Create global loading page

Create `src/app/loading.tsx`:

```typescript
import { Spinner } from '@/components/ui/Spinner';

/**
 * Global loading page with Scholarly Craft styling.
 * Design tokens: bg-bg-primary for page background, text-quill for spinner
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <Spinner size="lg" />
    </div>
  );
}
```

### Step 8: Write tests for error classes

Create `src/lib/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AppError, NetworkError, AuthError, NotFoundError, AITimeoutError, ValidationError } from '../errors';

describe('AppError', () => {
  it('creates error with message and code', () => {
    const error = new AppError('Test error', 'TEST_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.recoverable).toBe(true);
  });

  it('allows custom statusCode', () => {
    const error = new AppError('Test', 'TEST', 404);
    expect(error.statusCode).toBe(404);
  });

  it('allows non-recoverable errors', () => {
    const error = new AppError('Test', 'TEST', 500, false);
    expect(error.recoverable).toBe(false);
  });

  it('is instanceof Error', () => {
    const error = new AppError('Test', 'TEST');
    expect(error).toBeInstanceOf(Error);
  });

  it('has correct name', () => {
    const error = new AppError('Test', 'TEST');
    expect(error.name).toBe('AppError');
  });
});

describe('NetworkError', () => {
  it('has default message', () => {
    const error = new NetworkError();
    expect(error.message).toBe('Network connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.statusCode).toBe(0);
    expect(error.name).toBe('NetworkError');
  });

  it('accepts custom message', () => {
    const error = new NetworkError('Custom network error');
    expect(error.message).toBe('Custom network error');
  });
});

describe('AuthError', () => {
  it('has default message', () => {
    const error = new AuthError();
    expect(error.message).toBe('Authentication required');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AuthError');
  });
});

describe('NotFoundError', () => {
  it('formats message with resource and id', () => {
    const error = new NotFoundError('Document', 'abc-123');
    expect(error.message).toBe('Document not found: abc-123');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.recoverable).toBe(false);
    expect(error.name).toBe('NotFoundError');
  });
});

describe('AITimeoutError', () => {
  it('has default message', () => {
    const error = new AITimeoutError();
    expect(error.message).toBe('AI request timed out');
    expect(error.code).toBe('AI_TIMEOUT');
    expect(error.statusCode).toBe(504);
    expect(error.name).toBe('AITimeoutError');
  });
});

describe('ValidationError', () => {
  it('has message and optional fields', () => {
    const error = new ValidationError('Validation failed', {
      email: 'Invalid email',
    });
    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.fields).toEqual({ email: 'Invalid email' });
    expect(error.name).toBe('ValidationError');
  });
});
```

### Step 9: Write tests for Skeleton component

Create `src/components/ui/__tests__/Skeleton.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, DocumentListSkeleton, EditorSkeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders with custom className', () => {
    const { container } = render(<Skeleton className="w-10 h-10" />);
    expect(container.firstChild).toHaveClass('w-10', 'h-10');
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('has animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('respects reduced motion preference', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('motion-reduce:animate-none');
  });

  it('uses design system bg-bg-tertiary token', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('bg-bg-tertiary');
  });
});

describe('DocumentListSkeleton', () => {
  it('renders 5 skeleton items', () => {
    render(<DocumentListSkeleton />);
    const container = screen.getByRole('status');
    const items = container.querySelectorAll('.rounded-lg');
    expect(items.length).toBe(5);
  });

  it('has loading status role', () => {
    render(<DocumentListSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('has screen reader text', () => {
    render(<DocumentListSkeleton />);
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });
});

describe('EditorSkeleton', () => {
  it('renders toolbar skeletons', () => {
    render(<EditorSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Loading editor'
    );
  });

  it('has screen reader text', () => {
    render(<EditorSkeleton />);
    expect(screen.getByText('Loading editor...')).toHaveClass('sr-only');
  });
});
```

### Step 10: Run tests to verify they pass

```bash
npm test -- src/lib/__tests__/errors.test.ts src/components/ui/__tests__/Skeleton.test.tsx
```

**Expected:** All tests PASS

### Step 11: Commit

```bash
git add src/lib/ src/components/ui/ src/app/error.tsx src/app/loading.tsx
git commit -m "feat: add loading states and error handling

- Add custom error classes (AppError, NetworkError, AuthError, etc.)
- Add Skeleton components with reduced motion support
- Add Spinner component with accessibility
- Add ErrorFallback with focus management
- Add ErrorBoundary with structured logging
- Add global error.tsx and loading.tsx pages
- All components meet accessibility requirements"
```

**Expected:** Commit created successfully

---

## E2E Tests

**IMPORTANT:** E2E tests must be created as part of this task, not deferred to Task 6.7. This follows the incremental testing pattern established in earlier phases.

### Create `e2e/errors/error-handling.spec.ts`

Create E2E tests covering error handling functionality:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Error Handling', () => {
  test.describe('Error Boundary', () => {
    test('displays error UI when component throws', async ({ page }) => {
      // Navigate to a page with a component that throws
      // This requires a test route that intentionally throws
      await page.goto('/test/error-boundary');

      // Error UI should be visible
      const errorHeading = page.getByRole('heading', { name: /something went wrong/i });
      await expect(errorHeading).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

      // Retry button should be visible
      const retryButton = page.getByRole('button', { name: /try again/i });
      await expect(retryButton).toBeVisible();
    });

    test('error UI has correct role="alert"', async ({ page }) => {
      await page.goto('/test/error-boundary');

      const alert = page.locator('[role="alert"]');
      await expect(alert).toBeVisible();
    });

    test('retry button has proper touch target', async ({ page }) => {
      await page.goto('/test/error-boundary');

      const retryButton = page.getByRole('button', { name: /try again/i });
      const box = await retryButton.boundingBox();

      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    });

    test('ErrorBoundary recovery works after retry click', async ({ page }) => {
      await page.goto('/test/error-boundary');

      // Error UI should be visible initially
      const errorHeading = page.getByRole('heading', { name: /something went wrong/i });
      await expect(errorHeading).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

      // Click the retry button
      const retryButton = page.getByTestId('retry-button');
      await retryButton.click();

      // Error UI should be replaced with recovered content
      await expect(errorHeading).not.toBeVisible();

      // Recovered content should be visible
      const recoveredContent = page.getByTestId('recovered-content');
      await expect(recoveredContent).toBeVisible();
      await expect(recoveredContent).toContainText('Content recovered successfully');

      // Throw count should have incremented
      const throwCount = page.getByTestId('throw-count');
      await expect(throwCount).toContainText('Throw count: 1');
    });

    test('ErrorBoundary state is properly reset after retry', async ({ page }) => {
      await page.goto('/test/error-boundary');

      // Wait for error state
      await expect(page.getByRole('alert')).toBeVisible();

      // Click retry
      await page.getByTestId('retry-button').click();

      // Verify error boundary state is cleared (no alert role visible)
      await expect(page.getByRole('alert')).not.toBeVisible();

      // Component should render normally now
      await expect(page.getByTestId('recovered-content')).toBeVisible();
    });
  });

  test.describe('Skeleton Components', () => {
    test('skeleton renders during loading', async ({ page }) => {
      // Slow down API responses to catch loading state
      await page.route('**/api/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.goto('/projects');

      // Skeleton should be visible
      const skeleton = page.locator('[role="status"][aria-label*="Loading"]');
      await expect(skeleton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    });

    test('skeleton has screen reader text', async ({ page }) => {
      await page.route('**/api/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.goto('/projects');

      // Check for sr-only loading text
      const srText = page.locator('.sr-only').filter({ hasText: /loading/i });
      await expect(srText).toHaveCount(1);
    });
  });

  test.describe('Error Pages', () => {
    test('global error page is accessible', async ({ page }) => {
      // Navigate to the error page
      await page.goto('/test/error-page');

      // Run accessibility audit
      await checkA11y(page, { detailedReport: true });
    });

    test('error heading receives focus on mount', async ({ page }) => {
      await page.goto('/test/error-page');

      const heading = page.getByRole('heading', { name: /something went wrong/i });
      await expect(heading).toBeFocused();
    });

    test('error page has retry functionality', async ({ page }) => {
      await page.goto('/test/error-page');

      const retryButton = page.getByRole('button', { name: /try again/i });
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toBeEnabled();
    });
  });
});
```

### Add Test Routes (for error testing)

**IMPORTANT:** Test routes must be created as part of this task to enable E2E testing of error boundaries. These routes are only accessible in development/test environments.

Create `src/app/test/error-boundary/page.tsx` (development only):

```typescript
'use client';

import { useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error for E2E');
  }
  return <div data-testid="recovered-content">Content recovered successfully!</div>;
}

export default function ErrorBoundaryTest() {
  // Only available in development/test
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const [throwCount, setThrowCount] = useState(0);
  const [shouldThrow, setShouldThrow] = useState(true);

  // Custom retry handler that resets the error state
  const handleRetry = () => {
    setThrowCount((c) => c + 1);
    setShouldThrow(false); // Stop throwing after retry
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold mb-4">Error Boundary Test Page</h1>
      <p className="mb-4" data-testid="throw-count">Throw count: {throwCount}</p>

      <ErrorBoundary
        key={throwCount}
        fallback={
          <div role="alert" className="p-8 text-center">
            <h2 className="font-display text-lg font-semibold text-ink-primary mb-2">
              Something went wrong
            </h2>
            <p className="font-ui text-sm text-ink-secondary mb-6">
              Test error for E2E
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2.5 min-h-[44px] bg-quill hover:bg-quill-dark text-white font-ui font-semibold text-sm rounded-md"
              data-testid="retry-button"
            >
              Try Again
            </button>
          </div>
        }
      >
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </div>
  );
}
```

Create `src/app/test/error-page/page.tsx` (for global error page testing):

```typescript
'use client';

export default function ErrorPageTest() {
  // Only available in development/test
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Throw an error to trigger the global error.tsx page
  throw new Error('Test error for global error page');
}
```

### Run E2E Tests

```bash
npm run test:e2e -- --grep "Error Handling"
```

**Expected:** All error handling E2E tests pass

---

## E2E Verification

Before proceeding to the next task, verify:

- [ ] All unit tests pass (`npm test -- src/lib/__tests__/errors.test.ts src/components/ui/__tests__/Skeleton.test.tsx`)
- [ ] E2E tests pass (`npm run test:e2e -- --grep "Error Handling"`)
- [ ] Error boundary displays error UI correctly
- [ ] Skeleton components render during loading
- [ ] Error pages are accessible (pass checkA11y)
- [ ] Error heading receives focus on mount (accessibility)

**Do not proceed to Task 6.5 until all E2E tests pass.**

---

## Verification Checklist

- [ ] AppError and subclasses have correct properties and names
- [ ] Skeleton component has animation and aria-hidden
- [ ] Skeleton respects prefers-reduced-motion
- [ ] DocumentListSkeleton renders 5 items with screen reader text
- [ ] EditorSkeleton renders toolbar placeholders
- [ ] Spinner component has proper sizing and animation
- [ ] Spinner respects prefers-reduced-motion
- [ ] ErrorFallback displays error message and retry button
- [ ] ErrorFallback focuses heading on mount (accessibility)
- [ ] ErrorBoundary catches and displays errors
- [ ] ErrorBoundary uses structured logger (not console.error)
- [ ] Global error.tsx shows user-friendly error page
- [ ] Global error.tsx focuses heading on mount
- [ ] Global loading.tsx shows centered spinner
- [ ] All interactive elements meet 44x44px touch target
- [ ] All tests pass
- [ ] Changes committed

---

## Additional E2E Tests

Add to `e2e/errors/error-handling.spec.ts`:

```typescript
test('retry button actually retries the operation', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/projects', (route) => {
    attempts++;
    if (attempts === 1) {
      route.fulfill({ status: 500 });
    } else {
      route.fulfill({ status: 200, json: [] });
    }
  });
  // Navigate to trigger error
  await page.goto('/projects');
  // Verify error UI
  await expect(page.getByRole('alert')).toBeVisible();
  // Click retry
  await page.getByRole('button', { name: /retry/i }).click();
  // Verify success (error gone, content shown)
  await expect(page.getByRole('alert')).not.toBeVisible();
});

test('network error shows user-friendly message', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('failed'));
  await page.goto('/projects');
  await expect(page.getByText(/network|connection/i)).toBeVisible();
});

test('404 error shows not found page', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  await page.goto('/projects/non-existent-id');
  await expect(page.getByText(/not found/i)).toBeVisible();
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/errors/
```

**Gate:** All tests must pass before proceeding to Task 6.5.

---

## Next Steps

After this task, proceed to **[Task 6.5: Toast Notifications](./05-toast-notifications.md)**.
