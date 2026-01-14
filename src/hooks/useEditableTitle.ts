'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseEditableTitleOptions {
  initialTitle: string;
  onSave: (title: string) => Promise<void>;
  maxLength?: number;
}

export interface UseEditableTitleReturn {
  title: string;
  setTitle: (title: string) => void;
  isEditing: boolean;
  isSaving: boolean;
  error: Error | null;
  startEditing: () => void;
  finishEditing: () => Promise<void>;
  cancelEditing: () => void;
}

export function useEditableTitle({ initialTitle, onSave, maxLength }: UseEditableTitleOptions): UseEditableTitleReturn {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the original title when editing starts
  const originalTitleRef = useRef(initialTitle);

  // Track editing state for blur handler (avoids stale closure)
  const isEditingRef = useRef(isEditing);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Update title when prop changes (only when not editing)
  useEffect(() => {
    if (!isEditing) {
      setTitle(initialTitle);
      originalTitleRef.current = initialTitle;
    }
  }, [initialTitle, isEditing]);

  const startEditing = useCallback(() => {
    originalTitleRef.current = title;
    setIsEditing(true);
    setError(null);
  }, [title]);

  const finishEditing = useCallback(async () => {
    const trimmedTitle = title.trim();

    // Don't save empty titles
    if (!trimmedTitle) {
      setTitle(originalTitleRef.current);
      setIsEditing(false);
      return;
    }

    // Don't save if unchanged
    if (trimmedTitle === originalTitleRef.current) {
      setIsEditing(false);
      return;
    }

    // Validate maxLength if specified
    if (maxLength && trimmedTitle.length > maxLength) {
      setTitle(originalTitleRef.current);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedTitle);
      originalTitleRef.current = trimmedTitle;
      setTitle(trimmedTitle);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save title'));
      // Stay in edit mode on error so user can retry
    } finally {
      setIsSaving(false);
    }
  }, [title, onSave, maxLength]);

  const cancelEditing = useCallback(() => {
    setTitle(originalTitleRef.current);
    setIsEditing(false);
    setError(null);
  }, []);

  return {
    title,
    setTitle,
    isEditing,
    isSaving,
    error,
    startEditing,
    finishEditing,
    cancelEditing,
  };
}
