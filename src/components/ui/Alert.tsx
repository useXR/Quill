import type { ReactNode } from 'react';
import { Check, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; icon: typeof Check }> = {
  success: {
    bg: 'bg-[var(--color-success-light)]',
    border: 'border-[var(--color-success)]/20',
    text: 'text-[var(--color-success-dark)]',
    icon: Check,
  },
  warning: {
    bg: 'bg-[var(--color-warning-light)]',
    border: 'border-[var(--color-warning)]/20',
    text: 'text-[var(--color-warning-dark)]',
    icon: AlertCircle,
  },
  error: {
    bg: 'bg-[var(--color-error-light)]',
    border: 'border-[var(--color-error)]/20',
    text: 'text-[var(--color-error-dark)]',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-[var(--color-info-light)]',
    border: 'border-[var(--color-info)]/20',
    text: 'text-[var(--color-info-dark)]',
    icon: Info,
  },
};

const iconColorStyles: Record<AlertVariant, string> = {
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  error: 'text-[var(--color-error)]',
  info: 'text-[var(--color-info)]',
};

export function Alert({ variant, title, children, onDismiss, className = '' }: AlertProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`
        flex items-start gap-3
        p-4
        ${styles.bg}
        border ${styles.border} rounded-[var(--radius-lg)]
        ${className}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorStyles[variant]}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`text-sm font-semibold ${styles.text} mb-1`} style={{ fontFamily: 'var(--font-ui)' }}>
            {title}
          </h4>
        )}
        <div className={`text-sm ${styles.text}`} style={{ fontFamily: 'var(--font-ui)' }}>
          {children}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`
            flex-shrink-0
            p-1 rounded-[var(--radius-sm)]
            ${styles.text}
            hover:bg-black/5
            focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:ring-offset-2
          `}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
