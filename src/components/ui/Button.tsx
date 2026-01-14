import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--color-quill)] hover:bg-[var(--color-quill-dark)] active:bg-[var(--color-quill-darker)]
    text-white
    shadow-[var(--shadow-warm-sm)] hover:shadow-[var(--shadow-warm-md)]
  `,
  secondary: `
    bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]
    text-[var(--color-ink-primary)]
    border border-[var(--color-ink-faint)]
    shadow-[var(--shadow-warm-sm)]
  `,
  ghost: `
    bg-transparent hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]
    text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]
  `,
  danger: `
    bg-[var(--color-error)] hover:bg-[var(--color-error-dark)]
    text-white
    shadow-[var(--shadow-warm-sm)] hover:shadow-[var(--shadow-warm-md)]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-[var(--font-ui)] font-semibold
          rounded-[var(--radius-md)]
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
