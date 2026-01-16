# Unified Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge app-level Sidebar and ProjectSidebar into a single context-aware component.

**Architecture:** Create a LayoutContext that holds project data. ProjectLayout becomes a thin client wrapper that syncs props to context. Sidebar reads from context to determine what to render.

**Tech Stack:** React Context, Next.js App Router, TypeScript, Tailwind CSS

**Design Document:** `docs/plans/2026-01-16-unified-sidebar-design.md`

---

## Task 1: Create LayoutContext

**Files:**

- Create: `src/contexts/LayoutContext.tsx`
- Create: `src/contexts/__tests__/LayoutContext.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/contexts/__tests__/LayoutContext.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LayoutProvider, useLayoutContext, type ProjectData } from '../LayoutContext';

function TestConsumer() {
  const { projectData, setProjectData } = useLayoutContext();
  return (
    <div>
      <span data-testid="project-title">{projectData?.title ?? 'null'}</span>
      <button onClick={() => setProjectData({ id: '1', title: 'Test', documents: [], vaultItemCount: 0 })}>
        Set Data
      </button>
      <button onClick={() => setProjectData(null)}>Clear</button>
    </div>
  );
}

describe('LayoutContext', () => {
  it('provides null projectData by default', () => {
    render(
      <LayoutProvider>
        <TestConsumer />
      </LayoutProvider>
    );
    expect(screen.getByTestId('project-title')).toHaveTextContent('null');
  });

  it('updates projectData when setProjectData is called', async () => {
    render(
      <LayoutProvider>
        <TestConsumer />
      </LayoutProvider>
    );

    await act(async () => {
      screen.getByText('Set Data').click();
    });

    expect(screen.getByTestId('project-title')).toHaveTextContent('Test');
  });

  it('supports functional updater pattern', async () => {
    function FunctionalUpdaterTest() {
      const { projectData, setProjectData } = useLayoutContext();
      return (
        <div>
          <span data-testid="count">{projectData?.vaultItemCount ?? 0}</span>
          <button onClick={() => setProjectData({ id: '1', title: 'Test', documents: [], vaultItemCount: 5 })}>
            Init
          </button>
          <button onClick={() => setProjectData(prev => prev ? { ...prev, vaultItemCount: prev.vaultItemCount + 1 } : null)}>
            Increment
          </button>
        </div>
      );
    }

    render(
      <LayoutProvider>
        <FunctionalUpdaterTest />
      </LayoutProvider>
    );

    await act(async () => {
      screen.getByText('Init').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('5');

    await act(async () => {
      screen.getByText('Increment').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('6');
  });

  it('throws when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useLayoutContext must be used within a LayoutProvider');
    consoleError.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/contexts/__tests__/LayoutContext.test.tsx`
Expected: FAIL with "Cannot find module '../LayoutContext'"

**Step 3: Write the implementation**

```typescript
// src/contexts/LayoutContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ProjectData {
  id: string;
  title: string;
  documents: { id: string; title: string; sort_order: number | null }[];
  vaultItemCount: number;
}

interface LayoutContextValue {
  projectData: ProjectData | null;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData | null>>;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [projectData, setProjectDataState] = useState<ProjectData | null>(null);

  // Wrap in useCallback for referential stability
  const setProjectData = useCallback<React.Dispatch<React.SetStateAction<ProjectData | null>>>(
    (action) => setProjectDataState(action),
    []
  );

  return (
    <LayoutContext.Provider value={{ projectData, setProjectData }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayoutContext(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return context;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/contexts/__tests__/LayoutContext.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/contexts/LayoutContext.tsx src/contexts/__tests__/LayoutContext.test.tsx
git commit -m "feat: add LayoutContext for sidebar project data"
```

---

## Task 2: Update AppProviders to wrap with LayoutProvider

**Files:**

- Modify: `src/components/layout/AppProviders.tsx`

**Step 1: Update the implementation**

```typescript
// src/components/layout/AppProviders.tsx
'use client';

import { type ReactNode } from 'react';
import { AppShell } from './AppShell';
import { ToastContainer } from '@/components/ui/Toast';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { LayoutProvider } from '@/contexts/LayoutContext';

export interface AppProvidersProps {
  /** Page content */
  children: ReactNode;
}

/**
 * Root layout wrapper that combines AppShell with global UI components.
 * Includes ToastContainer and CommandPalette for global notifications and commands.
 * LayoutProvider wraps AppShell so Sidebar can access project context.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <LayoutProvider>
      <AppShell>{children}</AppShell>

      {/* Global UI Components */}
      <ToastContainer />
      <CommandPalette />
    </LayoutProvider>
  );
}
```

**Step 2: Run existing tests to verify no regression**

Run: `npm test -- src/components/layout`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/layout/AppProviders.tsx
git commit -m "feat: wrap AppShell with LayoutProvider"
```

---

## Task 3: Convert ProjectLayout to thin client wrapper

**Files:**

- Modify: `src/components/projects/ProjectLayout.tsx`
- Modify: `src/components/projects/__tests__/ProjectLayout.test.tsx`

**Step 1: Write failing test for new behavior**

```typescript
// src/components/projects/__tests__/ProjectLayout.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectLayout } from '../ProjectLayout';

// Mock the LayoutContext
const mockSetProjectData = vi.fn();
vi.mock('@/contexts/LayoutContext', () => ({
  useLayoutContext: () => ({
    projectData: null,
    setProjectData: mockSetProjectData,
  }),
}));

describe('ProjectLayout', () => {
  beforeEach(() => {
    mockSetProjectData.mockClear();
  });

  it('sets projectData on mount', () => {
    render(
      <ProjectLayout
        projectId="123"
        projectTitle="Test Project"
        documents={[{ id: 'd1', title: 'Doc 1', sort_order: 0 }]}
        vaultItemCount={5}
      >
        <div>Content</div>
      </ProjectLayout>
    );

    expect(mockSetProjectData).toHaveBeenCalledWith({
      id: '123',
      title: 'Test Project',
      documents: [{ id: 'd1', title: 'Doc 1', sort_order: 0 }],
      vaultItemCount: 5,
    });
  });

  it('clears projectData on unmount using functional updater', () => {
    const { unmount } = render(
      <ProjectLayout
        projectId="123"
        projectTitle="Test Project"
        documents={[]}
        vaultItemCount={0}
      >
        <div>Content</div>
      </ProjectLayout>
    );

    mockSetProjectData.mockClear();
    unmount();

    // Should be called with a function (functional updater)
    expect(mockSetProjectData).toHaveBeenCalledTimes(1);
    const updaterFn = mockSetProjectData.mock.calls[0][0];
    expect(typeof updaterFn).toBe('function');

    // Function should clear only if projectId matches
    expect(updaterFn({ id: '123', title: 'Test', documents: [], vaultItemCount: 0 })).toBeNull();
    expect(updaterFn({ id: '456', title: 'Other', documents: [], vaultItemCount: 0 })).toEqual({
      id: '456', title: 'Other', documents: [], vaultItemCount: 0
    });
  });

  it('renders children without additional wrapper', () => {
    render(
      <ProjectLayout
        projectId="123"
        projectTitle="Test Project"
        documents={[]}
        vaultItemCount={0}
      >
        <div data-testid="child">Content</div>
      </ProjectLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/projects/__tests__/ProjectLayout.test.tsx`
Expected: FAIL (old implementation doesn't use context)

**Step 3: Update the implementation**

```typescript
// src/components/projects/ProjectLayout.tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useLayoutContext } from '@/contexts/LayoutContext';

interface Document {
  id: string;
  title: string;
  sort_order: number | null;
}

interface ProjectLayoutProps {
  projectId: string;
  projectTitle: string;
  documents: Document[];
  vaultItemCount: number;
  children: ReactNode;
}

/**
 * Thin client wrapper that syncs project data to LayoutContext.
 * Server pages pass project data as props, this component syncs to context.
 * Sidebar reads from context to render project-level navigation.
 */
export function ProjectLayout({
  projectId,
  projectTitle,
  documents,
  vaultItemCount,
  children
}: ProjectLayoutProps) {
  const { setProjectData } = useLayoutContext();

  useEffect(() => {
    setProjectData({ id: projectId, title: projectTitle, documents, vaultItemCount });

    return () => {
      // Only clear if we're still the active project (handles race conditions)
      setProjectData((current) => (current?.id === projectId ? null : current));
    };
  }, [projectId, projectTitle, documents, vaultItemCount, setProjectData]);

  // No longer renders sidebar - AppShell's Sidebar handles it via context
  return <>{children}</>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/projects/__tests__/ProjectLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/projects/ProjectLayout.tsx src/components/projects/__tests__/ProjectLayout.test.tsx
git commit -m "refactor: convert ProjectLayout to thin context wrapper"
```

---

## Task 4: Add SidebarSkeleton component

**Files:**

- Create: `src/components/layout/SidebarSkeleton.tsx`

**Step 1: Write the implementation**

```typescript
// src/components/layout/SidebarSkeleton.tsx
'use client';

interface SidebarSkeletonProps {
  isCollapsed?: boolean;
}

/**
 * Loading skeleton for Sidebar when project data is pending.
 * Matches the structure of project-level sidebar.
 */
export function SidebarSkeleton({ isCollapsed }: SidebarSkeletonProps) {
  return (
    <aside
      id="sidebar-nav"
      className={`
        hidden lg:flex flex-col
        bg-bg-secondary border-r border-ink-faint/20
        transition-all duration-200 motion-reduce:transition-none
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
      aria-label="Loading navigation"
      data-testid="sidebar-skeleton"
    >
      <nav className="flex-1 py-4 px-2">
        <div className="space-y-3 animate-pulse">
          {/* Back link skeleton */}
          <div className={`h-6 bg-ink-faint/30 rounded ${isCollapsed ? 'w-8 mx-auto' : 'w-24'}`} />

          {/* Project title skeleton */}
          {!isCollapsed && <div className="h-4 bg-ink-faint/20 rounded w-32 mt-6 mb-4" />}

          {/* Nav items skeleton */}
          <div className={`h-11 bg-ink-faint/30 rounded-lg ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`} />
          <div className={`h-11 bg-ink-faint/30 rounded-lg ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`} />
          <div className={`h-11 bg-ink-faint/30 rounded-lg ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`} />
        </div>
      </nav>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/SidebarSkeleton.tsx
git commit -m "feat: add SidebarSkeleton for loading state"
```

---

## Task 5: Update Sidebar to be context-aware (App-level view)

**Files:**

- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/__tests__/Sidebar.test.tsx`

**Step 1: Write failing test for context-aware behavior**

Add these tests to the existing test file:

```typescript
// Add to src/components/layout/__tests__/Sidebar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

// Mock usePathname
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/projects'),
}));

// Mock LayoutContext
vi.mock('@/contexts/LayoutContext', () => ({
  useLayoutContext: vi.fn(() => ({
    projectData: null,
    setProjectData: vi.fn(),
  })),
}));

describe('Sidebar - App Level View', () => {
  it('renders app-level navigation when projectData is null', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('nav-item-projects')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-vault')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-citations')).toBeInTheDocument();
  });

  it('has correct aria-label for app-level view', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Main navigation');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/__tests__/Sidebar.test.tsx`
Expected: FAIL (useLayoutContext not found)

**Step 3: Update Sidebar to use context (minimal change)**

```typescript
// src/components/layout/Sidebar.tsx
'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Archive, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLayoutContext } from '@/contexts/LayoutContext';
import { SidebarSkeleton } from './SidebarSkeleton';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

export const navItems: NavItem[] = [
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/vault', icon: Archive, label: 'Vault' },
  { href: '/citations', icon: BookOpen, label: 'Citations' },
];

export interface SidebarProps {
  /** Whether sidebar is collapsed (icons only) */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

/**
 * Context-aware sidebar navigation.
 * - At /projects (app-level): Shows Projects, Vault, Citations
 * - Inside /projects/[id]/* (project-level): Shows project navigation with documents
 */
export function Sidebar({ isCollapsed: controlledCollapsed, onCollapseChange }: SidebarProps) {
  const pathname = usePathname();
  const { projectData } = useLayoutContext();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Support controlled and uncontrolled modes
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = useCallback(() => {
    const newValue = !isCollapsed;
    setInternalCollapsed(newValue);
    onCollapseChange?.(newValue);
  }, [isCollapsed, onCollapseChange]);

  // Detect if we're on a project route but data hasn't loaded yet
  const isProjectRoute = /^\/projects\/[^/]+/.test(pathname);
  const isLoading = isProjectRoute && !projectData;

  // Show skeleton while loading project data
  if (isLoading) {
    return <SidebarSkeleton isCollapsed={isCollapsed} />;
  }

  // Determine which view to render
  const isProjectView = projectData !== null;
  const ariaLabel = isProjectView
    ? `Project: ${projectData.title} navigation`
    : 'Main navigation';

  return (
    <aside
      id="sidebar-nav"
      className={`
        hidden lg:flex flex-col
        bg-bg-secondary border-r border-ink-faint/20
        transition-all duration-200 motion-reduce:transition-none
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
      aria-label={ariaLabel}
      data-testid="sidebar"
    >
      {/* Announcement for screen readers */}
      <div aria-live="polite" className="sr-only">
        {projectData ? `Now viewing project: ${projectData.title}` : ''}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2" role="navigation">
        {isProjectView ? (
          <ProjectNavigation
            projectData={projectData}
            isCollapsed={isCollapsed}
            pathname={pathname}
          />
        ) : (
          <AppNavigation
            isCollapsed={isCollapsed}
            pathname={pathname}
          />
        )}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-ink-faint/20 p-2">
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          className={`
            flex items-center gap-2 min-h-[44px] w-full px-3 rounded-lg
            text-sm text-ink-secondary
            hover:bg-surface-hover hover:text-ink-primary
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            transition-colors duration-150 motion-reduce:transition-none
            ${isCollapsed ? 'justify-center' : ''}
          `}
          data-testid="sidebar-collapse-toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

// App-level navigation component
function AppNavigation({ isCollapsed, pathname }: { isCollapsed: boolean; pathname: string }) {
  return (
    <ul className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
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
                ${isCollapsed ? 'justify-center' : ''}
              `}
              title={isCollapsed ? item.label : undefined}
              data-testid={`nav-item-${item.label.toLowerCase()}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {!isCollapsed && <span>{item.label}</span>}
              {isCollapsed && <span className="sr-only">{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Project-level navigation component (placeholder - will be implemented in Task 6)
function ProjectNavigation({
  projectData,
  isCollapsed,
  pathname
}: {
  projectData: NonNullable<ReturnType<typeof useLayoutContext>['projectData']>;
  isCollapsed: boolean;
  pathname: string;
}) {
  // Placeholder - will be fully implemented in Task 6
  return (
    <div className="text-ink-secondary text-sm px-3">
      Project: {projectData.title}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/layout/__tests__/Sidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/__tests__/Sidebar.test.tsx
git commit -m "feat: add context-aware rendering to Sidebar (app-level)"
```

---

## Task 6: Implement ProjectNavigation in Sidebar

**Files:**

- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/__tests__/Sidebar.test.tsx`

**Step 1: Write failing tests for project-level navigation**

```typescript
// Add to src/components/layout/__tests__/Sidebar.test.tsx
import { useLayoutContext } from '@/contexts/LayoutContext';

// Update the mock to be configurable
vi.mock('@/contexts/LayoutContext', () => ({
  useLayoutContext: vi.fn(),
}));

const mockUseLayoutContext = useLayoutContext as ReturnType<typeof vi.fn>;

describe('Sidebar - Project Level View', () => {
  beforeEach(() => {
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: 'proj-1',
        title: 'My Research Project',
        documents: [
          { id: 'doc-1', title: 'Chapter 1', sort_order: 0 },
          { id: 'doc-2', title: 'Chapter 2', sort_order: 1 },
        ],
        vaultItemCount: 5,
      },
      setProjectData: vi.fn(),
    });
  });

  it('renders back link to projects', () => {
    render(<Sidebar />);

    const backLink = screen.getByRole('link', { name: /all projects/i });
    expect(backLink).toHaveAttribute('href', '/projects');
  });

  it('renders project title', () => {
    render(<Sidebar />);

    expect(screen.getByText('My Research Project')).toBeInTheDocument();
  });

  it('renders documents section with list', () => {
    render(<Sidebar />);

    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
  });

  it('renders vault link with count badge', () => {
    render(<Sidebar />);

    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders citations link', () => {
    render(<Sidebar />);

    expect(screen.getByText('Citations')).toBeInTheDocument();
  });

  it('has correct aria-label for project view', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('sidebar')).toHaveAttribute(
      'aria-label',
      'Project: My Research Project navigation'
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/layout/__tests__/Sidebar.test.tsx`
Expected: FAIL (ProjectNavigation is placeholder)

**Step 3: Implement full ProjectNavigation**

Replace the placeholder `ProjectNavigation` function in `Sidebar.tsx`:

```typescript
// In src/components/layout/Sidebar.tsx - replace ProjectNavigation function

import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, FolderArchive, BookOpen } from 'lucide-react';

// Project-level navigation component
function ProjectNavigation({
  projectData,
  isCollapsed,
  pathname
}: {
  projectData: NonNullable<ReturnType<typeof useLayoutContext>['projectData']>;
  isCollapsed: boolean;
  pathname: string;
}) {
  const { id: projectId, title: projectTitle, documents, vaultItemCount } = projectData;

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [documents]
  );

  const isDocumentsActive =
    pathname === `/projects/${projectId}` || pathname.startsWith(`/projects/${projectId}/documents`);
  const isVaultActive = pathname.startsWith(`/projects/${projectId}/vault`);
  const isCitationsActive = pathname.startsWith(`/projects/${projectId}/citations`);

  // Popover state for collapsed view
  const [isDocPopoverOpen, setIsDocPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!isDocPopoverOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsDocPopoverOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsDocPopoverOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDocPopoverOpen]);

  return (
    <div className="space-y-1">
      {/* Back link */}
      <Link
        href="/projects"
        className={`
          flex items-center gap-2 min-h-[44px] px-3 rounded-lg
          text-sm font-medium
          text-ink-secondary hover:bg-surface-hover hover:text-ink-primary
          transition-colors duration-150 motion-reduce:transition-none
          focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          ${isCollapsed ? 'justify-center' : ''}
        `}
        title={isCollapsed ? 'All Projects' : undefined}
        data-testid="nav-back-to-projects"
      >
        <ArrowLeft className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        {!isCollapsed && <span>All Projects</span>}
        {isCollapsed && <span className="sr-only">All Projects</span>}
      </Link>

      {/* Project title */}
      {!isCollapsed && (
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary px-3 pt-4 pb-2"
          data-testid="project-title"
        >
          {projectTitle}
        </h2>
      )}

      {/* Documents section */}
      {isCollapsed ? (
        // Collapsed: show popover trigger
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsDocPopoverOpen(!isDocPopoverOpen)}
            aria-label="View project documents"
            aria-haspopup="true"
            aria-expanded={isDocPopoverOpen}
            aria-controls="documents-popover"
            className={`
              flex items-center justify-center min-h-[44px] w-full px-3 rounded-lg
              text-sm font-medium
              transition-colors duration-150 motion-reduce:transition-none
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              ${isDocumentsActive
                ? 'bg-quill-light text-quill'
                : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
              }
            `}
            data-testid="nav-item-documents"
          >
            <FileText className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Documents</span>
          </button>

          {/* Documents popover */}
          {isDocPopoverOpen && (
            <div
              ref={popoverRef}
              id="documents-popover"
              role="menu"
              aria-label="Documents"
              className="absolute left-full top-0 ml-2 w-56 bg-surface rounded-lg shadow-lg border border-ink-faint/20 z-50 py-2"
            >
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-tertiary border-b border-ink-faint/20 mb-1">
                {projectTitle}
              </div>
              {sortedDocuments.length > 0 ? (
                sortedDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/projects/${projectId}/documents/${doc.id}`}
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-ink-secondary hover:bg-surface-hover hover:text-ink-primary truncate"
                    onClick={() => setIsDocPopoverOpen(false)}
                  >
                    {doc.title}
                  </Link>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-ink-tertiary italic">No documents yet</p>
              )}
            </div>
          )}
        </div>
      ) : (
        // Expanded: show full documents list
        <div className="mb-4">
          <Link
            href={`/projects/${projectId}`}
            aria-current={isDocumentsActive ? 'page' : undefined}
            className={`
              flex items-center gap-2 min-h-[44px] px-3 rounded-lg
              text-sm font-medium
              transition-colors duration-150 motion-reduce:transition-none
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              ${isDocumentsActive
                ? 'bg-quill-light text-quill'
                : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
              }
            `}
            data-testid="nav-item-documents"
          >
            <FileText className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span>Documents</span>
          </Link>

          {/* Document list */}
          {sortedDocuments.length > 0 ? (
            <ul role="list" aria-label="Documents" className="mt-1 ml-4 space-y-0.5">
              {sortedDocuments.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/projects/${projectId}/documents/${doc.id}`}
                    className="
                      block px-3 py-2 rounded-lg text-sm
                      text-ink-secondary hover:text-ink-primary hover:bg-surface-hover
                      transition-colors duration-150 truncate min-h-[44px] flex items-center
                      focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                    "
                    title={doc.title}
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 ml-4 px-3 text-xs text-ink-tertiary italic">
              No documents yet
            </p>
          )}
        </div>
      )}

      {/* Vault */}
      <Link
        href={`/projects/${projectId}/vault`}
        aria-current={isVaultActive ? 'page' : undefined}
        className={`
          flex items-center justify-between min-h-[44px] px-3 rounded-lg
          text-sm font-medium
          transition-colors duration-150 motion-reduce:transition-none
          focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          ${isVaultActive
            ? 'bg-quill-light text-quill'
            : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
          }
          ${isCollapsed ? 'justify-center' : ''}
        `}
        title={isCollapsed ? `Vault (${vaultItemCount} items)` : undefined}
        data-testid="nav-item-vault"
      >
        <span className={`flex items-center gap-2 ${isCollapsed ? '' : ''}`}>
          <FolderArchive className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!isCollapsed && <span>Vault</span>}
          {isCollapsed && <span className="sr-only">Vault</span>}
        </span>
        {!isCollapsed && vaultItemCount > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium bg-ink-faint/30 text-ink-secondary"
            aria-label={`${vaultItemCount} items`}
          >
            {vaultItemCount}
          </span>
        )}
      </Link>

      {/* Citations */}
      <Link
        href={`/projects/${projectId}/citations`}
        aria-current={isCitationsActive ? 'page' : undefined}
        className={`
          flex items-center gap-2 min-h-[44px] px-3 rounded-lg
          text-sm font-medium
          transition-colors duration-150 motion-reduce:transition-none
          focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          ${isCitationsActive
            ? 'bg-quill-light text-quill'
            : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
          }
          ${isCollapsed ? 'justify-center' : ''}
        `}
        title={isCollapsed ? 'Citations' : undefined}
        data-testid="nav-item-citations"
      >
        <BookOpen className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        {!isCollapsed && <span>Citations</span>}
        {isCollapsed && <span className="sr-only">Citations</span>}
      </Link>
    </div>
  );
}
```

**Step 4: Update imports at top of Sidebar.tsx**

```typescript
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderOpen,
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FileText,
  FolderArchive,
} from 'lucide-react';
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- src/components/layout/__tests__/Sidebar.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/__tests__/Sidebar.test.tsx
git commit -m "feat: implement ProjectNavigation in Sidebar"
```

---

## Task 7: Update project routes to work without ProjectSidebar

**Files:**

- Modify: `src/app/projects/[id]/page.tsx` - already uses ProjectLayout, verify it works
- Modify: `src/app/projects/[id]/documents/[docId]/page.tsx` - add ProjectLayout wrapper
- Verify: `src/app/projects/[id]/vault/page.tsx` - already uses ProjectLayout
- Modify: `src/app/projects/[id]/citations/page.tsx` - add ProjectLayout wrapper
- Modify: `src/app/projects/[id]/edit/page.tsx` - add ProjectLayout wrapper

**Step 1: Check which pages need updating**

Run: `grep -l "ProjectLayout" src/app/projects/[id]/**/page.tsx`

**Step 2: Update documents page**

Check current implementation and add ProjectLayout wrapper with proper data fetching.

**Step 3: Update citations page**

Check current implementation and add ProjectLayout wrapper.

**Step 4: Update edit page**

Check current implementation and add ProjectLayout wrapper.

**Step 5: Run the app and test navigation**

Run: `npm run dev`
Test: Navigate between projects, documents, vault, citations to verify sidebar updates correctly.

**Step 6: Commit**

```bash
git add src/app/projects/
git commit -m "feat: wrap all project routes with ProjectLayout"
```

---

## Task 8: Delete old ProjectSidebar files

**Files:**

- Delete: `src/components/projects/ProjectSidebar.tsx`
- Delete: `src/components/projects/__tests__/ProjectSidebar.test.tsx`

**Step 1: Verify no remaining imports**

Run: `grep -r "ProjectSidebar" src/`

Should only show the files to be deleted.

**Step 2: Delete files**

```bash
rm src/components/projects/ProjectSidebar.tsx
rm src/components/projects/__tests__/ProjectSidebar.test.tsx
```

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old ProjectSidebar component"
```

---

## Task 9: Add E2E tests for sidebar navigation

**Files:**

- Create: `e2e/sidebar-navigation.spec.ts`

**Step 1: Write E2E tests**

```typescript
// e2e/sidebar-navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sidebar Navigation', () => {
  test('shows app-level navigation on projects list', async ({ page }) => {
    await page.goto('/projects');

    await expect(page.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Main navigation');
    await expect(page.getByTestId('nav-item-projects')).toBeVisible();
    await expect(page.getByTestId('nav-item-vault')).toBeVisible();
    await expect(page.getByTestId('nav-item-citations')).toBeVisible();
  });

  test('shows project navigation when inside a project', async ({ page }) => {
    // Navigate to a project (assumes test project exists)
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /test project/i })
      .first()
      .click();

    // Wait for project sidebar to appear
    await expect(page.getByTestId('nav-back-to-projects')).toBeVisible();
    await expect(page.getByTestId('nav-item-documents')).toBeVisible();
    await expect(page.getByTestId('nav-item-vault')).toBeVisible();
    await expect(page.getByTestId('nav-item-citations')).toBeVisible();
  });

  test('navigating between projects updates sidebar', async ({ page }) => {
    // This test requires at least 2 projects
    await page.goto('/projects');

    // Click first project
    const firstProject = page.getByRole('link', { name: /project/i }).first();
    const firstProjectName = await firstProject.textContent();
    await firstProject.click();

    // Verify sidebar shows first project
    await expect(page.getByTestId('project-title')).toContainText(firstProjectName || '');

    // Navigate back and to second project
    await page.getByTestId('nav-back-to-projects').click();
    const secondProject = page.getByRole('link', { name: /project/i }).nth(1);
    const secondProjectName = await secondProject.textContent();
    await secondProject.click();

    // Verify sidebar shows second project
    await expect(page.getByTestId('project-title')).toContainText(secondProjectName || '');
  });

  test('sidebar stays in project view when navigating to document', async ({ page }) => {
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /project/i })
      .first()
      .click();

    // Get project title
    const projectTitle = await page.getByTestId('project-title').textContent();

    // Navigate to a document (if any exist)
    const docLink = page.getByRole('list', { name: 'Documents' }).getByRole('link').first();
    if (await docLink.isVisible()) {
      await docLink.click();

      // Sidebar should still show project navigation
      await expect(page.getByTestId('project-title')).toContainText(projectTitle || '');
    }
  });
});
```

**Step 2: Run E2E tests**

Run: `npm run test:e2e -- sidebar-navigation.spec.ts`
Expected: Tests pass (may need test data setup)

**Step 3: Commit**

```bash
git add e2e/sidebar-navigation.spec.ts
git commit -m "test: add E2E tests for sidebar navigation"
```

---

## Task 10: Update layout index exports

**Files:**

- Modify: `src/components/layout/index.ts`

**Step 1: Add SidebarSkeleton export**

```typescript
export { SidebarSkeleton } from './SidebarSkeleton';
```

**Step 2: Commit**

```bash
git add src/components/layout/index.ts
git commit -m "chore: export SidebarSkeleton from layout index"
```

---

## Final Verification

**Step 1: Run all tests**

```bash
npm test
```

**Step 2: Run E2E tests**

```bash
npm run test:e2e
```

**Step 3: Manual testing checklist**

- [ ] Navigate to /projects - see app-level sidebar
- [ ] Click into a project - see project sidebar with documents
- [ ] Navigate to vault within project - sidebar stays project-level
- [ ] Navigate to citations within project - sidebar stays project-level
- [ ] Navigate back to projects - sidebar returns to app-level
- [ ] Collapse sidebar - icons only, popover for documents
- [ ] Direct URL to project document - shows skeleton then project sidebar

**Step 4: Final commit**

```bash
git status  # Verify clean
```
