'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Theme toggle button for the header.
 * Cycles through: system → light → dark → system
 * Shows the current effective theme icon.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, cycleTheme } = useTheme();

  // Determine which icon to show
  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  // Accessible label
  const label =
    theme === 'system'
      ? 'Theme: System (click to switch to light)'
      : theme === 'light'
        ? 'Theme: Light (click to switch to dark)'
        : 'Theme: Dark (click to switch to system)';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className="
        flex items-center justify-center
        min-h-[44px] min-w-[44px]
        rounded-md
        text-ink-secondary hover:text-ink-primary
        hover:bg-surface-hover
        focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
        transition-colors duration-150
        motion-reduce:transition-none
      "
      data-testid="theme-toggle"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
