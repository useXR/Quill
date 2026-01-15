'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error page for Next.js app router.
 * Handles errors at the route level with accessible focus management.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading on mount for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Log error digest for debugging (in production, digest is a hash)
  useEffect(() => {
    if (error.digest) {
      // This is intentionally logged to help with error tracking
      // In production, you might want to send this to an error tracking service
    }
  }, [error.digest]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-4">
      <div
        role="alert"
        className="max-w-md w-full p-8 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-warm-lg)]"
        data-testid="global-error-page"
      >
        {/* Error icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-error-light)] flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--color-error)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-display font-bold text-[var(--color-ink-primary)] text-center mb-3 outline-none"
          data-testid="error-heading"
        >
          Something went wrong
        </h1>

        <p className="text-[var(--color-ink-secondary)] text-center mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {error.digest && (
          <p className="text-sm text-[var(--color-ink-tertiary)] text-center mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={reset} variant="primary" className="w-full min-h-[44px]" data-testid="error-retry-button">
            Try again
          </Button>

          <Button
            onClick={() => (window.location.href = '/')}
            variant="secondary"
            className="w-full min-h-[44px]"
            data-testid="error-home-button"
          >
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}
