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
```

**Implementation note:** The `setProjectData` uses React's `Dispatch<SetStateAction<T>>` type to support both direct values and functional updaters. The context must wrap the setter in `useCallback` to ensure referential stability:

```typescript
const [projectData, setProjectDataState] = useState<ProjectData | null>(null);
const setProjectData = useCallback<React.Dispatch<React.SetStateAction<ProjectData | null>>>(
  (action) => setProjectDataState(action),
  []
);
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

1. `AppProviders` wraps `AppShell` with `LayoutProvider` (provider must be outside `AppShell` since `Sidebar` is inside it)
2. Server page fetches project data, passes to `ProjectLayout` as props
3. `ProjectLayout` (client) syncs props to context on mount
4. `Sidebar` consumes context to read `projectData`
5. `projectData === null` → app-level view
6. `projectData !== null` → project-level view

```tsx
// src/components/layout/AppProviders.tsx
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <LayoutProvider>
      <AppShell>{children}</AppShell>
      <ToastContainer />
      <CommandPalette />
    </LayoutProvider>
  );
}
```

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
- Arrow keys navigate document list (use roving tabindex pattern)
- Focus trapped within popover while open
- Focus returns to trigger on close
- Click outside closes popover

### Z-Index Stacking

Documents popover uses `z-50` to match other overlay components in the app:

| Component         | z-index | Notes                              |
| ----------------- | ------- | ---------------------------------- |
| Header            | z-40    | Sticky top                         |
| Sidebar           | (none)  | Normal stacking context            |
| Documents popover | z-50    | Positioned absolute within sidebar |
| MobileNav         | z-50    | Fixed overlay                      |
| CommandPalette    | z-50    | Fixed centered                     |
| Toast             | z-50    | Fixed bottom-right                 |

The popover positions `absolute` relative to the sidebar, extending rightward. With `z-50`, it appears above the Header when needed.

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

### SSR/Hydration and Deep Links

On initial server render, `projectData` is null. After hydration, context populates. This causes a brief content flash (app-level → project-level) on direct navigation to bookmarked URLs like `/projects/123/documents/456`.

**Mitigation:** Sidebar detects "loading" state when pathname indicates project context but data hasn't arrived yet:

```tsx
const pathname = usePathname();
const isProjectRoute = pathname.match(/^\/projects\/[^/]+/);
const isLoading = isProjectRoute && !projectData;

if (isLoading) {
  return <SidebarSkeleton />; // Show placeholder instead of app-level content
}
```

This prevents the jarring flash of app-level navigation for bookmarked project links.

### Document CRUD Updates

When documents are created/deleted within a project:

- Server pages re-fetch on navigation (existing behavior)
- For same-page updates, the creating component should call router.refresh() or refetch
- This is outside sidebar's responsibility

### Error States

If project data fails to load, the page handles errors (existing pattern). Sidebar simply shows app-level view when `projectData` is null.

### All Project Routes Must Use ProjectLayout

**Critical:** Every route under `/projects/[id]/*` must wrap its content with `ProjectLayout` and pass the required props. If a route doesn't use `ProjectLayout`, navigating to that route will clear `projectData` (via unmount cleanup from the previous route), causing the sidebar to flash back to app-level view.

Routes to verify:

- `/projects/[id]/page.tsx` — already uses ProjectLayout ✓
- `/projects/[id]/documents/[docId]/*` — needs ProjectLayout wrapper
- `/projects/[id]/vault/page.tsx` — needs verification
- `/projects/[id]/citations/page.tsx` — needs verification
- `/projects/[id]/edit/page.tsx` — needs verification

## File Changes

### Create

- `src/contexts/LayoutContext.tsx` — new context for project data

### Modify

- `src/components/layout/Sidebar.tsx` — add project-level rendering, accessibility updates, skeleton state
- `src/components/layout/AppProviders.tsx` — wrap with LayoutProvider
- `src/components/projects/ProjectLayout.tsx` — convert to thin client wrapper that syncs props to context
- `src/app/projects/[id]/documents/[docId]/page.tsx` — wrap with ProjectLayout (Server Component fetches data, passes to ProjectLayout)
- `src/app/projects/[id]/vault/page.tsx` — ensure wrapped with ProjectLayout
- `src/app/projects/[id]/citations/page.tsx` — ensure wrapped with ProjectLayout
- `src/app/projects/[id]/edit/page.tsx` — wrap with ProjectLayout

**Note:** All project route `page.tsx` files (Server Components) should wrap their content with `ProjectLayout`, passing the required props. This follows the Server/Client bridge pattern. Do not wrap Client Components directly—the wrapping happens at the page level.

### Delete

- `src/components/projects/ProjectSidebar.tsx`
- `src/components/projects/__tests__/ProjectSidebar.test.tsx`

### Test Updates

**Sidebar tests:**

- App-level view renders Projects, Vault, Citations links
- Project-level view renders back link, project title, documents, Vault, Citations
- Collapsed state shows icons only
- Documents popover opens/closes correctly
- Popover keyboard navigation (Escape, arrow keys)
- Dynamic aria-label updates based on context
- aria-live announces context changes

**LayoutContext tests:**

- Context provides projectData and setProjectData
- Functional updater works correctly
- setProjectData is referentially stable

**ProjectLayout tests:**

- Sets projectData on mount
- Clears projectData on unmount (only if still active project)
- Updates projectData when props change

**Integration tests (E2E):**

- Navigate from projects list into a project → sidebar changes to project view
- Navigate between projects → sidebar updates without flash
- Navigate to document within project → sidebar stays in project view
- Direct navigation to bookmarked project URL → sidebar shows skeleton, then project view (no app-level flash)
- Rapid back/forward navigation → sidebar state remains consistent

## Styling

Use Tailwind utility classes consistently (not CSS variable syntax). The current `ProjectSidebar.tsx` uses `bg-[var(--color-bg-secondary)]` but `Sidebar.tsx` uses `bg-bg-secondary`. Unified component uses Tailwind utilities.

## Out of Scope

- Mobile nav updates (follow-up task using same pattern)
- Transition animations (polish after core works)
- Collapse state persistence to localStorage (future enhancement)
