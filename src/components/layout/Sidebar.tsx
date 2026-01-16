'use client';

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
 * Project-level navigation component.
 * Shows back link, project title, documents list, vault, and citations.
 */
function ProjectNavigation({ isCollapsed }: { isCollapsed: boolean }) {
  const pathname = usePathname();
  const { projectData } = useLayoutContext();
  const [isDocumentsPopoverOpen, setIsDocumentsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sort documents by sort_order
  const sortedDocuments = useMemo(
    () => [...(projectData?.documents ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [projectData?.documents]
  );

  // Active state detection
  const projectId = projectData?.id;
  const isDocumentsActive =
    pathname === `/projects/${projectId}` || pathname.startsWith(`/projects/${projectId}/documents`);
  const isVaultActive = pathname.startsWith(`/projects/${projectId}/vault`);
  const isCitationsActive = pathname.startsWith(`/projects/${projectId}/citations`);

  // Close popover on Escape or click outside
  useEffect(() => {
    if (!isDocumentsPopoverOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDocumentsPopoverOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsDocumentsPopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDocumentsPopoverOpen]);

  if (!projectData) return null;

  return (
    <nav className="flex-1 py-4 px-2 overflow-y-auto" role="navigation">
      <div className="space-y-4">
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
        </Link>

        {/* Project title */}
        {!isCollapsed && (
          <h2
            className="
              text-xs font-semibold uppercase tracking-wider
              text-ink-secondary
              px-3 mt-4
            "
            data-testid="project-title"
          >
            {projectData.title}
          </h2>
        )}

        {/* Documents section */}
        <div className="relative">
          {isCollapsed ? (
            <>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsDocumentsPopoverOpen(!isDocumentsPopoverOpen)}
                aria-expanded={isDocumentsPopoverOpen}
                aria-haspopup="true"
                className={`
                  flex items-center justify-center min-h-[44px] w-full px-3 rounded-lg
                  text-sm font-medium
                  transition-colors duration-150 motion-reduce:transition-none
                  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                  ${
                    isDocumentsActive
                      ? 'bg-quill-light text-quill'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                  }
                `}
                title="Documents"
              >
                <FileText className="h-5 w-5" aria-hidden="true" />
              </button>

              {/* Documents popover */}
              {isDocumentsPopoverOpen && (
                <div
                  ref={popoverRef}
                  role="menu"
                  className="
                    absolute left-full top-0 ml-2 z-50
                    w-56 bg-bg-primary border border-ink-faint/20 rounded-lg shadow-lg
                    py-2
                  "
                >
                  <Link
                    href={`/projects/${projectId}`}
                    role="menuitem"
                    className="
                      block px-4 py-2 text-sm font-medium
                      text-ink-primary hover:bg-surface-hover
                      transition-colors duration-150
                    "
                    onClick={() => setIsDocumentsPopoverOpen(false)}
                  >
                    Documents
                  </Link>
                  {sortedDocuments.length > 0 ? (
                    <ul role="list" className="mt-1 border-t border-ink-faint/20 pt-1">
                      {sortedDocuments.map((doc) => (
                        <li key={doc.id}>
                          <Link
                            href={`/projects/${projectId}/documents/${doc.id}`}
                            role="menuitem"
                            className="
                              block px-4 py-2 text-sm
                              text-ink-secondary hover:text-ink-primary hover:bg-surface-hover
                              transition-colors duration-150 truncate
                            "
                            title={doc.title}
                            onClick={() => setIsDocumentsPopoverOpen(false)}
                          >
                            {doc.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-2 text-xs text-ink-secondary italic">No documents yet</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <Link
                href={`/projects/${projectId}`}
                aria-current={isDocumentsActive ? 'page' : undefined}
                className={`
                  flex items-center gap-2 min-h-[44px] px-3 rounded-lg
                  text-sm font-medium
                  transition-colors duration-150 motion-reduce:transition-none
                  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                  ${
                    isDocumentsActive
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
                <ul role="list" aria-label="Documents" className="mt-2 ml-4 space-y-1" data-testid="document-list">
                  {sortedDocuments.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/projects/${projectId}/documents/${doc.id}`}
                        className="
                          block px-3 py-2.5 rounded-md
                          text-sm
                          text-ink-secondary hover:text-ink-primary hover:bg-surface-hover
                          transition-colors duration-150 motion-reduce:transition-none
                          focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                          truncate min-h-[44px] flex items-center
                        "
                        title={doc.title}
                      >
                        {doc.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 ml-4 px-3 text-xs text-ink-secondary italic">No documents yet</p>
              )}
            </>
          )}
        </div>

        {/* Vault link */}
        <Link
          href={`/projects/${projectId}/vault`}
          aria-current={isVaultActive ? 'page' : undefined}
          className={`
            flex items-center justify-between min-h-[44px] px-3 rounded-lg
            text-sm font-medium
            transition-colors duration-150 motion-reduce:transition-none
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            ${
              isVaultActive
                ? 'bg-quill-light text-quill'
                : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
            }
          `}
          title={isCollapsed ? 'Vault' : undefined}
          data-testid="nav-item-project-vault"
        >
          <span className={`flex items-center gap-2 ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <FolderArchive className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {!isCollapsed && <span>Vault</span>}
          </span>
          {!isCollapsed && projectData.vaultItemCount > 0 && (
            <span
              className="
                px-2 py-0.5 rounded-full
                text-xs font-medium
                bg-ink-faint/20
                text-ink-secondary
              "
              aria-label={`${projectData.vaultItemCount} items`}
            >
              {projectData.vaultItemCount}
            </span>
          )}
        </Link>

        {/* Citations link */}
        <Link
          href={`/projects/${projectId}/citations`}
          aria-current={isCitationsActive ? 'page' : undefined}
          className={`
            flex items-center gap-2 min-h-[44px] px-3 rounded-lg
            text-sm font-medium
            transition-colors duration-150 motion-reduce:transition-none
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            ${
              isCitationsActive
                ? 'bg-quill-light text-quill'
                : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
            }
            ${isCollapsed ? 'justify-center' : ''}
          `}
          title={isCollapsed ? 'Citations' : undefined}
          data-testid="nav-item-project-citations"
        >
          <BookOpen className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!isCollapsed && <span>Citations</span>}
        </Link>
      </div>
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
