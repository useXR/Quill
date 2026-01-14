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
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      {status === 'pending' && (
        <>
          <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
          <span className="text-gray-500">Unsaved changes</span>
        </>
      )}

      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" aria-hidden="true" />
          <span className="text-gray-500">Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
          <span className="text-gray-500">Saved{lastSavedAt ? ` at ${formatTime(lastSavedAt)}` : ''}</span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
          <span className="text-red-600">{error?.message || 'Failed to save'}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-2 text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
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
