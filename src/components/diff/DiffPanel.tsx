'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { DiffChange } from '@/contexts/DiffContext';
import { getDiffStats } from '@/lib/ai/diff-generator';

interface DiffPanelProps {
  changes: DiffChange[];
  acceptedIndexes: Set<number>;
  rejectedIndexes: Set<number>;
  onAcceptChange: (index: number) => void;
  onRejectChange: (index: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * DiffPanel Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Modal: bg-overlay backdrop, bg-surface panel, shadow-xl, rounded-xl
 * - Accept/Reject: success/error semantic color variants
 * - Typography: font-display for title, font-ui for content
 * - Buttons: Primary/Secondary patterns with 44x44px touch targets
 */
export function DiffPanel({
  changes,
  acceptedIndexes,
  rejectedIndexes,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onApply,
  onClose,
}: DiffPanelProps) {
  const stats = useMemo(() => getDiffStats(changes), [changes]);
  const modifiedChanges = useMemo(() => changes.filter((c) => c.type !== 'unchanged'), [changes]);

  // Calculate decided count based on modified changes
  const decidedCount = useMemo(() => {
    let count = 0;
    changes.forEach((change, index) => {
      if (change.type !== 'unchanged') {
        if (acceptedIndexes.has(index) || rejectedIndexes.has(index)) {
          count++;
        }
      }
    });
    return count;
  }, [changes, acceptedIndexes, rejectedIndexes]);

  const allDecided = decidedCount === modifiedChanges.length && modifiedChanges.length > 0;

  // Handle Escape key to close panel
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50" data-testid="diff-panel">
      <div
        className="
        bg-surface rounded-xl shadow-xl
        w-full max-w-4xl max-h-[80vh]
        flex flex-col
      "
      >
        {/* Header - scholarly style with display font */}
        <div className="p-4 border-b border-ink-faint flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-ink-primary">Review Changes</h3>
            <p className="font-ui text-sm text-ink-secondary">
              {stats.additions} addition{stats.additions !== 1 ? 's' : ''}, {stats.deletions} deletion
              {stats.deletions !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Reject All - Secondary button */}
            <button
              onClick={onRejectAll}
              className="
                px-4 py-2 min-h-[44px]
                font-ui text-sm font-semibold text-ink-primary
                bg-surface hover:bg-surface-hover
                border border-ink-faint rounded-md
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
              data-testid="diff-reject-all"
            >
              Reject All
            </button>
            {/* Accept All - Success button */}
            <button
              onClick={onAcceptAll}
              className="
                px-4 py-2 min-h-[44px]
                font-ui text-sm font-semibold text-white
                bg-success hover:bg-success-dark
                rounded-md shadow-sm
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2
              "
              data-testid="diff-accept-all"
            >
              Accept All
            </button>
            {/* Close button - Icon only */}
            <button
              onClick={onClose}
              className="
                p-3 min-w-[44px] min-h-[44px]
                text-ink-tertiary hover:text-ink-primary
                hover:bg-surface-hover
                rounded-md
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
              data-testid="diff-close"
              aria-label="Close diff panel"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Progress bar - subtle background */}
        <div className="px-4 py-2 bg-bg-secondary border-b border-ink-faint" data-testid="diff-progress">
          <span className="font-ui text-sm text-ink-secondary">
            {decidedCount} / {modifiedChanges.length} changes reviewed
          </span>
        </div>

        {/* Changes list - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {changes.map((change, index) => {
            if (change.type === 'unchanged') return null;
            const isAccepted = acceptedIndexes.has(index);
            const isRejected = rejectedIndexes.has(index);

            // Change card styling based on state
            const cardStyles = isAccepted
              ? 'border-success/30 bg-success-light'
              : isRejected
                ? 'border-error/30 bg-error-light'
                : 'border-ink-faint bg-surface';

            return (
              <div key={index} className={`border rounded-lg p-3 ${cardStyles}`} data-testid="diff-change">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Change type badge */}
                    <span
                      className={`
                      inline-block px-2 py-0.5
                      font-ui text-xs font-medium rounded
                      ${change.type === 'add' ? 'bg-success-light text-success-dark' : 'bg-error-light text-error-dark'}
                    `}
                    >
                      {change.type === 'add' ? '+ Added' : '- Removed'}
                    </span>
                    {/* Change content */}
                    <pre className="mt-2 font-mono text-sm text-ink-secondary whitespace-pre-wrap">{change.value}</pre>
                  </div>
                  {/* Accept/Reject buttons with proper touch targets */}
                  <div className="flex gap-1 ml-3">
                    <button
                      onClick={() => onAcceptChange(index)}
                      className={`
                        p-3 min-w-[44px] min-h-[44px]
                        rounded-md
                        transition-all duration-150
                        focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2
                        ${isAccepted ? 'bg-success text-white' : 'text-success hover:bg-success-light'}
                      `}
                      data-testid="accept-change"
                      aria-label="Accept this change"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => onRejectChange(index)}
                      className={`
                        p-3 min-w-[44px] min-h-[44px]
                        rounded-md
                        transition-all duration-150
                        focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2
                        ${isRejected ? 'bg-error text-white' : 'text-error hover:bg-error-light'}
                      `}
                      data-testid="reject-change"
                      aria-label="Reject this change"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Apply footer - shown when all changes are decided */}
        {allDecided && (
          <div className="p-4 border-t border-ink-faint bg-bg-secondary">
            <button
              onClick={onApply}
              className="
                w-full py-3
                font-ui text-sm font-semibold text-white
                bg-quill hover:bg-quill-dark active:bg-quill-darker
                rounded-lg shadow-sm
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
            >
              Apply {acceptedIndexes.size} Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
