'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { EDITOR } from '@/lib/constants';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  save: (content: string) => Promise<void>;
  debounceMs?: number;
  maxRetries?: number;
  saveOnBlur?: boolean;
}

interface UseAutosaveReturn {
  triggerSave: (content: string) => void;
  saveNow: () => Promise<void>;
  status: SaveStatus;
  error: Error | null;
  lastSavedAt: Date | null;
}

export function useAutosave({
  save,
  debounceMs = EDITOR.AUTOSAVE_DEBOUNCE_MS,
  maxRetries = EDITOR.MAX_RETRIES,
  saveOnBlur = true,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs to track pending content and timers
  const pendingContentRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Perform the actual save operation
  const performSave = useCallback(
    async (content: string) => {
      if (!isMountedRef.current) return;

      // Skip if content hasn't changed since last save
      if (isEqual(content, lastSavedContentRef.current)) {
        setStatus('saved');
        return;
      }

      setStatus('saving');
      setError(null);

      try {
        await save(content);

        if (!isMountedRef.current) return;

        lastSavedContentRef.current = content;
        retryCountRef.current = 0;
        setLastSavedAt(new Date());
        setStatus('saved');
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;

        const saveError = err instanceof Error ? err : new Error(String(err));

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          // Exponential backoff: 1s, 2s, 4s... (2^(retryCount-1) * 1000)
          const backoffMs = Math.pow(2, retryCountRef.current - 1) * 1000;

          retryTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              performSave(content);
            }
          }, backoffMs);
        } else {
          // Max retries exceeded
          setStatus('error');
          setError(saveError);
          retryCountRef.current = 0;
        }
      }
    },
    [save, maxRetries]
  );

  // Trigger a debounced save
  const triggerSave = useCallback(
    (content: string) => {
      pendingContentRef.current = content;
      setStatus('pending');
      clearTimers();

      debounceTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && pendingContentRef.current !== null) {
          performSave(pendingContentRef.current);
        }
      }, debounceMs);
    },
    [debounceMs, clearTimers, performSave]
  );

  // Save immediately without debounce
  const saveNow = useCallback(async () => {
    clearTimers();

    if (pendingContentRef.current === null) {
      return;
    }

    await performSave(pendingContentRef.current);
  }, [clearTimers, performSave]);

  // Handle window blur
  useEffect(() => {
    if (!saveOnBlur) return;

    const handleBlur = () => {
      if (pendingContentRef.current !== null) {
        clearTimers();
        performSave(pendingContentRef.current);
      }
    };

    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [saveOnBlur, clearTimers, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  return {
    triggerSave,
    saveNow,
    status,
    error,
    lastSavedAt,
  };
}
