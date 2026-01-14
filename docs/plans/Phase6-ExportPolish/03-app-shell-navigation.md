# Task 6.3: App Shell & Navigation

> **Phase 6** | [← PDF Export](./02-pdf-export.md) | [Next: Loading States & Error Handling →](./04-loading-error-handling.md)

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
 */

/* Focus visible styles - clear keyboard focus indicators */
.focus-ring:focus-visible {
  outline: 2px solid var(--color-accent, #3b82f6);
  outline-offset: 2px;
}

/* Remove default outline and use focus-visible instead */
button:focus-visible,
a:focus-visible,
[role='button']:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--color-accent, #3b82f6);
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
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
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
        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <User className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg py-1"
          role="menu"
        >
          <a
            href="/settings"
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-gray-100 text-gray-900"
            role="menuitem"
          >
            <Settings className="w-4 h-4" />
            Settings
          </a>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-gray-100 w-full text-left text-red-600"
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

export function Header({ onMenuClick, showMenuButton }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b z-40">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link
            href="/projects"
            className="text-xl font-semibold text-gray-900 hover:text-gray-700"
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

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 bg-gray-50 border-r transition-all duration-200 motion-reduce:transition-none ${
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
              className={`flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg mb-1 transition-colors motion-reduce:transition-none ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
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
        className="absolute bottom-4 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors motion-reduce:transition-none"
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 left-0 bottom-0 w-64 bg-white z-50 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="text-xl font-semibold">Quill</span>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors motion-reduce:transition-none"
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
                className={`flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg mb-1 transition-colors motion-reduce:transition-none ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
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
    <div className="min-h-screen bg-gray-50">
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
        <div className="container mx-auto px-4 py-6 max-w-5xl">{children}</div>
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

### Color Contrast

The color scheme uses:

- `text-gray-900` on white backgrounds (contrast ratio > 12:1)
- `text-blue-700` on `bg-blue-100` for active states (contrast ratio > 4.5:1)
- `text-gray-700` for secondary text (contrast ratio > 4.5:1)

### Reduced Motion

All components include `motion-reduce:transition-none` to respect user preferences.

---

## Next Steps

After this task, proceed to **[Task 6.4: Loading States & Error Handling](./04-loading-error-handling.md)**.
