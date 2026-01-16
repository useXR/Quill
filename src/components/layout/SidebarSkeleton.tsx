'use client';

import { Skeleton } from '../ui/Skeleton';

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
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading navigation...</span>

          {/* Back link skeleton */}
          <Skeleton height="1.5rem" className={isCollapsed ? 'w-8 mx-auto' : 'w-24'} />

          {/* Project title skeleton */}
          {!isCollapsed && <Skeleton height="1rem" className="w-32 mt-6 mb-4" />}

          {/* Nav items skeleton */}
          <Skeleton
            height="2.75rem"
            className={`rounded-[var(--radius-lg)] ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`}
          />
          <Skeleton
            height="2.75rem"
            className={`rounded-[var(--radius-lg)] ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`}
          />
          <Skeleton
            height="2.75rem"
            className={`rounded-[var(--radius-lg)] ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`}
          />
        </div>
      </nav>
    </aside>
  );
}
