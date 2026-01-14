import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    const baseStyles = `
      bg-[var(--color-surface)]
      border border-[var(--color-ink-faint)]
      shadow-[var(--shadow-warm-sm)]
      ${paddingStyles[padding]}
    `;

    const variantStyles =
      variant === 'accent'
        ? 'rounded-[var(--radius-lg)] rounded-l-none border-l-4 border-l-[var(--color-quill)]'
        : 'rounded-[var(--radius-lg)]';

    return (
      <div ref={ref} className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

interface CardLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}

export function CardLink({ href, className = '', children, 'data-testid': testId }: CardLinkProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`
        block
        bg-[var(--color-surface)]
        border border-[var(--color-ink-faint)] rounded-[var(--radius-lg)]
        shadow-[var(--shadow-warm-sm)]
        p-6
        transition-all duration-200
        hover:shadow-[var(--shadow-warm-md)] hover:border-[var(--color-ink-subtle)] hover:-translate-y-0.5
        focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:ring-offset-2
        ${className}
      `}
    >
      {children}
    </Link>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3
      className={`text-lg font-bold text-[var(--color-ink-primary)] ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-[var(--color-ink-secondary)] ${className}`} style={{ fontFamily: 'var(--font-ui)' }}>
      {children}
    </p>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return <div className={`mt-4 pt-4 border-t border-[var(--color-ink-faint)] ${className}`}>{children}</div>;
}
