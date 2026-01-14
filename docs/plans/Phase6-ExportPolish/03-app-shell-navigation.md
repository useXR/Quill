# Task 6.3: App Shell & Navigation

> **Phase 6** | [← PDF Export](./02-pdf-export.md) | [Next: Loading States & Error Handling →](./04-loading-error-handling.md)

---

## Design System Context

The app shell is the primary implementation of the **Scholarly Craft** aesthetic. All components must use design tokens from `docs/design-system.md`.

### Key Design Tokens for This Task

| Element            | Design Token                | Value                |
| ------------------ | --------------------------- | -------------------- |
| Page background    | `bg-bg-primary`             | #faf8f5 (warm cream) |
| Sidebar background | `bg-bg-secondary`           | #f5f3f0              |
| Header background  | `bg-surface`                | #ffffff              |
| Primary text       | `text-ink-primary`          | #1c1917              |
| Secondary text     | `text-ink-secondary`        | #44403c              |
| Muted text         | `text-ink-tertiary`         | #78716c              |
| Borders            | `border-ink-faint`          | #d6d3d1              |
| Active nav item    | `bg-quill-light text-quill` | #ede9fe / #7c3aed    |
| Hover states       | `hover:bg-surface-hover`    | #f9f8f7              |

### Typography

- **Logo/Brand:** `font-display text-xl font-semibold text-ink-primary`
- **Nav Labels:** `font-ui text-sm font-medium`
- **Menu Items:** `font-ui text-base`

### Interactive Element Standards

- **Touch Targets:** All buttons use `min-h-[44px] min-w-[44px]` (WCAG 2.5.8)
- **Focus Rings:** `focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2`
- **Transitions:** `transition-all duration-150 motion-reduce:transition-none`
- **Border Radius:** `rounded-md` for buttons, `rounded-lg` for cards/panels

### Shadow System

- **Headers:** `shadow-sm` (subtle elevation)
- **Dropdowns:** `shadow-lg` (floating elements)
- **Mobile Drawer:** `shadow-lg` (modal-level elevation)

---

## Context

**This task implements the responsive app shell with sidebar navigation, mobile drawer, and accessibility features.** The app shell wraps all authenticated pages and provides consistent navigation.

### Prerequisites

- **Task 6.1** completed (DOCX Export)
- **Task 6.2** completed (PDF Export)

### What This Task Creates

- `src/styles/accessibility.css` - Shared accessibility styles
- `src/hooks/useMediaQuery.ts` - Responsive breakpoint hook
- `src/hooks/__tests__/useMediaQuery.test.ts` - Hook tests
- `src/components/layout/SkipLinks.tsx` - Accessibility skip links
- `src/components/layout/UserMenu.tsx` - User dropdown menu
- `src/components/layout/__tests__/UserMenu.test.tsx` - UserMenu tests
- `src/components/layout/Header.tsx` - App header
- `src/components/layout/Sidebar.tsx` - Desktop sidebar navigation
- `src/components/layout/MobileNav.tsx` - Mobile navigation drawer
- `src/components/layout/AppShell.tsx` - Main shell component
- `src/components/layout/AppProviders.tsx` - Layout with Toast/CommandPalette

### Tasks That Depend on This

- **Task 6.4** (Loading States) - Skeletons in shell
- **Task 6.5** (Toast Notifications) - Toast container in shell
- **Task 6.6** (Command Palette) - Command palette in shell
- **Task 6.7** (E2E Tests) - Navigation testing

---

## Files to Create/Modify

- `src/styles/accessibility.css` (create)
- `src/hooks/useMediaQuery.ts` (create)
- `src/hooks/__tests__/useMediaQuery.test.ts` (create)
- `src/components/layout/SkipLinks.tsx` (create)
- `src/components/layout/UserMenu.tsx` (create)
- `src/components/layout/__tests__/UserMenu.test.tsx` (create)
- `src/components/layout/Header.tsx` (create)
- `src/components/layout/Sidebar.tsx` (create)
- `src/components/layout/MobileNav.tsx` (create)
- `src/components/layout/AppShell.tsx` (create)
- `src/components/layout/AppProviders.tsx` (create)
- `src/app/(authenticated)/layout.tsx` (modify)
- `src/app/globals.css` (modify - import accessibility styles)

---

## Steps

### Step 1: Create shared accessibility styles

Create `src/styles/accessibility.css`:

```css
/**
 * Accessibility Styles
 * Following WCAG 2.1 AA guidelines
 * Uses design system tokens from docs/design-system.md
 */

/* Focus visible styles - clear keyboard focus indicators using Quill brand color */
.focus-ring:focus-visible {
  outline: 2px solid var(--color-quill, #7c3aed);
  outline-offset: 2px;
}

/* Remove default outline and use focus-visible instead */
button:focus-visible,
a:focus-visible,
[role='button']:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--color-quill, #7c3aed);
  outline-offset: 2px;
}

/* Touch target minimums - WCAG 2.5.8 Target Size (Minimum) */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* For icon-only buttons, ensure they meet touch target requirements */
.touch-target-icon {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Reduced motion support - WCAG 2.3.3 Animation from Interactions */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .border {
    border-width: 2px;
  }
}

/* Screen reader only - visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* When focused, make visible (for skip links) */
.sr-only-focusable:focus,
.sr-only-focusable:focus-within {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### Step 2: Import accessibility styles in globals.css

Add to `src/app/globals.css`:

```css
@import '../styles/accessibility.css';
```

### Step 3: Create useMediaQuery hook

Create `src/hooks/useMediaQuery.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

### Step 4: Create SkipLinks for accessibility

Create `src/components/layout/SkipLinks.tsx`:

```typescript
/**
 * Skip links for keyboard navigation accessibility.
 * Uses design system tokens: bg-quill for brand-consistent styling.
 */
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-4 left-4 z-50 bg-quill text-white px-4 py-2.5 rounded-md font-ui font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-quill"
      >
        Skip to main content
      </a>
    </div>
  );
}
```

### Step 5: Create UserMenu component with touch targets and focus management

Create `src/components/layout/UserMenu.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { User, LogOut, Settings } from 'lucide-react';

/**
 * User menu dropdown with Scholarly Craft styling.
 * Design tokens: bg-surface, text-ink-*, hover:bg-surface-hover, shadow-lg
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape key and return focus to button
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  const handleSignOut = async () => {
    // Sign out logic will be implemented with Supabase auth
    window.location.href = '/login';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-surface-hover rounded-full transition-colors motion-reduce:transition-none text-ink-secondary hover:text-ink-primary"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <User className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 bg-surface border border-ink-faint rounded-lg shadow-lg py-1"
          role="menu"
        >
          <a
            href="/settings"
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-surface-hover text-ink-primary font-ui text-sm"
            role="menuitem"
          >
            <Settings className="w-4 h-4" />
            Settings
          </a>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-surface-hover w-full text-left text-error font-ui text-sm"
            role="menuitem"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 6: Create Header component

Create `src/components/layout/Header.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
}

/**
 * App header with Scholarly Craft styling.
 * Design tokens: bg-surface, border-ink-faint, font-display, shadow-sm
 */
export function Header({ onMenuClick, showMenuButton }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-ink-faint shadow-sm z-40">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-surface-hover rounded-md transition-colors motion-reduce:transition-none text-ink-secondary hover:text-ink-primary"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link
            href="/projects"
            className="font-display text-xl font-semibold text-ink-primary hover:text-quill transition-colors motion-reduce:transition-none"
          >
            Quill
          </Link>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
```

### Step 7: Create Sidebar component with touch targets

Create `src/components/layout/Sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderOpen,
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/vault', icon: Archive, label: 'Vault' },
  { href: '/citations', icon: BookOpen, label: 'Citations' },
];

/**
 * Sidebar navigation with Scholarly Craft styling.
 * Design tokens: bg-bg-secondary, border-ink-faint, bg-quill-light/text-quill for active state
 */
export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 bg-bg-secondary border-r border-ink-faint transition-all duration-200 motion-reduce:transition-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <nav className="p-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg mb-1 font-ui text-sm transition-colors motion-reduce:transition-none ${
                isActive
                  ? 'bg-quill-light text-quill font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
              }`}
              title={collapsed ? label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onToggleCollapse}
        className="absolute bottom-4 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-surface-hover text-ink-tertiary hover:text-ink-primary rounded-lg transition-colors motion-reduce:transition-none"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        ) : (
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
```

### Step 8: Create MobileNav component

Create `src/components/layout/MobileNav.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, FolderOpen, Archive, BookOpen } from 'lucide-react';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/vault', icon: Archive, label: 'Vault' },
  { href: '/citations', icon: BookOpen, label: 'Citations' },
];

/**
 * Mobile navigation drawer with Scholarly Craft styling.
 * Design tokens: bg-surface, border-ink-faint, font-display, shadow-lg, overlay
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when opened
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop - uses design system overlay color */}
      <div
        className="fixed inset-0 bg-overlay z-40 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 left-0 bottom-0 w-64 bg-surface z-50 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between p-4 border-b border-ink-faint">
          <span className="font-display text-xl font-semibold text-ink-primary">Quill</span>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-surface-hover text-ink-tertiary hover:text-ink-primary rounded-lg transition-colors motion-reduce:transition-none"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="p-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg mb-1 font-ui text-sm transition-colors motion-reduce:transition-none ${
                  isActive
                    ? 'bg-quill-light text-quill font-medium'
                    : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
```

### Step 9: Create AppShell component

Create `src/components/layout/AppShell.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SkipLinks } from './SkipLinks';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Main application shell with Scholarly Craft styling.
 * Design tokens: bg-bg-primary (warm cream page background)
 */
export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  // Close mobile nav on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    setSidebarCollapsed(isTablet);
  }, [isTablet]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <SkipLinks />
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        showMenuButton={isMobile}
      />

      {isMobile ? (
        <MobileNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={`pt-16 transition-all duration-200 motion-reduce:transition-none ${
          !isMobile && (sidebarCollapsed ? 'pl-16' : 'pl-64')
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
```

### Step 10: Create layout integration component

Create `src/components/layout/AppProviders.tsx`:

```typescript
'use client';

import { AppShell } from './AppShell';
import { ToastContainer } from '@/components/ui/Toast';
import { CommandPalette } from '@/components/ui/CommandPalette';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AppShell>
      {children}
      <ToastContainer />
      <CommandPalette />
    </AppShell>
  );
}
```

**Note:** ToastContainer and CommandPalette will be created in Tasks 6.5 and 6.6. For now, create stub components or comment out these imports until those tasks are complete.

### Step 11: Update app layout to use AppProviders

Modify `src/app/(authenticated)/layout.tsx`:

```typescript
import { AppProviders } from '@/components/layout/AppProviders';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProviders>{children}</AppProviders>;
}
```

### Step 12: Write tests for useMediaQuery hook

Create `src/hooks/__tests__/useMediaQuery.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
  const mockMatchMedia = vi.fn();
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();

  beforeEach(() => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });
    window.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial match state', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('adds event listener on mount', () => {
    renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates when media query changes', () => {
    let changeHandler: (e: { matches: boolean }) => void;
    mockAddEventListener.mockImplementation((event, handler) => {
      changeHandler = handler;
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      changeHandler({ matches: true });
    });

    expect(result.current).toBe(true);
  });
});
```

### Step 13: Write tests for UserMenu component

Create `src/components/layout/__tests__/UserMenu.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UserMenu } from '../UserMenu';

describe('UserMenu', () => {
  it('renders user menu button', () => {
    render(<UserMenu />);
    expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
  });

  it('opens menu on click', async () => {
    render(<UserMenu />);
    const button = screen.getByRole('button', { name: /user menu/i });

    await userEvent.click(button);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes menu on outside click', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <UserMenu />
      </div>
    );

    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu on Escape key', async () => {
    render(<UserMenu />);

    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('has correct ARIA attributes', async () => {
    render(<UserMenu />);
    const button = screen.getByRole('button', { name: /user menu/i });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-haspopup', 'true');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('menu button meets touch target requirements', () => {
    render(<UserMenu />);
    const button = screen.getByRole('button', { name: /user menu/i });

    // Check for min-h-[44px] and min-w-[44px] classes
    expect(button).toHaveClass('min-h-[44px]');
    expect(button).toHaveClass('min-w-[44px]');
  });

  it('menu items meet touch target requirements', async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));

    const menuItems = screen.getAllByRole('menuitem');
    menuItems.forEach((item) => {
      expect(item).toHaveClass('min-h-[44px]');
    });
  });
});
```

### Step 14: Run tests to verify they pass

```bash
npm test -- src/hooks/__tests__/useMediaQuery.test.ts src/components/layout/__tests__/UserMenu.test.tsx
```

**Expected:** All tests PASS

### Step 15: Commit

```bash
git add src/styles/ src/hooks/ src/components/layout/ src/app/\(authenticated\)/layout.tsx src/app/globals.css
git commit -m "feat: add app shell with responsive navigation

- Add accessibility.css with focus-visible, touch targets, reduced motion
- Add useMediaQuery hook for responsive behavior
- Add SkipLinks for keyboard navigation
- Add UserMenu with proper focus management and touch targets
- Add Header with mobile menu button
- Add Sidebar with collapsible state and touch targets
- Add MobileNav drawer with focus trap
- Add AppShell responsive container
- Add AppProviders layout integration
- All interactive elements meet 44x44px touch target minimum
- Support prefers-reduced-motion for animations"
```

**Expected:** Commit created successfully

---

## E2E Page Object

**IMPORTANT:** Page objects must be created in the same task as the feature they test, not deferred to Task 6.7. This ensures consistent test patterns and reduces integration issues.

### Create `e2e/pages/MobileNavPage.ts`

Create the MobileNavPage page object following the existing pattern from Phase 0:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for mobile navigation interactions.
 * Follows Phase 0 page object pattern from LoginPage.ts.
 */
export class MobileNavPage {
  readonly page: Page;
  readonly hamburgerButton: Locator;
  readonly closeButton: Locator;
  readonly drawer: Locator;
  readonly backdrop: Locator;
  readonly quillLogo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.hamburgerButton = page.getByRole('button', { name: /open menu/i });
    this.closeButton = page.getByRole('button', { name: /close menu/i });
    this.drawer = page.getByRole('dialog', { name: /navigation/i });
    // Uses design system overlay token (bg-overlay) which renders as rgba scrim
    this.backdrop = page.locator('.bg-overlay');
    this.quillLogo = page.getByRole('link', { name: /quill/i });
  }

  async openDrawer() {
    await this.hamburgerButton.click();
    await expect(this.drawer).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async closeDrawer() {
    await this.closeButton.click();
    await expect(this.drawer).not.toBeVisible();
  }

  async closeViaBackdrop() {
    await this.backdrop.click();
    await expect(this.drawer).not.toBeVisible();
  }

  async navigateTo(linkName: string | RegExp) {
    const link = this.drawer.getByRole('link', { name: linkName });
    await link.click();
  }

  async clickLogo() {
    await this.quillLogo.click();
  }

  async expectHamburgerVisible() {
    await expect(this.hamburgerButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  async expectHamburgerNotVisible() {
    await expect(this.hamburgerButton).not.toBeVisible();
  }

  async expectDrawerClosed() {
    await expect(this.drawer).not.toBeVisible();
  }
}
```

---

## E2E Tests

**IMPORTANT:** E2E tests must be created as part of this task, not deferred to Task 6.7. This follows the incremental testing pattern established in earlier phases.

### Create `e2e/navigation/skip-links.spec.ts`

Test skip link visibility and functionality:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Skip Links', () => {
  test.beforeEach(async ({ page, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
  });

  test('skip link is visually hidden by default', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /skip to main/i });
    // Skip link should exist but not be visible until focused
    await expect(skipLink).toHaveCount(1);
    const box = await skipLink.boundingBox();
    // When sr-only, bounding box will be very small or null
    expect(box === null || box.width <= 1 || box.height <= 1).toBe(true);
  });

  test('skip link becomes visible on focus', async ({ page }) => {
    // Tab to the skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to main/i });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });

  test('skip link navigates to main content', async ({ page }) => {
    // Tab to skip link and activate it
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Main content should receive focus
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeFocused();
  });
});
```

### Create `e2e/navigation/mobile-nav.spec.ts`

Test mobile drawer functionality:

```typescript
import { test, expect, devices } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Mobile Navigation', () => {
  test.use({ ...devices['iPhone 12'] });

  test.beforeEach(async ({ page }) => {
    // Login and navigate (mobile viewport)
    await page.goto('/projects');
  });

  test('hamburger menu opens drawer', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).toBeVisible();

    await hamburger.click();

    const drawer = page.getByRole('dialog', { name: /navigation/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  });

  test('drawer closes on close button click', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await hamburger.click();

    const closeButton = page.getByRole('button', { name: /close menu/i });
    await closeButton.click();

    const drawer = page.getByRole('dialog', { name: /navigation/i });
    await expect(drawer).not.toBeVisible();
  });

  test('drawer closes on backdrop click', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await hamburger.click();

    // Click backdrop (bg-overlay class)
    const backdrop = page.locator('.bg-overlay');
    await backdrop.click();

    const drawer = page.getByRole('dialog', { name: /navigation/i });
    await expect(drawer).not.toBeVisible();
  });

  test('drawer closes on Escape key', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await hamburger.click();

    await page.keyboard.press('Escape');

    const drawer = page.getByRole('dialog', { name: /navigation/i });
    await expect(drawer).not.toBeVisible();
  });
});
```

### Create `e2e/navigation/app-shell.spec.ts`

Test header, sidebar, and navigation. **Note:** This task uses the `MobileNavPage` page object created above.

```typescript
import { test, expect, devices } from '@playwright/test';
import { MobileNavPage } from '../pages/MobileNavPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('App Shell', () => {
  test.describe('Desktop', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('domcontentloaded');
    });

    test('header is visible with logo', async ({ page }) => {
      const header = page.locator('header');
      await expect(header).toBeVisible();

      const logo = header.getByRole('link', { name: /quill/i });
      await expect(logo).toBeVisible();
    });

    test('Quill logo navigates to /projects', async ({ page }) => {
      // Navigate to a different page first
      await page.goto('/vault');
      await page.waitForLoadState('domcontentloaded');

      // Click the Quill logo in header
      const logo = page.locator('header').getByRole('link', { name: /quill/i });
      await logo.click();

      // Should navigate to projects page
      await expect(page).toHaveURL(/\/projects/);
    });

    test('sidebar navigation is visible on desktop', async ({ page }) => {
      const sidebar = page.getByRole('navigation', { name: /main navigation/i });
      await expect(sidebar).toBeVisible();
    });

    test('navigation links highlight active route', async ({ page }) => {
      const projectsLink = page.getByRole('link', { name: /projects/i }).first();
      await expect(projectsLink).toHaveAttribute('aria-current', 'page');
    });

    test('sidebar collapse button works', async ({ page }) => {
      const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
      await collapseButton.click();

      // Sidebar should be collapsed (narrower width)
      const sidebar = page.getByRole('navigation', { name: /main navigation/i });
      const box = await sidebar.boundingBox();
      expect(box?.width).toBeLessThan(100); // Collapsed width ~64px
    });
  });

  test.describe('Mobile', () => {
    test.use({ ...devices['iPhone 12'] });

    let mobileNav: MobileNavPage;

    test.beforeEach(async ({ page }) => {
      mobileNav = new MobileNavPage(page);
    });

    test('hamburger menu visible on mobile', async ({ page }) => {
      await page.goto('/projects');
      await mobileNav.expectHamburgerVisible();
    });

    test('sidebar not visible on mobile', async ({ page }) => {
      await page.goto('/projects');

      const sidebar = page.getByRole('navigation', { name: /main navigation/i });
      await expect(sidebar).not.toBeVisible();
    });

    test('Quill logo navigates to /projects on mobile', async ({ page }) => {
      // Navigate to a different page first
      await page.goto('/vault');
      await page.waitForLoadState('domcontentloaded');

      // Click the Quill logo in header
      await mobileNav.clickLogo();

      // Should navigate to projects page
      await expect(page).toHaveURL(/\/projects/);
    });
  });
});
```

---

## Touch Target Testing

**IMPORTANT:** All interactive elements must meet WCAG 2.5.8 Target Size (Minimum) of 44x44 pixels.

### Create touch target verification tests in `e2e/navigation/app-shell.spec.ts`

Add this test to the Desktop describe block:

```typescript
test('all buttons meet 44px minimum touch target', async ({ page }) => {
  await page.goto('/projects');

  // Check all buttons in the app shell
  const buttons = page.locator('button');
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    if (await button.isVisible()) {
      const box = await button.boundingBox();
      if (box) {
        expect(box.height, `Button ${i} height should be >= 44px`).toBeGreaterThanOrEqual(44);
        expect(box.width, `Button ${i} width should be >= 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
```

### Testing Best Practices Pattern

Following the pattern from `docs/best-practices/testing-best-practices.md`:

```typescript
// Use boundingBox() to verify touch target size
const box = await button.boundingBox();
if (box) {
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
}
```

This pattern should be applied to all new interactive elements created in this task.

---

## ARIA Testing

**IMPORTANT:** Verify ARIA attributes are correctly set for accessibility.

### Add ARIA verification to mobile-nav tests

Add these tests to `e2e/navigation/mobile-nav.spec.ts`:

```typescript
test('hamburger button has aria-expanded attribute', async ({ page }) => {
  const hamburger = page.getByRole('button', { name: /open menu/i });

  // Initially not expanded
  await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

  await hamburger.click();

  // After opening
  await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
});

test('mobile drawer has correct ARIA attributes', async ({ page }) => {
  const hamburger = page.getByRole('button', { name: /open menu/i });
  await hamburger.click();

  const drawer = page.getByRole('dialog', { name: /navigation/i });

  // Verify dialog role and modal behavior
  await expect(drawer).toHaveAttribute('role', 'dialog');
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
});

test('close button focuses when drawer opens', async ({ page }) => {
  const hamburger = page.getByRole('button', { name: /open menu/i });
  await hamburger.click();

  const closeButton = page.getByRole('button', { name: /close menu/i });
  await expect(closeButton).toBeFocused();
});
```

### Run E2E Tests

```bash
npm run test:e2e -- --grep "Skip Links|Mobile Navigation|App Shell"
```

**Expected:** All navigation E2E tests pass

---

## E2E Verification

Before proceeding to the next task, verify:

- [ ] All unit tests pass (`npm test -- src/hooks/ src/components/layout/`)
- [ ] Skip link tests pass (`npm run test:e2e -- --grep "Skip Links"`)
- [ ] Mobile nav tests pass (`npm run test:e2e -- --grep "Mobile Navigation"`)
- [ ] App shell tests pass (`npm run test:e2e -- --grep "App Shell"`)
- [ ] All buttons meet 44x44px touch target minimum (verified via boundingBox)
- [ ] Hamburger menu has `aria-expanded` attribute
- [ ] Mobile drawer has `role="dialog"` and `aria-modal="true"`

**Do not proceed to Task 6.4 until all E2E tests pass.**

---

## Verification Checklist

- [ ] accessibility.css created with focus-visible, touch targets, reduced motion
- [ ] useMediaQuery hook responds to breakpoint changes
- [ ] SkipLinks visible on focus for keyboard navigation
- [ ] UserMenu opens/closes on click
- [ ] UserMenu closes on outside click and Escape key
- [ ] UserMenu returns focus to button on close
- [ ] Header displays hamburger menu only on mobile
- [ ] Sidebar collapses on tablet, full-width on desktop
- [ ] MobileNav drawer opens/closes with backdrop
- [ ] MobileNav focuses close button when opened
- [ ] Navigation links highlight active route (aria-current)
- [ ] AppShell adapts to mobile/tablet/desktop
- [ ] All buttons meet 44x44px minimum touch target
- [ ] All transitions respect prefers-reduced-motion
- [ ] All ARIA attributes correctly set
- [ ] All tests pass
- [ ] Changes committed

---

## Accessibility Notes

### Touch Targets

All interactive elements use `min-h-[44px] min-w-[44px]` to meet WCAG 2.5.8 Target Size requirements.

### Focus Management

- Skip link allows keyboard users to bypass navigation
- Mobile nav traps focus and returns it when closed
- UserMenu returns focus to trigger on close
- Focus rings use `focus:ring-2 focus:ring-quill focus:ring-offset-2`

### Color Contrast (Design System Compliance)

The color scheme uses design system tokens that meet WCAG 2.1 AA:

- `text-ink-primary` (#1c1917) on `bg-bg-primary` (#faf8f5) = 14.5:1 (AAA)
- `text-ink-secondary` (#44403c) on `bg-bg-primary` = 8.2:1 (AAA)
- `text-quill` (#7c3aed) on `bg-quill-light` (#ede9fe) = 4.6:1 (AA)
- White on `bg-quill` (#7c3aed) = 4.6:1 (AA)

### Reduced Motion

All components include `motion-reduce:transition-none` to respect user preferences per WCAG 2.3.3.

### Design System Token Summary

| Use Case       | Token                       | Accessibility Note          |
| -------------- | --------------------------- | --------------------------- |
| Primary text   | `text-ink-primary`          | 14.5:1 contrast on cream    |
| Secondary text | `text-ink-secondary`        | 8.2:1 contrast (AAA)        |
| Muted text     | `text-ink-tertiary`         | 4.8:1 contrast (AA)         |
| Active nav     | `bg-quill-light text-quill` | 4.6:1 contrast (AA)         |
| Focus rings    | `ring-quill`                | High visibility brand color |

---

## Additional E2E Tests

Add to `e2e/navigation/app-shell.spec.ts`:

```typescript
test('sign out flow completes successfully', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  // Click user menu
  await page.getByTestId('user-menu').click();
  // Click sign out
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  // Verify redirect to login
  await expect(page).toHaveURL(/\/login/);
  // Verify session cleared (try to access protected route)
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login/);
});

test('sidebar collapse state persists across navigation', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  // Collapse sidebar
  await page.getByTestId('sidebar-toggle').click();
  // Navigate to another page
  await page.getByRole('link', { name: /vault/i }).click();
  // Verify sidebar still collapsed
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
});

test('mobile drawer closes on route change', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  // Open drawer
  await page.getByTestId('mobile-menu-button').click();
  // Click nav link
  await page.getByRole('link', { name: /projects/i }).click();
  // Verify drawer closed AND navigation occurred
  await expect(page.getByTestId('mobile-drawer')).not.toBeVisible();
  await expect(page).toHaveURL(/\/projects/);
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/navigation/
```

**Gate:** All tests must pass before proceeding to Task 6.4.

---

## Next Steps

After this task, proceed to **[Task 6.4: Loading States & Error Handling](./04-loading-error-handling.md)**.
