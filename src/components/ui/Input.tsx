import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, rightIcon, id, className = '', ...props }, ref) => {
    const inputId = id || props.name;
    const hasError = Boolean(error);

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-ink-secondary)]"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {label}
            {props.required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-ink-tertiary)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-3 py-2.5
              bg-[var(--color-surface)]
              text-[var(--color-ink-primary)] text-base
              placeholder:text-[var(--color-ink-subtle)]
              border rounded-[var(--radius-md)]
              shadow-[var(--shadow-warm-sm)]
              transition-all duration-150
              hover:border-[var(--color-ink-subtle)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:border-[var(--color-quill)]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-secondary)]
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${hasError ? 'border-[var(--color-error)] focus:ring-[var(--color-error)] focus:border-[var(--color-error)]' : 'border-[var(--color-ink-faint)]'}
              ${className}
            `}
            style={{ fontFamily: 'var(--font-ui)' }}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--color-ink-tertiary)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-[var(--color-error)]"
            style={{ fontFamily: 'var(--font-ui)' }}
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-[var(--color-ink-tertiary)]"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, id, className = '', ...props }, ref) => {
    const inputId = id || props.name;
    const hasError = Boolean(error);

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-ink-secondary)]"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {label}
            {props.required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2.5
            bg-[var(--color-surface)]
            text-[var(--color-ink-primary)] text-base
            placeholder:text-[var(--color-ink-subtle)]
            border rounded-[var(--radius-md)]
            shadow-[var(--shadow-warm-sm)]
            resize-none
            transition-all duration-150
            hover:border-[var(--color-ink-subtle)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:border-[var(--color-quill)]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-secondary)]
            ${hasError ? 'border-[var(--color-error)] focus:ring-[var(--color-error)] focus:border-[var(--color-error)]' : 'border-[var(--color-ink-faint)]'}
            ${className}
          `}
          style={{ fontFamily: 'var(--font-ui)' }}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-[var(--color-error)]"
            style={{ fontFamily: 'var(--font-ui)' }}
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-[var(--color-ink-tertiary)]"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
