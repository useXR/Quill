'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';
import type { AppError } from '@/lib/errors';

interface ErrorFallbackProps {
  /** The error that occurred */
  error: Error | AppError;
  /** Callback to reset the error state and retry */
  resetErrorBoundary?: () => void;
  /** Custom title (defaults to "Something went wrong") */
  title?: string;
  /** Whether to show the retry button (defaults to true) */
  showRetry?: boolean;
}

/**
 * Error display component with accessible focus management.
 * Focuses the heading on mount for screen reader users.
 */
export function ErrorFallback({
  error,
  resetErrorBoundary,
  title = 'Something went wrong',
  showRetry = true,
}: ErrorFallbackProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading on mount for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Check if error is recoverable (AppError has this property)
  const isRecoverable = 'recoverable' in error ? error.recoverable : true;
  const errorCode = 'code' in error ? (error as AppError).code : undefined;

  return (
    <div
      role="alert"
      className="p-6 rounded-[var(--radius-lg)] bg-[var(--color-error-light)] border border-[var(--color-error)]"
      data-testid="error-fallback"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-[var(--color-error-dark)] mb-2 outline-none"
      >
        {title}
      </h2>
      <p className="text-[var(--color-ink-secondary)] mb-4">{error.message || 'An unexpected error occurred.'}</p>

      {errorCode && <p className="text-sm text-[var(--color-ink-tertiary)] mb-4 font-mono">Error code: {errorCode}</p>}

      {showRetry && isRecoverable && resetErrorBoundary && (
        <Button
          onClick={resetErrorBoundary}
          variant="primary"
          className="min-w-[44px] min-h-[44px]"
          data-testid="error-retry-button"
        >
          Try again
        </Button>
      )}

      {!isRecoverable && (
        <p className="text-sm text-[var(--color-ink-tertiary)]">
          This error cannot be automatically recovered. Please refresh the page or contact support.
        </p>
      )}
    </div>
  );
}

/**
 * Compact error display for inline use.
 */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-error-light)] text-[var(--color-error-dark)]"
    >
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span className="flex-1 text-sm">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium underline hover:no-underline min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          Retry
        </button>
      )}
    </div>
  );
}
