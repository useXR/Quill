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

### Data Flow

1. `AppProviders` wraps with `LayoutProvider`
2. `Sidebar` consumes context to read `projectData`
3. `ProjectLayout` calls `setProjectData()` on mount, clears on unmount
4. `projectData === null` → app-level view
5. `projectData !== null` → project-level view

## UI Behavior

### Collapse States

- Collapsed: 64px wide, icons only
- Expanded: 256px wide, icons + labels
- Toggle button at bottom (unchanged)

### Collapsed Project View

- "All Projects" → back arrow icon only
- Project title → hidden (tooltip on hover)
- Documents → single icon, click shows popover with doc list
- Vault/Citations → icons only

## File Changes

### Create

- `src/contexts/LayoutContext.tsx`

### Modify

- `src/components/layout/Sidebar.tsx` — add project-level rendering
- `src/components/layout/AppProviders.tsx` — wrap with LayoutProvider
- `src/components/projects/ProjectLayout.tsx` — use setProjectData instead of rendering ProjectSidebar

### Delete

- `src/components/projects/ProjectSidebar.tsx`
- `src/components/projects/__tests__/ProjectSidebar.test.tsx`

### Test Updates

- Update Sidebar tests for both views
- Update ProjectLayout tests for context integration

## Out of Scope

- Mobile nav updates (follow-up task)
- Transition animations (polish after core works)
