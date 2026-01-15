'use client';

import { useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Button } from '@/components/ui/Button';

/**
 * Test component that throws on first render, succeeds after retry.
 * Used for E2E testing of error boundary behavior.
 */
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from ThrowingComponent');
  }

  return (
    <div
      className="p-6 rounded-[var(--radius-lg)] bg-[var(--color-success-light)] border border-[var(--color-success)]"
      data-testid="success-content"
    >
      <h2 className="text-lg font-semibold text-[var(--color-success-dark)] mb-2">Success!</h2>
      <p className="text-[var(--color-ink-secondary)]">The component rendered successfully after retry.</p>
    </div>
  );
}

/**
 * Test page for error boundary E2E testing.
 * Only renders in non-production environments.
 */
export default function ErrorBoundaryTestPage() {
  const [hasThrown, setHasThrown] = useState(false);
  const [key, setKey] = useState(0);

  // Only render in non-production
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <p className="text-[var(--color-ink-secondary)]">This page is not available in production.</p>
      </div>
    );
  }

  const handleReset = () => {
    setHasThrown(true);
    setKey((k) => k + 1);
  };

  // First render throws, subsequent renders succeed
  const shouldThrow = !hasThrown;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-8" data-testid="error-boundary-test-page">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-display font-bold text-[var(--color-ink-primary)] mb-6">
          Error Boundary Test Page
        </h1>

        <p className="text-[var(--color-ink-secondary)] mb-8">
          This page tests the error boundary component. The component below will throw an error on first render, then
          succeed after clicking &quot;Try again&quot;.
        </p>

        <div className="mb-8">
          <ErrorBoundary key={key} onReset={handleReset}>
            <ThrowingComponent shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </div>

        <div className="border-t border-[var(--color-ink-faint)] pt-6">
          <h2 className="text-lg font-semibold text-[var(--color-ink-primary)] mb-4">Manual Controls</h2>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setHasThrown(false);
                setKey((k) => k + 1);
              }}
              variant="secondary"
              data-testid="trigger-error-button"
            >
              Trigger Error Again
            </Button>
            <Button
              onClick={() => {
                setHasThrown(true);
                setKey((k) => k + 1);
              }}
              variant="secondary"
              data-testid="reset-success-button"
            >
              Reset to Success
            </Button>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink-secondary)] mb-2">Test IDs available:</h3>
          <ul className="text-sm text-[var(--color-ink-tertiary)] space-y-1 font-mono">
            <li>error-boundary-test-page</li>
            <li>error-fallback</li>
            <li>error-retry-button</li>
            <li>success-content</li>
            <li>trigger-error-button</li>
            <li>reset-success-button</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
