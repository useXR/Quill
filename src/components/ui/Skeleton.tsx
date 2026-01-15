'use client';

import type { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton (CSS value) */
  width?: string;
  /** Height of the skeleton (CSS value) */
  height?: string;
}

/**
 * Basic skeleton loading placeholder with pulse animation.
 * Uses `aria-hidden` as it's purely decorative.
 */
export function Skeleton({ width, height, className = '', style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`
        bg-[var(--color-bg-tertiary)]
        rounded-[var(--radius-md)]
        animate-pulse
        motion-reduce:animate-none
        ${className}
      `}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
}

/**
 * Skeleton placeholder for document list items.
 * Includes screen reader announcement for loading state.
 */
export function DocumentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" data-testid="document-list-skeleton">
      <span className="sr-only">Loading documents...</span>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface)]">
            {/* Document icon placeholder */}
            <Skeleton width="2.5rem" height="2.5rem" className="rounded-[var(--radius-md)] shrink-0" />
            <div className="flex-1 space-y-2">
              {/* Title */}
              <Skeleton height="1rem" className="w-3/4" />
              {/* Metadata */}
              <Skeleton height="0.75rem" className="w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for the document editor.
 * Includes screen reader announcement for loading state.
 */
export function EditorSkeleton() {
  return (
    <div role="status" data-testid="editor-skeleton" className="p-6 space-y-4">
      <span className="sr-only">Loading editor...</span>
      {/* Title area */}
      <Skeleton height="2.5rem" className="w-2/3" />
      {/* Content lines */}
      <div className="space-y-3 pt-4">
        <Skeleton height="1rem" className="w-full" />
        <Skeleton height="1rem" className="w-full" />
        <Skeleton height="1rem" className="w-5/6" />
        <Skeleton height="1rem" className="w-full" />
        <Skeleton height="1rem" className="w-4/5" />
      </div>
      <div className="space-y-3 pt-4">
        <Skeleton height="1rem" className="w-full" />
        <Skeleton height="1rem" className="w-3/4" />
        <Skeleton height="1rem" className="w-full" />
        <Skeleton height="1rem" className="w-2/3" />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for project cards.
 */
export function ProjectCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-ink-faint)]"
    >
      <div className="space-y-3">
        {/* Title */}
        <Skeleton height="1.25rem" className="w-3/4" />
        {/* Description */}
        <Skeleton height="0.875rem" className="w-full" />
        <Skeleton height="0.875rem" className="w-2/3" />
        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton height="0.75rem" width="5rem" />
          <Skeleton height="0.75rem" width="3rem" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for project list.
 */
export function ProjectListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" data-testid="project-list-skeleton">
      <span className="sr-only">Loading projects...</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
