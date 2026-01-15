import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToastStore } from '../useToast';
import { TOAST } from '@/lib/constants/toast';

// Mock crypto.randomUUID
const mockUUID = vi.fn();
vi.stubGlobal('crypto', { randomUUID: mockUUID });

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUUID.mockReset();
    // Generate unique IDs for each call
    let uuidCounter = 0;
    mockUUID.mockImplementation(() => `toast-${++uuidCounter}`);

    // Reset the store state before each test
    act(() => {
      useToastStore.getState().clearToasts();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('addToast', () => {
    it('should add a toast with default info type', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Test message');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        id: 'toast-1',
        type: 'info',
        message: 'Test message',
      });
    });

    it('should add a toast with custom type', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Success!', { type: 'success' });
      });

      expect(result.current.toasts[0].type).toBe('success');
    });

    it('should add a toast with title', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Something went wrong', { type: 'error', title: 'Error' });
      });

      expect(result.current.toasts[0]).toMatchObject({
        type: 'error',
        message: 'Something went wrong',
        title: 'Error',
      });
    });

    it('should return the toast ID', () => {
      const { result } = renderHook(() => useToastStore());

      let id: string = '';
      act(() => {
        id = result.current.addToast('Test');
      });

      expect(id).toBe('toast-1');
    });

    it('should use default timeout for non-error toasts', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Info toast', { type: 'info' });
      });

      expect(result.current.toasts[0].timeout).toBe(TOAST.DEFAULT_TIMEOUT_MS);
    });

    it('should use error timeout for error toasts', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Error toast', { type: 'error' });
      });

      expect(result.current.toasts[0].timeout).toBe(TOAST.ERROR_TIMEOUT_MS);
    });

    it('should allow custom timeout', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Custom timeout', { timeout: 3000 });
      });

      expect(result.current.toasts[0].timeout).toBe(3000);
    });

    it('should allow persistent toast with null timeout', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Persistent toast', { timeout: null });
      });

      expect(result.current.toasts[0].timeout).toBeNull();
    });

    it('should limit visible toasts to MAX_VISIBLE', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        // Add more than MAX_VISIBLE toasts
        for (let i = 0; i < TOAST.MAX_VISIBLE + 3; i++) {
          result.current.addToast(`Toast ${i}`);
        }
      });

      expect(result.current.toasts).toHaveLength(TOAST.MAX_VISIBLE);
      // Should keep the most recent ones (oldest removed first)
      expect(result.current.toasts[0].message).toBe(`Toast 3`);
      expect(result.current.toasts[TOAST.MAX_VISIBLE - 1].message).toBe(`Toast ${TOAST.MAX_VISIBLE + 2}`);
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss toast after default timeout', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Auto dismiss', { type: 'success' });
      });

      expect(result.current.toasts).toHaveLength(1);

      // Advance time just before timeout
      act(() => {
        vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS - 1);
      });
      expect(result.current.toasts).toHaveLength(1);

      // Advance time past timeout
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.toasts).toHaveLength(0);
    });

    it('should auto-dismiss error toast after error timeout', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Error toast', { type: 'error' });
      });

      expect(result.current.toasts).toHaveLength(1);

      // Default timeout should not dismiss error
      act(() => {
        vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS);
      });
      expect(result.current.toasts).toHaveLength(1);

      // Error timeout should dismiss
      act(() => {
        vi.advanceTimersByTime(TOAST.ERROR_TIMEOUT_MS - TOAST.DEFAULT_TIMEOUT_MS);
      });
      expect(result.current.toasts).toHaveLength(0);
    });

    it('should not auto-dismiss persistent toast', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Persistent', { timeout: null });
      });

      // Advance time significantly
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('removeToast', () => {
    it('should remove a toast by ID', () => {
      const { result } = renderHook(() => useToastStore());

      let id: string = '';
      act(() => {
        id = result.current.addToast('To be removed');
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.removeToast(id);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should remove only the specified toast', () => {
      const { result } = renderHook(() => useToastStore());

      let id1: string = '';
      let id2: string = '';
      act(() => {
        id1 = result.current.addToast('Toast 1');
        id2 = result.current.addToast('Toast 2');
      });

      expect(result.current.toasts).toHaveLength(2);

      act(() => {
        result.current.removeToast(id1);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].id).toBe(id2);
    });

    it('should cancel auto-dismiss timer when manually removed', () => {
      const { result } = renderHook(() => useToastStore());

      let id: string = '';
      act(() => {
        id = result.current.addToast('Will be removed');
      });

      // Remove immediately
      act(() => {
        result.current.removeToast(id);
      });

      expect(result.current.toasts).toHaveLength(0);

      // Advance time past timeout - should not cause errors
      act(() => {
        vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS + 1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should handle removing non-existent toast gracefully', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Existing toast');
      });

      // Should not throw
      act(() => {
        result.current.removeToast('non-existent-id');
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('clearToasts', () => {
    it('should remove all toasts', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Toast 1');
        result.current.addToast('Toast 2');
        result.current.addToast('Toast 3');
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.clearToasts();
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should cancel all auto-dismiss timers', () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast('Toast 1');
        result.current.addToast('Toast 2');
      });

      act(() => {
        result.current.clearToasts();
      });

      // Advance time - should not cause any issues
      act(() => {
        vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS + 1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('toast types', () => {
    it.each(['success', 'error', 'warning', 'info'] as const)('should support %s toast type', (type) => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.addToast(`${type} message`, { type });
      });

      expect(result.current.toasts[0].type).toBe(type);
    });
  });
});
