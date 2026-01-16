'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
 * App-level navigation component showing Projects, Vault, Citations.
 * Used when not viewing a specific project.
 */
function AppNavigation({ pathname, isCollapsed }: { pathname: string; isCollapsed: boolean }) {
  return (
    <nav className="flex-1 py-4 px-2" role="navigation">
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Project-level navigation component (placeholder).
 * Will be implemented in Task 6.
 */
function ProjectNavigation({ isCollapsed }: { isCollapsed: boolean }) {
  // Placeholder - will be fully implemented in Task 6
  return (
    <nav className="flex-1 py-4 px-2" role="navigation">
      <div className={isCollapsed ? 'text-center' : ''}>{/* Project navigation will be added in Task 6 */}</div>
    </nav>
  );
}

/**
 * Desktop sidebar navigation with collapsible state.
 * Context-aware: shows app-level navigation or project-level navigation
 * based on LayoutContext's projectData.
 */
export function Sidebar({ isCollapsed: controlledCollapsed, onCollapseChange }: SidebarProps) {
  const pathname = usePathname();
  const { projectData } = useLayoutContext();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const prevProjectRef = useRef<string | null>(null);

  // Support controlled and uncontrolled modes
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  // Detect if we're on a project route (e.g., /projects/123 or /projects/123/documents/456)
  const isProjectRoute = /^\/projects\/[^/]+/.test(pathname);

  // Determine view mode
  const showSkeleton = isProjectRoute && !projectData;
  const showProjectNavigation = isProjectRoute && projectData;

  // Dynamic aria-label
  const ariaLabel = projectData ? `Project: ${projectData.title} navigation` : 'Main navigation';

  // Track project changes for aria-live announcements
  useEffect(() => {
    if (projectData?.id !== prevProjectRef.current) {
      prevProjectRef.current = projectData?.id ?? null;
    }
  }, [projectData]);

  const handleToggleCollapse = useCallback(() => {
    const newValue = !isCollapsed;
    setInternalCollapsed(newValue);
    onCollapseChange?.(newValue);
  }, [isCollapsed, onCollapseChange]);

  // Show skeleton while loading project data
  if (showSkeleton) {
    return <SidebarSkeleton isCollapsed={isCollapsed} />;
  }

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
      {/* Screen reader announcement for project changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {projectData && `Navigated to project: ${projectData.title}`}
      </div>

      {/* Navigation content based on context */}
      {showProjectNavigation ? (
        <ProjectNavigation isCollapsed={isCollapsed} />
      ) : (
        <AppNavigation pathname={pathname} isCollapsed={isCollapsed} />
      )}

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
