'use client';

import { Check, AlertTriangle, Loader2, Clock } from 'lucide-react';
import type { SaveStatus as SaveStatusType } from '@/hooks/useAutosave';

interface SaveStatusProps {
  status: SaveStatusType;
  lastSavedAt: Date | null;
  error: Error | null;
  onRetry?: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SaveStatus({ status, lastSavedAt, error, onRetry }: SaveStatusProps) {
  if (status === 'idle') {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 text-sm"
      style={{ fontFamily: 'var(--font-ui)' }}
      role="status"
      aria-live="polite"
      data-testid="save-status"
    >
      {status === 'pending' && (
        <>
          <Clock className="h-4 w-4 text-[var(--color-ink-subtle)]" aria-hidden="true" />
          <span className="text-[var(--color-ink-tertiary)]">Unsaved changes</span>
        </>
      )}

      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 text-[var(--color-quill)] animate-spin" aria-hidden="true" />
          <span className="text-[var(--color-ink-tertiary)]">Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" />
          <span className="text-[var(--color-ink-tertiary)]">
            Saved{lastSavedAt ? ` at ${formatTime(lastSavedAt)}` : ''}
          </span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertTriangle className="h-4 w-4 text-[var(--color-error)]" aria-hidden="true" />
          <span className="text-[var(--color-error)]">{error?.message || 'Failed to save'}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-2 text-sm text-[var(--color-quill)] hover:text-[var(--color-quill-dark)] underline focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:ring-offset-2 rounded-sm transition-colors duration-150"
              aria-label="Retry saving"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
}
