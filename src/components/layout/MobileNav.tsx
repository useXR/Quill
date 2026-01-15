'use client';

import { useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navItems } from './Sidebar';

export interface MobileNavProps {
  /** Whether the mobile nav is open */
  isOpen: boolean;
  /** Callback to close the mobile nav */
  onClose: () => void;
}

/**
 * Mobile navigation drawer with backdrop and focus trap.
 * Slides in from left with accessibility features.
 */
export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Save last focused element and focus close button when opened
  useEffect(() => {
    if (isOpen) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      // Focus close button after animation starts
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else {
      // Return focus to previously focused element
      lastFocusedRef.current?.focus();
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Trap focus within drawer
  useEffect(() => {
    const handleTabKey = (event: KeyboardEvent) => {
      if (!isOpen || event.key !== 'Tab' || !drawerRef.current) return;

      const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleTabKey);
      return () => document.removeEventListener('keydown', handleTabKey);
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-50 lg:hidden"
      data-testid="mobile-nav"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay transition-opacity duration-200 motion-reduce:transition-none"
        onClick={handleBackdropClick}
        aria-hidden="true"
        data-testid="mobile-nav-backdrop"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-bg-secondary shadow-warm-xl transform transition-transform duration-200 motion-reduce:transition-none"
        data-testid="mobile-nav-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-faint/20">
          <Link
            href="/projects"
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-colors duration-150 motion-reduce:transition-none"
            onClick={onClose}
          >
            <svg className="h-8 w-8 text-quill" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.71 4.04c-.61-.61-1.42-.94-2.3-.94-.85 0-1.64.31-2.24.87L7.53 12.6c-.35.35-.62.77-.78 1.23l-.97 2.85c-.13.38-.03.79.26 1.08.21.21.49.32.77.32.1 0 .21-.01.31-.05l2.85-.97c.46-.16.88-.43 1.23-.78l8.63-8.64c.56-.56.87-1.31.87-2.1 0-.81-.32-1.58-.89-2.15l-.1-.15zm-9.41 11.96c-.18.18-.41.32-.66.39l-1.81.62.62-1.81c.07-.25.21-.48.39-.66l6.44-6.44 1.46 1.46-6.44 6.44z" />
            </svg>
            <span className="text-xl font-display font-bold text-ink-primary">Quill</span>
          </Link>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-colors duration-150 motion-reduce:transition-none"
            data-testid="mobile-nav-close"
          >
            <X className="h-6 w-6 text-ink-secondary" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2" role="navigation">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`
                      flex items-center gap-3 min-h-[44px] px-3 rounded-lg
                      font-medium text-sm
                      transition-colors duration-150 motion-reduce:transition-none
                      focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                      ${
                        isActive
                          ? 'bg-quill-light text-quill'
                          : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                      }
                    `}
                    data-testid={`mobile-nav-item-${item.label.toLowerCase()}`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
