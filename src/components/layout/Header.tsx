'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';

export interface HeaderProps {
  /** Whether the mobile hamburger menu is visible */
  isMobile?: boolean;
  /** Callback when hamburger menu is clicked */
  onMenuClick?: () => void;
}

/**
 * Application header with logo, hamburger menu (mobile), and user menu.
 */
export function Header({ isMobile = false, onMenuClick }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 bg-surface px-4 border-b border-ink-faint/20 shadow-warm-xs"
      data-testid="app-header"
    >
      {/* Left side: hamburger + logo */}
      <div className="flex items-center gap-3">
        {/* Hamburger menu - mobile only */}
        {isMobile && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-colors duration-150 motion-reduce:transition-none"
            data-testid="mobile-menu-button"
          >
            <Menu className="h-6 w-6 text-ink-secondary" aria-hidden="true" />
          </button>
        )}

        {/* Logo */}
        <Link
          href="/projects"
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-colors duration-150 motion-reduce:transition-none"
          data-testid="header-logo"
        >
          <svg className="h-8 w-8 text-quill" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {/* Simple quill/feather icon */}
            <path d="M20.71 4.04c-.61-.61-1.42-.94-2.3-.94-.85 0-1.64.31-2.24.87L7.53 12.6c-.35.35-.62.77-.78 1.23l-.97 2.85c-.13.38-.03.79.26 1.08.21.21.49.32.77.32.1 0 .21-.01.31-.05l2.85-.97c.46-.16.88-.43 1.23-.78l8.63-8.64c.56-.56.87-1.31.87-2.1 0-.81-.32-1.58-.89-2.15l-.1-.15zm-9.41 11.96c-.18.18-.41.32-.66.39l-1.81.62.62-1.81c.07-.25.21-.48.39-.66l6.44-6.44 1.46 1.46-6.44 6.44z" />
          </svg>
          <span className="text-xl font-display font-bold text-ink-primary">Quill</span>
        </Link>
      </div>

      {/* Right side: theme toggle + user menu */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
