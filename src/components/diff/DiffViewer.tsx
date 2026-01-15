'use client';

import { DiffChange } from '@/contexts/DiffContext';

interface DiffViewerProps {
  changes: DiffChange[];
  acceptedIndexes?: Set<number>;
  rejectedIndexes?: Set<number>;
}

/**
 * DiffViewer Component - Scholarly Craft Design System
 *
 * Displays a unified diff view with line numbers and color coding.
 * Design tokens from docs/design-system.md:
 * - Added lines: bg-success-light, text-success-dark
 * - Removed lines: bg-error-light, text-error-dark
 * - Unchanged: neutral styling
 * - Font: font-mono for code display
 */
export function DiffViewer({ changes, acceptedIndexes = new Set(), rejectedIndexes = new Set() }: DiffViewerProps) {
  if (changes.length === 0) {
    return (
      <div className="font-mono text-sm p-4 text-ink-tertiary text-center" data-testid="diff-viewer">
        No changes to display
      </div>
    );
  }

  return (
    <div className="font-mono text-sm border border-ink-faint rounded-lg overflow-hidden" data-testid="diff-viewer">
      {changes.map((change, index) => {
        const isAccepted = acceptedIndexes.has(index);
        const isRejected = rejectedIndexes.has(index);

        // Base styles per change type
        let bgClass = 'bg-transparent';
        let textClass = 'text-ink-primary';
        let prefix = ' ';
        let testId = 'diff-line-unchanged';

        if (change.type === 'add') {
          bgClass = 'bg-success-light';
          textClass = 'text-success-dark';
          prefix = '+';
          testId = 'diff-line-add';
        } else if (change.type === 'remove') {
          bgClass = 'bg-error-light';
          textClass = 'text-error-dark';
          prefix = '-';
          testId = 'diff-line-remove';
        }

        // Highlight ring for accepted/rejected
        let ringClass = '';
        if (isAccepted) {
          ringClass = 'ring-2 ring-success ring-inset';
        } else if (isRejected) {
          ringClass = 'ring-2 ring-error ring-inset';
        }

        return (
          <div
            key={index}
            className={`flex ${bgClass} ${ringClass} border-b border-ink-faint/50 last:border-b-0`}
            data-testid={testId}
          >
            {/* Line number */}
            <span className="w-12 px-2 py-1 text-right text-ink-tertiary bg-bg-secondary border-r border-ink-faint/50 select-none">
              {change.lineNumber}
            </span>
            {/* Prefix (+/-/space) */}
            <span className={`w-6 px-1 py-1 text-center ${textClass} select-none`}>{prefix}</span>
            {/* Content */}
            <span className={`flex-1 px-2 py-1 ${textClass} whitespace-pre-wrap break-all`}>
              {change.value.replace(/\n$/, '')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
