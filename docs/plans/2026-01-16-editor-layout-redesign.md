# Editor Layout Redesign: Google Docs-Style Page Canvas

**Date:** 2026-01-16
**Status:** Approved (Revised)
**Goal:** Transform the document editor from a bordered box to a floating page on a neutral canvas, with sidebars that push content rather than overlay.

**Minimum supported viewport:** 1920x1080

---

## Overview

The current editor layout places content in a bordered container within a cream background. This redesign adopts a Google Docs-inspired approach: a white "page" floating on a neutral gray canvas, with sidebars that integrate into the flex layout rather than overlaying content.

## Current State

```
┌───────────────────────────────────────────────────────┐
│                    Header (64px)                       │
├─────────┬─────────────────────────────────────────────┤
│  Left   │                                             │
│ Sidebar │     Main Content Area                       │  ← Chat overlays
│  (256px │     (max-w-5xl centered)                    │     from right
│   or    │     bordered editor box                     │
│  64px)  │                                             │
└─────────┴─────────────────────────────────────────────┘
```

**Issues:**

- Chat sidebar overlays content, obscuring the document
- Editor feels like a "form field" rather than a document
- No sense of page/paper metaphor

## Proposed State

```
┌─────────────────────────────────────────────────────────────────┐
│                        Header (64px)                             │
├─────────┬─────────────────────────────────────────────┬─────────┤
│  Left   │                                             │  Chat   │
│ Sidebar │      Gray Canvas Background                 │ Sidebar │
│  (256px │    ┌─────────────────────────┐              │  (384px │
│   or    │    │  White Page (650-850px) │   ←centered  │   when  │
│  64px)  │    │   with shadow           │    in space  │  open)  │
│         │    └─────────────────────────┘              │         │
└─────────┴─────────────────────────────────────────────┴─────────┘
```

**Benefits:**

- Page-like document feel (paper metaphor)
- Sidebars push content, never obscure it
- Flexible reading width adapts to available space
- Professional, focused writing environment

---

## Design Specifications

### 1. Page Canvas

**Visual treatment:**

- **Canvas background:** Warm neutral gray (`--color-canvas-bg: #e8e6e3`)
- **Page surface:** White (`--color-surface`) with soft shadow
- **Page width:** Flexible range, `min-width: 650px`, `max-width: 850px`
  - Expands to fill available space within range
  - Grant proposals benefit from wider content for tables/lists
- **Page margins:** 64px horizontal padding (comfortable reading margins)
- **Vertical spacing:** Page floats with `py-8` breathing room above/below

**Toolbar integration:**

- Toolbar stays attached to top of page
- Part of the "document" visual unit
- Same white background as page content

**Breadcrumb integration:**

- Move breadcrumb into a compact header bar above the page
- Shows: Project Name › Document Title
- Keeps wayfinding without consuming vertical space in page

### 2. Sidebar Push Behavior

**Layout structure:**

- Main content area becomes flex container: `[canvas-area] + [chat-sidebar?]`
- Chat sidebar is conditional flex child, not fixed overlay
- Canvas area is `flex-1`, fills remaining space

**Transition behavior:**

- Chat open/close: `transition-[width] duration-200 ease-out`
  - Explicit width transition only (avoids layout thrashing from `transition-all`)
- Include `motion-reduce:transition-none` for accessibility
- Page automatically recenters via flexbox centering within canvas

**FAB (Floating Action Button):**

- When chat closed, FAB appears in bottom-right of canvas area
- Positioned with `absolute` relative to canvas container, not viewport
- Maintains association with editing context

### 3. Width Calculations

| Component                | Width                    |
| ------------------------ | ------------------------ |
| Left sidebar (expanded)  | 256px                    |
| Left sidebar (collapsed) | 64px                     |
| Chat sidebar (open)      | 384px                    |
| Chat sidebar (closed)    | 0px                      |
| Page width               | 650-850px (flexible)     |
| Canvas area              | Remaining viewport width |

**Example at 1920px viewport, both sidebars open:**

- Left: 256px, Chat: 384px, Canvas: 1280px
- Page expands to 850px max, centered with 215px margins each side

**Example at 1920px viewport, chat closed:**

- Left: 256px, Canvas: 1664px
- Page at 850px, centered with 407px margins each side

### 4. DiffPanel Behavior

The DiffPanel remains a **fixed overlay modal** (`fixed inset-0`):

- Does not participate in flex layout
- Appears above all content when reviewing AI changes
- Max-width of 896px provides clear visual hierarchy over 850px page
- This is intentional—diff review is a modal operation

### 5. SelectionToolbar Positioning

The SelectionToolbar uses absolute positioning based on text selection coordinates. With the new layout:

- Ensure EditorCanvas or page wrapper has `position: relative`
- Selection coordinates remain valid within the positioned ancestor
- Test thoroughly after layout changes

---

## Implementation Plan

### Implementation Order

The order matters due to dependencies:

1. **globals.css** — Add design tokens first (other components depend on them)
2. **ChatSidebar.tsx** — Restructure from conditional render to flex child
3. **EditorCanvas.tsx** — Create new canvas wrapper component
4. **Editor.tsx** — Remove border/shadow (depends on EditorCanvas existing)
5. **DocumentPageClient.tsx** — Wire up new flex layout
6. **page.tsx** — Relocate breadcrumb, remove old wrapper

### Components to Modify

#### 1. `src/app/globals.css`

Add new design tokens:

```css
@theme {
  --color-canvas-bg: #e8e6e3;
  --page-width-min: 650px;
  --page-width-max: 850px;
  --page-margin-x: 64px;
}
```

#### 2. `src/components/chat/ChatSidebar.tsx`

**Critical restructure required.** Current component uses early return for FAB:

```tsx
// CURRENT (problematic)
if (!state.isOpen) {
  return <button className="fixed ...">FAB</button>;
}
return <div className="fixed ...">Panel</div>;
```

Must change to always render as flex child:

```tsx
// NEW STRUCTURE
return (
  <div
    className={`
      h-full border-l border-ink-faint
      transition-[width] duration-200 ease-out
      motion-reduce:transition-none
      ${state.isOpen ? 'w-96' : 'w-0'}
    `}
  >
    {state.isOpen ? <div className="w-96 h-full flex flex-col bg-surface">{/* Panel content */}</div> : null}
  </div>
);
```

FAB moves to EditorCanvas component (positioned relative to canvas).

#### 3. New: `src/components/editor/EditorCanvas.tsx`

```tsx
import { ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';

interface EditorCanvasProps {
  children: ReactNode;
}

export function EditorCanvas({ children }: EditorCanvasProps) {
  const { state, dispatch } = useChat();

  return (
    <div className="relative flex-1 bg-[var(--color-canvas-bg)] overflow-auto">
      {/* Canvas area with centered page */}
      <div className="min-h-full flex items-start justify-center py-8 px-4">
        <div
          className="
            w-full
            min-w-[var(--page-width-min)]
            max-w-[var(--page-width-max)]
          "
        >
          {children}
        </div>
      </div>

      {/* FAB - only when chat is closed */}
      {!state.isOpen && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="
            absolute right-6 bottom-6
            p-3 bg-quill text-white rounded-full shadow-lg
            hover:bg-quill-dark hover:shadow-xl hover:scale-105
            active:bg-quill-darker active:scale-95
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          aria-label="Open chat sidebar"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}
```

#### 4. `src/components/editor/Editor.tsx`

Remove outer container styling (page wrapper now handles it):

```tsx
// REMOVE from Editor.tsx:
// border border-[var(--color-ink-faint)]
// rounded-[var(--radius-xl)]
// shadow-[var(--shadow-warm-md)]

// Page wrapper in EditorCanvas handles:
// - White background
// - Border radius
// - Shadow
// - Overflow hidden
```

Update the wrapper div to be the "page":

```tsx
<div
  className="
    bg-[var(--color-surface)]
    rounded-[var(--radius-xl)]
    shadow-[var(--shadow-warm-lg)]
    overflow-hidden
  "
>
  {showToolbar && <Toolbar ... />}
  <div className="bg-[var(--color-editor-bg)] relative">
    <EditorContent editor={editor} />
    {/* SelectionToolbar */}
  </div>
  {showWordCount && <WordCount ... />}
</div>
```

#### 5. `src/app/projects/[id]/documents/[docId]/DocumentPageClient.tsx`

Restructure to flex layout:

```tsx
export function DocumentPageClient({ documentId, projectId, document }: Props) {
  return (
    <ChatProvider>
      <DiffProvider>
        <DocumentEditorProvider documentId={documentId} projectId={projectId}>
          {/* Flex container for canvas + sidebar */}
          <div className="flex h-full">
            <EditorCanvas>
              {/* Breadcrumb bar */}
              <div className="mb-4 text-sm text-[var(--color-ink-tertiary)]">
                <Link href={`/projects/${projectId}`} className="hover:text-[var(--color-ink-secondary)]">
                  {/* Project title from context or prop */}
                  Project Name
                </Link>
                <span className="mx-2">›</span>
                <span className="text-[var(--color-ink-primary)]">{document.title}</span>
              </div>

              <DocumentEditor documentId={documentId} initialDocument={document} enableAI={true} />
            </EditorCanvas>

            <ChatSidebar documentId={documentId} projectId={projectId} />
          </div>

          {/* DiffPanel stays as overlay, outside flex */}
          <DiffPanelWrapper />
        </DocumentEditorProvider>
      </DiffProvider>
    </ChatProvider>
  );
}
```

#### 6. `src/app/projects/[id]/documents/[docId]/page.tsx`

- Remove `max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8` wrapper
- Remove breadcrumb (moved to DocumentPageClient)
- Pass project title to client component for breadcrumb

```tsx
return (
  <ProjectLayout ...>
    <DocumentPageClient
      documentId={docId}
      projectId={projectId}
      document={document}
      projectTitle={project.title}  // Add this prop
    />
  </ProjectLayout>
);
```

---

## Accessibility Considerations

1. **Focus management:**
   - When chat opens: move focus to chat panel
   - When chat closes: return focus to FAB trigger location
   - Use `useEffect` to manage focus on `state.isOpen` change

2. **Reduced motion:**
   - All transitions include `motion-reduce:transition-none`
   - Already established pattern in codebase

3. **Landmarks:**
   - EditorCanvas: `role="main"` or ensure within `<main>`
   - ChatSidebar: `role="complementary"` with `aria-label="Document chat"`

4. **Screen reader announcements:**
   - Add `aria-live="polite"` region to announce layout changes
   - "Chat panel opened" / "Chat panel closed"

---

## Testing Considerations

1. **Viewport:** Test at 1920x1080 and larger
2. **Sidebar combinations:** Both open, one open, none open
3. **Left sidebar collapse:** Verify page recenters correctly
4. **Chat sidebar transition:** Smooth open/close animation (no jank)
5. **SelectionToolbar:** Verify positioning after layout changes
6. **Focus management:** Tab navigation, focus on open/close
7. **Keyboard:** Escape closes chat, focus returns appropriately

---

## Future Enhancements (Out of Scope)

- Page zoom controls
- Multiple page sizes (letter, A4, custom)
- Print preview mode
- Full-screen/zen mode
- Persist chat open state across document navigation
