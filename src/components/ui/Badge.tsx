import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-bg-secondary)] text-[var(--color-ink-secondary)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]',
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
  error: 'bg-[var(--color-error-light)] text-[var(--color-error-dark)]',
  info: 'bg-[var(--color-info-light)] text-[var(--color-info-dark)]',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ variant = 'default', size = 'md', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        font-medium
        rounded-[var(--radius-md)]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {children}
    </span>
  );
}

type StatusBadgeStatus = 'draft' | 'submitted' | 'funded' | 'rejected';

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  className?: string;
}

const statusConfig: Record<StatusBadgeStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'default' },
  submitted: { label: 'Submitted', variant: 'info' },
  funded: { label: 'Funded', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
