# Task 6.4: Loading States & Error Handling

> **Phase 6** | [← App Shell & Navigation](./03-app-shell-navigation.md) | [Next: Toast Notifications →](./05-toast-notifications.md)

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
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function DocumentListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
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
      <div className="flex gap-2 p-2 border-b">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="w-8 h-8" />
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
      className={`animate-spin motion-reduce:animate-none text-blue-600 ${sizeClasses[size]} ${className}`}
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
        className="text-lg font-semibold text-gray-900 mb-2 outline-none"
      >
        Something went wrong
      </h2>
      <p className="text-gray-600 mb-4">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
    <div className="min-h-screen flex items-center justify-center" role="alert">
      <div className="max-w-md text-center p-8">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold mb-2 outline-none"
        >
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
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

## Next Steps

After this task, proceed to **[Task 6.5: Toast Notifications](./05-toast-notifications.md)**.
