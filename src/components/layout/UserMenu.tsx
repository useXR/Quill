'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export interface UserMenuProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * User dropdown menu with sign out functionality.
 * Implements proper focus management and keyboard navigation.
 */
export function UserMenu({ className = '' }: UserMenuProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  // Get user display info
  const userEmail = user?.email || '';
  const userInitial = userEmail.charAt(0).toUpperCase() || 'U';

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle Escape key to close menu
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Focus first menu item when opened
  useEffect(() => {
    if (isOpen && firstMenuItemRef.current) {
      firstMenuItemRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/login');
  }, [router]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown' && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
      }
    },
    [isOpen]
  );

  const menuItemClasses =
    'flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-secondary hover:bg-surface-hover hover:text-ink-primary focus:bg-surface-hover focus:text-ink-primary focus:outline-none transition-colors duration-150 motion-reduce:transition-none min-h-[44px]';

  return (
    <div ref={menuRef} className={`relative ${className}`} data-testid="user-menu">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User menu"
        className="flex items-center gap-2 min-h-[44px] min-w-[44px] px-2 rounded-md hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-all duration-150 motion-reduce:transition-none"
        data-testid="user-menu-trigger"
      >
        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-quill-light text-quill font-semibold text-sm">
          {userInitial}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-ink-secondary transition-transform duration-150 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-trigger"
          className="absolute right-0 top-full mt-1 w-56 origin-top-right rounded-lg bg-surface shadow-warm-lg ring-1 ring-ink-faint/10 focus:outline-none z-50"
          data-testid="user-menu-dropdown"
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b border-ink-faint/20">
            <p className="text-sm font-medium text-ink-primary truncate">{userEmail}</p>
            <p className="text-xs text-ink-tertiary mt-0.5">Signed in</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              ref={firstMenuItemRef}
              type="button"
              role="menuitem"
              className={menuItemClasses}
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
              data-testid="user-menu-settings"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings
            </button>

            <button
              type="button"
              role="menuitem"
              className={`${menuItemClasses} text-error hover:text-error`}
              onClick={handleSignOut}
              data-testid="user-menu-signout"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
