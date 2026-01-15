'use client';

/**
 * Toast notification component.
 *
 * Provides visual feedback for actions like saving, errors, and success messages.
 * Uses Zustand for state management via the useToastStore hook.
 */
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type Toast as ToastType, type ToastType as ToastVariant } from '@/hooks/useToast';

/**
 * Styling configuration for each toast type.
 * Based on the design system semantic colors.
 */
const toastStyles: Record<
  ToastVariant,
  { bg: string; border: string; text: string; iconColor: string; icon: typeof CheckCircle }
> = {
  success: {
    bg: 'bg-success-light',
    border: 'border-success/20',
    text: 'text-success-dark',
    iconColor: 'text-success',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-error-light',
    border: 'border-error/20',
    text: 'text-error-dark',
    iconColor: 'text-error',
    icon: XCircle,
  },
  warning: {
    bg: 'bg-warning-light',
    border: 'border-warning/20',
    text: 'text-warning-dark',
    iconColor: 'text-warning',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-info-light',
    border: 'border-info/20',
    text: 'text-info-dark',
    iconColor: 'text-info',
    icon: Info,
  },
};

/**
 * Individual toast notification component.
 */
interface ToastItemProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const styles = toastStyles[toast.type];
  const Icon = styles.icon;

  return (
    <div
      role="alert"
      data-testid={`toast-${toast.id}`}
      className={`
        flex items-start gap-3
        w-full max-w-sm
        p-4
        ${styles.bg}
        border ${styles.border}
        rounded-lg
        shadow-warm-lg
        animate-slide-in motion-reduce:animate-none
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.iconColor}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className={`text-sm font-semibold ${styles.text} mb-1`} style={{ fontFamily: 'var(--font-ui)' }}>
            {toast.title}
          </h4>
        )}
        <p className={`text-sm ${styles.text}`} style={{ fontFamily: 'var(--font-ui)' }}>
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={`
          flex-shrink-0
          min-h-[44px] min-w-[44px]
          -m-2.5
          flex items-center justify-center
          rounded-lg
          ${styles.text}
          hover:bg-black/5
          focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          transition-colors
        `}
        aria-label="Dismiss notification"
        data-testid={`toast-dismiss-${toast.id}`}
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Toast container component.
 *
 * Renders the list of active toast notifications in a fixed position at
 * the bottom-right of the viewport. Includes proper ARIA attributes
 * for accessibility.
 *
 * @example
 * ```tsx
 * // In your root layout or app providers:
 * import { ToastContainer } from '@/components/ui/Toast';
 *
 * function App({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <ToastContainer />
 *     </>
 *   );
 * }
 * ```
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Notifications"
      data-testid="toast-container"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}

// Re-export for convenience
export type { ToastType, ToastVariant };
