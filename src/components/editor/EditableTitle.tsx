'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useEditableTitle } from '@/hooks/useEditableTitle';
import { Pencil } from 'lucide-react';

interface EditableTitleProps {
  title: string;
  onSave: (title: string) => Promise<void>;
  maxLength?: number;
  className?: string;
}

export function EditableTitle({ title: initialTitle, onSave, maxLength = 255, className = '' }: EditableTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Refs for timeout cleanup
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track editing state for blur handler (avoids stale closure)
  const isEditingRef = useRef(false);

  const { title, setTitle, isEditing, isSaving, error, startEditing, finishEditing, cancelEditing } = useEditableTitle({
    initialTitle,
    onSave,
    maxLength,
  });

  // Keep ref in sync with state
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  // Focus and select all text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Return focus to heading after save/cancel
  const handleFinishEditing = useCallback(async () => {
    await finishEditing();
    // Focus heading after save completes (when not in error state)
    // Clear any existing timeout first
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      if (!isEditingRef.current && headingRef.current) {
        headingRef.current.focus();
      }
    }, 0);
  }, [finishEditing]);

  const handleCancelEditing = useCallback(() => {
    cancelEditing();
    // Focus heading after cancel
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      headingRef.current?.focus();
    }, 0);
  }, [cancelEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFinishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEditing();
      }
    },
    [handleFinishEditing, handleCancelEditing]
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow click events to fire first
    // Use ref to check current editing state (avoids stale closure)
    // Clear any existing timeout first
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      if (isEditingRef.current) {
        handleFinishEditing();
      }
    }, 100);
  }, [handleFinishEditing]);

  const handleHeadingKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startEditing();
      }
    },
    [startEditing]
  );

  if (isEditing) {
    return (
      <div data-testid="editable-title" className={`relative ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          maxLength={maxLength}
          aria-label="Document title"
          className="w-full text-2xl font-semibold bg-transparent border-b-2 border-[var(--color-accent-primary)] focus:outline-none px-1 py-0.5"
          style={{ fontFamily: 'var(--font-heading)' }}
        />
        {isSaving && (
          <span
            role="status"
            aria-live="polite"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-tertiary)]"
          >
            Saving...
          </span>
        )}
        {error && (
          <p className="text-sm text-[var(--color-error)] mt-1" role="alert">
            Failed to save title. Press Enter to retry.
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="editable-title" className={`group relative flex items-center gap-2 ${className}`}>
      <h1
        ref={headingRef}
        className="text-2xl font-semibold text-[var(--color-ink-primary)] px-1 py-0.5 cursor-pointer rounded hover:bg-[var(--color-surface-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
        style={{ fontFamily: 'var(--font-heading)' }}
        onClick={startEditing}
        onKeyDown={handleHeadingKeyDown}
        tabIndex={0}
        aria-describedby="edit-title-hint"
      >
        {title}
      </h1>
      <span id="edit-title-hint" className="sr-only">
        Click or press Enter to edit
      </span>
      <button
        type="button"
        onClick={startEditing}
        aria-label="Edit title"
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-surface-secondary)]"
      >
        <Pencil size={16} className="text-[var(--color-ink-tertiary)]" />
      </button>
    </div>
  );
}
