import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave, SaveStatus } from '../useAutosave';
import { EDITOR } from '@/lib/constants';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start with idle status', () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useAutosave({ save }));

      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.lastSavedAt).toBeNull();
    });
  });

  describe('Debounced Save', () => {
    it('should debounce saves by configured milliseconds', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 500;
      const { result } = renderHook(() => useAutosave({ save, debounceMs }));

      // Trigger multiple saves rapidly
      act(() => {
        result.current.triggerSave('content 1');
      });
      act(() => {
        result.current.triggerSave('content 2');
      });
      act(() => {
        result.current.triggerSave('content 3');
      });

      // Status should be pending
      expect(result.current.status).toBe('pending');

      // Save should not have been called yet
      expect(save).not.toHaveBeenCalled();

      // Advance time past debounce
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
      });

      // Should only save once with the last content
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('content 3');
    });

    it('should use default debounce time from constants', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useAutosave({ save }));

      act(() => {
        result.current.triggerSave('test content');
      });

      // Should not call save before default debounce time
      await act(async () => {
        vi.advanceTimersByTime(EDITOR.AUTOSAVE_DEBOUNCE_MS - 100);
      });
      expect(save).not.toHaveBeenCalled();

      // Should call save after default debounce time
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('should skip save if content has not changed', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 500;
      const { result } = renderHook(() => useAutosave({ save, debounceMs }));

      // First save
      act(() => {
        result.current.triggerSave('same content');
      });
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
      });
      expect(save).toHaveBeenCalledTimes(1);

      // Wait for save to complete and update status
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger save with same content
      act(() => {
        result.current.triggerSave('same content');
      });
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
      });

      // Should still only have one call since content is the same
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('Save Status Transitions', () => {
    it('should transition through status states during save', async () => {
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const save = vi.fn().mockReturnValue(savePromise);
      const debounceMs = 100;

      const { result } = renderHook(() => useAutosave({ save, debounceMs }));

      // Initial state
      expect(result.current.status).toBe('idle');

      // Trigger save
      act(() => {
        result.current.triggerSave('content');
      });

      // Should be pending (debouncing)
      expect(result.current.status).toBe('pending');

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
      });

      // Should be saving
      expect(result.current.status).toBe('saving');

      // Resolve the save
      await act(async () => {
        resolvePromise!();
        await savePromise;
      });

      // Should be saved
      expect(result.current.status).toBe('saved');
      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });

    it('should update lastSavedAt timestamp after successful save', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 100;
      const { result } = renderHook(() => useAutosave({ save, debounceMs }));

      const beforeSave = new Date();

      act(() => {
        result.current.triggerSave('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
        await vi.runAllTimersAsync();
      });

      expect(result.current.lastSavedAt).not.toBeNull();
      expect(result.current.lastSavedAt!.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
    });
  });

  describe('Retry with Exponential Backoff', () => {
    it('should retry with exponential backoff on failure', async () => {
      const save = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      const debounceMs = 100;
      const { result } = renderHook(() => useAutosave({ save, debounceMs, maxRetries: 3 }));

      act(() => {
        result.current.triggerSave('content');
      });

      // Advance past debounce - triggers first save attempt
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
        // Allow the promise to resolve/reject
        await Promise.resolve();
      });

      // First attempt should have been made
      expect(save).toHaveBeenCalledTimes(1);

      // First retry after 1 second (2^0 * 1000)
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });
      expect(save).toHaveBeenCalledTimes(2);

      // Second retry after 2 seconds (2^1 * 1000)
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      // Third attempt succeeds
      expect(save).toHaveBeenCalledTimes(3);
      expect(result.current.status).toBe('saved');
      expect(result.current.error).toBeNull();
    });

    it('should set error status after max retries exceeded', async () => {
      const error = new Error('Persistent error');
      const save = vi.fn().mockRejectedValue(error);

      const debounceMs = 100;
      const maxRetries = 2;
      const { result } = renderHook(() => useAutosave({ save, debounceMs, maxRetries }));

      act(() => {
        result.current.triggerSave('content');
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
        await vi.runAllTimersAsync();
      });

      // First retry
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });

      // Second retry
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });

      expect(save).toHaveBeenCalledTimes(maxRetries + 1); // Initial + retries
      expect(result.current.status).toBe('error');
      expect(result.current.error).toEqual(error);
    });
  });

  describe('saveNow', () => {
    it('should save immediately without debounce', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 5000;
      const { result } = renderHook(() => useAutosave({ save, debounceMs }));

      // Trigger a save with content first
      act(() => {
        result.current.triggerSave('urgent content');
      });

      // Call saveNow immediately
      await act(async () => {
        await result.current.saveNow();
      });

      // Should have saved immediately without waiting for debounce
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('urgent content');
      expect(result.current.status).toBe('saved');
    });

    it('should cancel pending debounced save when saveNow is called', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 5000;
      const { result } = renderHook(() => useAutosave({ save, debounceMs }));

      act(() => {
        result.current.triggerSave('content');
      });

      // Call saveNow
      await act(async () => {
        await result.current.saveNow();
      });

      // Advance time past original debounce
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
        await vi.runAllTimersAsync();
      });

      // Save should only have been called once (by saveNow)
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('should not save if there is no pending content', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useAutosave({ save }));

      await act(async () => {
        await result.current.saveNow();
      });

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('Window Blur Handler', () => {
    it('should save immediately on window blur when saveOnBlur is true', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 5000;
      const { result } = renderHook(() => useAutosave({ save, debounceMs, saveOnBlur: true }));

      act(() => {
        result.current.triggerSave('content to save on blur');
      });

      // Simulate window blur
      await act(async () => {
        window.dispatchEvent(new Event('blur'));
        await vi.runAllTimersAsync();
      });

      expect(save).toHaveBeenCalledTimes(1);
    });

    it('should not save on blur when saveOnBlur is false', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 5000;
      const { result } = renderHook(() => useAutosave({ save, debounceMs, saveOnBlur: false }));

      act(() => {
        result.current.triggerSave('content');
      });

      // Simulate window blur
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });

      // Save should not have been called yet (still waiting for debounce)
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up timers on unmount', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const debounceMs = 5000;
      const { result, unmount } = renderHook(() => useAutosave({ save, debounceMs }));

      act(() => {
        result.current.triggerSave('content');
      });

      // Unmount before debounce completes
      unmount();

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(debounceMs);
      });

      // Save should not have been called since component unmounted
      expect(save).not.toHaveBeenCalled();
    });

    it('should remove window blur listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const save = vi.fn().mockResolvedValue(undefined);

      const { unmount } = renderHook(() => useAutosave({ save, saveOnBlur: true }));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });
  });

  describe('Type Safety', () => {
    it('should export SaveStatus type', () => {
      const statuses: SaveStatus[] = ['idle', 'pending', 'saving', 'saved', 'error'];
      expect(statuses).toHaveLength(5);
    });
  });
});
