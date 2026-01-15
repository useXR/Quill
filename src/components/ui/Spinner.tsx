'use client';

import type { HTMLAttributes } from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps extends HTMLAttributes<SVGSVGElement> {
  /** Size variant of the spinner */
  size?: SpinnerSize;
  /** Accessible label for the spinner (defaults to "Loading") */
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

/**
 * Loading spinner with brand color and size variants.
 * Includes proper accessibility with role="status" and sr-only text.
 */
export function Spinner({ size = 'md', label = 'Loading', className = '', ...props }: SpinnerProps) {
  return (
    <div role="status" className="inline-flex items-center justify-center">
      <svg
        className={`
          animate-spin
          motion-reduce:animate-none
          text-[var(--color-quill)]
          ${sizeClasses[size]}
          ${className}
        `}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        {...props}
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Full-page spinner overlay.
 * Useful for page-level loading states.
 */
export function PageSpinner({ label = 'Loading page' }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[var(--color-bg-primary)] bg-opacity-80 z-50"
      data-testid="page-spinner"
    >
      <Spinner size="lg" label={label} />
    </div>
  );
}

/**
 * Inline spinner for use within buttons or text.
 */
export function InlineSpinner({ label = 'Loading' }: { label?: string }) {
  return <Spinner size="sm" label={label} />;
}
