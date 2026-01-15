'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * ConfirmDialog Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Modal: bg-surface, shadow-xl, rounded-lg (Elevation 3)
 * - Backdrop: color-overlay (rgba with 50% opacity)
 * - Title: font-display (Libre Baskerville) for scholarly emphasis
 * - Body: font-ui (Source Sans 3) for readability
 * - Buttons: Primary/Secondary button patterns
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key handler (Best Practice: Keyboard accessibility)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  // Handle backdrop click (not propagating from dialog content)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!open) return null;

  // Variant styles using design system semantic colors
  const variantStyles = {
    danger: 'bg-error hover:bg-error-dark focus:ring-error',
    warning: 'bg-warning hover:bg-warning-dark focus:ring-warning',
    info: 'bg-quill hover:bg-quill-dark focus:ring-quill',
  };

  const iconStyles = {
    danger: 'bg-error-light text-error',
    warning: 'bg-warning-light text-warning',
    info: 'bg-quill-lighter text-quill',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
      onClick={handleBackdropClick}
      data-testid="confirm-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        tabIndex={-1}
        className="
          bg-surface
          rounded-lg shadow-xl
          w-full max-w-md mx-4 p-6
          focus:outline-none
        "
        data-testid="confirm-dialog"
      >
        <div className="flex items-start gap-4">
          {/* Icon container with semantic color */}
          <div
            className={`
            flex-shrink-0 w-10 h-10
            rounded-full
            flex items-center justify-center
            ${iconStyles[variant]}
          `}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            {/* Title uses display font for scholarly emphasis */}
            <h3 id="confirm-title" className="font-display text-lg font-bold text-ink-primary">
              {title}
            </h3>
            {/* Message uses UI font for readability */}
            <p id="confirm-message" className="mt-2 font-ui text-sm text-ink-secondary">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons with proper touch targets (Best Practice: 44x44px minimum) */}
        <div className="mt-6 flex justify-end gap-3">
          {/* Cancel button - Secondary button pattern */}
          <button
            onClick={onClose}
            className="
              px-4 py-2.5 min-h-[44px]
              font-ui text-sm font-semibold
              text-ink-primary
              bg-surface hover:bg-surface-hover active:bg-surface-active
              border border-ink-faint
              rounded-md shadow-sm
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          {/* Confirm button - Primary button with variant color */}
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2.5 min-h-[44px]
              font-ui text-sm font-semibold
              text-white
              rounded-md shadow-sm
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${variantStyles[variant]}
            `}
            data-testid="confirm-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
