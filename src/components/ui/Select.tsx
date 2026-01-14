import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  leftIcon?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, placeholder, leftIcon, id, className = '', ...props }, ref) => {
    const selectId = id || props.name;
    const hasError = Boolean(error);

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
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
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full px-3 py-2.5 pr-10
              bg-[var(--color-surface)]
              text-[var(--color-ink-primary)] text-base
              border rounded-[var(--radius-md)]
              shadow-[var(--shadow-warm-sm)]
              transition-all duration-150
              hover:border-[var(--color-ink-subtle)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:border-[var(--color-quill)]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-secondary)]
              appearance-none cursor-pointer
              ${leftIcon ? 'pl-10' : ''}
              ${hasError ? 'border-[var(--color-error)] focus:ring-[var(--color-error)] focus:border-[var(--color-error)]' : 'border-[var(--color-ink-faint)]'}
              ${className}
            `}
            style={{ fontFamily: 'var(--font-ui)' }}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--color-ink-tertiary)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p
            id={`${selectId}-error`}
            className="text-sm text-[var(--color-error)]"
            style={{ fontFamily: 'var(--font-ui)' }}
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${selectId}-helper`}
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

Select.displayName = 'Select';
