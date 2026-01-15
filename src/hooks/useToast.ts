'use client';

/**
 * Zustand store for managing toast notifications.
 *
 * Provides centralized state management for toast notifications with
 * auto-dismiss functionality and support for different toast types.
 */
import { create } from 'zustand';
import { TOAST } from '@/lib/constants/toast';

/**
 * Toast notification types with semantic meaning.
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Individual toast notification.
 */
export interface Toast {
  /** Unique identifier for the toast */
  id: string;
  /** Type determines styling and timeout */
  type: ToastType;
  /** Main message to display */
  message: string;
  /** Optional title for the toast */
  title?: string;
  /** Timeout in milliseconds (null for persistent) */
  timeout?: number | null;
}

/**
 * Options for creating a new toast.
 */
export interface ToastOptions {
  /** Type determines styling and timeout */
  type?: ToastType;
  /** Optional title for the toast */
  title?: string;
  /** Custom timeout in milliseconds (null for persistent, undefined for default) */
  timeout?: number | null;
}

/**
 * Toast store state and actions interface.
 */
interface ToastStore {
  /** Active toasts (limited to MAX_VISIBLE) */
  toasts: Toast[];

  /**
   * Add a new toast notification.
   * @param message - Main message to display
   * @param options - Optional configuration
   * @returns The ID of the created toast
   */
  addToast: (message: string, options?: ToastOptions) => string;

  /**
   * Remove a toast by ID.
   * @param id - Toast ID to remove
   */
  removeToast: (id: string) => void;

  /**
   * Clear all toasts.
   */
  clearToasts: () => void;
}

// Store timeout IDs for cleanup
const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Zustand store for toast notification management.
 *
 * @example
 * ```tsx
 * const { addToast, removeToast } = useToastStore();
 *
 * // Show a success toast
 * addToast('Document saved successfully', { type: 'success' });
 *
 * // Show an error toast (will auto-dismiss in 10s)
 * addToast('Failed to save document', { type: 'error', title: 'Error' });
 *
 * // Show a persistent toast
 * const id = addToast('Action required', { type: 'warning', timeout: null });
 * // Manually remove it later
 * removeToast(id);
 * ```
 */
export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (message, options = {}) => {
    const { type = 'info', title, timeout } = options;
    const id = crypto.randomUUID();

    // Determine timeout: explicit value, null (persistent), or default based on type
    const effectiveTimeout =
      timeout !== undefined ? timeout : type === 'error' ? TOAST.ERROR_TIMEOUT_MS : TOAST.DEFAULT_TIMEOUT_MS;

    const toast: Toast = {
      id,
      type,
      message,
      title,
      timeout: effectiveTimeout,
    };

    set((state) => {
      // Add new toast and trim to MAX_VISIBLE (oldest removed first)
      const newToasts = [...state.toasts, toast];
      const removedToasts = newToasts.slice(0, -TOAST.MAX_VISIBLE);
      const visibleToasts = newToasts.slice(-TOAST.MAX_VISIBLE);

      // Clear timeouts for removed toasts
      removedToasts.forEach((t) => {
        const existingTimeout = timeoutMap.get(t.id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          timeoutMap.delete(t.id);
        }
      });

      return { toasts: visibleToasts };
    });

    // Set up auto-dismiss if timeout is specified
    if (effectiveTimeout !== null && effectiveTimeout > 0) {
      const timeoutId = setTimeout(() => {
        get().removeToast(id);
      }, effectiveTimeout);
      timeoutMap.set(id, timeoutId);
    }

    return id;
  },

  removeToast: (id) => {
    // Clear the timeout if it exists
    const existingTimeout = timeoutMap.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutMap.delete(id);
    }

    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clearToasts: () => {
    // Clear all timeouts
    timeoutMap.forEach((timeout) => clearTimeout(timeout));
    timeoutMap.clear();

    set({ toasts: [] });
  },
}));

/**
 * Hook for toast notifications.
 * Re-exports the store for convenience.
 */
export const useToast = useToastStore;
