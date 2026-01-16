# Unified Context-Aware Sidebar

Merge the app-level `Sidebar` and project-level `ProjectSidebar` into a single component that adapts based on the current route.

## Problem

Two sidebars appear when viewing a project:

- `Sidebar` (AppShell): Projects, Vault, Citations links
- `ProjectSidebar`: Back link, project title, documents list, Vault, Citations

This duplicates Vault/Citations links and wastes horizontal space.

## Solution

One `Sidebar` component that renders different content based on location:

| At `/projects`    | Inside `/projects/[id]/*`   |
| ----------------- | --------------------------- |
| Projects (active) | ← All Projects              |
| Vault             | **PROJECT TITLE**           |
| Citations         | Documents section with list |
|                   | Vault (with count badge)    |
|                   | Citations                   |

## Component Architecture

### Enhanced Sidebar.tsx

Uses `usePathname()` to detect context:

- `/projects` → app-level view
- `/projects/[id]/*` → project-level view

Reads project data from a layout context when in project view.

### New LayoutContext

```typescript
interface LayoutContextValue {
  projectData: {
    id: string;
    title: string;
    documents: { id: string; title: string; sort_order: number | null }[];
    vaultItemCount: number;
  } | null;
  setProjectData: (data: ProjectData | null) => void;
}
```

### Server/Client Bridge Pattern

Project pages are Server Components (async functions). They cannot use hooks or context directly. Solution:

1. `ProjectLayout` becomes a **Client Component** wrapper
2. Server pages pass project data as **props** to `ProjectLayout`
3. `ProjectLayout` calls `setProjectData()` in a `useEffect` on mount
4. On unmount, `ProjectLayout` calls `setProjectData(null)`

```tsx
// src/components/projects/ProjectLayout.tsx
'use client';

export function ProjectLayout({ projectId, projectTitle, documents, vaultItemCount, children }) {
  const { setProjectData } = useLayoutContext();

  useEffect(() => {
    setProjectData({ id: projectId, title: projectTitle, documents, vaultItemCount });
    return () => setProjectData(null);
  }, [projectId, projectTitle, documents, vaultItemCount, setProjectData]);

  // No longer renders sidebar - just passes children through
  return <>{children}</>;
}
```

### Data Flow

1. `AppProviders` wraps with `LayoutProvider`
2. Server page fetches project data, passes to `ProjectLayout` as props
3. `ProjectLayout` (client) syncs props to context on mount
4. `Sidebar` consumes context to read `projectData`
5. `projectData === null` → app-level view
6. `projectData !== null` → project-level view

### Navigation Race Condition Handling

When navigating between projects, React may mount the new `ProjectLayout` before unmounting the old one. To prevent stale data:

```typescript
useEffect(() => {
  // Only set if this component's projectId matches current route
  setProjectData({ id: projectId, ... });
  return () => {
    // Only clear if we're still the active project
    setProjectData((current) => current?.id === projectId ? null : current);
  };
}, [projectId, ...]);
```

## UI Behavior

### Collapse States

- Collapsed: 64px wide, icons only
- Expanded: 256px wide, icons + labels
- Toggle button at bottom (unchanged)
- Collapse state persists across navigation (managed in AppShell)

### Collapsed Project View

- "All Projects" → back arrow icon only
- Project title → hidden (tooltip on hover + visually-hidden text for screen readers)
- Documents → single icon, click shows popover with doc list
- Vault/Citations → icons only

### Documents Popover (Collapsed State)

Follow `UserMenu.tsx` pattern for accessibility:

```tsx
<button
  aria-label="View project documents"
  aria-haspopup="true"
  aria-expanded={isOpen}
  aria-controls="documents-popover"
>
  <FileText />
</button>

<div
  id="documents-popover"
  role="menu"
  aria-labelledby="documents-trigger"
>
  {documents.map(doc => (
    <a role="menuitem" href={...}>{doc.title}</a>
  ))}
</div>
```

Required behaviors:

- Escape key closes popover
- Arrow keys navigate document list
- Focus trapped within popover while open
- Focus returns to trigger on close

## Accessibility Requirements

### Dynamic ARIA Labels

```tsx
<aside
  aria-label={projectData ? `Project: ${projectData.title} navigation` : 'Main navigation'}
>
```

### Context Change Announcements

Add a live region to announce sidebar context changes:

```tsx
<div aria-live="polite" className="sr-only">
  {projectData ? `Now viewing project: ${projectData.title}` : ''}
</div>
```

### Focus Management

When sidebar context changes (entering/leaving a project), restore focus to first focusable element:

```typescript
useEffect(() => {
  if (contextChanged) {
    sidebarRef.current?.querySelector('a, button')?.focus();
  }
}, [projectData?.id]);
```

### Icon-Only Mode

Don't rely solely on `title` attribute (not announced by all screen readers). Add visually-hidden text:

```tsx
<Link href="/projects">
  <ArrowLeft aria-hidden="true" />
  <span className="sr-only">All Projects</span>
  {!isCollapsed && <span>All Projects</span>}
</Link>
```

### Preserve Existing Patterns

- Vault count badge: `aria-label="{count} items"`
- Document list: `<ul role="list" aria-label="Documents">`
- Touch targets: `min-h-[44px]` on all interactive elements
- Motion: `motion-reduce:transition-none` on transitions

## Edge Cases

### SSR/Hydration

On initial server render, `projectData` is null. After hydration, context populates. This is acceptable because:

1. The sidebar structure is the same (same DOM elements)
2. Only content changes (project title, documents)
3. No layout shift (sidebar width unchanged)

### Document CRUD Updates

When documents are created/deleted within a project:

- Server pages re-fetch on navigation (existing behavior)
- For same-page updates, the creating component should call router.refresh() or refetch
- This is outside sidebar's responsibility

### Error States

If project data fails to load, the page handles errors (existing pattern). Sidebar simply shows app-level view when `projectData` is null.

## File Changes

### Create

- `src/contexts/LayoutContext.tsx` — new context for project data

### Modify

- `src/components/layout/Sidebar.tsx` — add project-level rendering, accessibility updates
- `src/components/layout/AppProviders.tsx` — wrap with LayoutProvider
- `src/components/projects/ProjectLayout.tsx` — convert to thin client wrapper that syncs props to context

### Delete

- `src/components/projects/ProjectSidebar.tsx`
- `src/components/projects/__tests__/ProjectSidebar.test.tsx`

### Test Updates

- Update Sidebar tests for both app-level and project-level views
- Add tests for collapsed popover accessibility
- Add tests for focus management on context change
- Update ProjectLayout tests for context integration

## Styling

Use Tailwind utility classes consistently (not CSS variable syntax). The current `ProjectSidebar.tsx` uses `bg-[var(--color-bg-secondary)]` but `Sidebar.tsx` uses `bg-bg-secondary`. Unified component uses Tailwind utilities.

## Out of Scope

- Mobile nav updates (follow-up task using same pattern)
- Transition animations (polish after core works)
- Collapse state persistence to localStorage (future enhancement)
