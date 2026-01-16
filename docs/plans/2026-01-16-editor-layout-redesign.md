# Editor Layout Redesign: Google Docs-Style Page Canvas

**Date:** 2026-01-16
**Status:** Approved (Final)
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
  - Note: Verify contrast ratio with `--color-ink-tertiary` for breadcrumb text
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
- Truncate long titles with ellipsis if needed

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
- **Critical:** FAB must be positioned outside the scrolling container so it remains visible when document is scrolled
- Uses `absolute` positioning relative to canvas wrapper, not the scrolling content
- Add `z-40` to ensure FAB appears above content but below modals

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

**Critical fix required:** The SelectionToolbar uses `view.coordsAtPos()` which returns viewport-relative coordinates. With the new nested layout, these coordinates will be incorrect.

**Current (broken with new layout):**

```tsx
const style = {
  top: `${selection.rect.top - 50}px`,
  left: `${selection.rect.left}px`,
};
```

**Required fix:**

```tsx
// Convert viewport coords to element-relative coords
const editorRect = editorRef.current?.getBoundingClientRect();
const style = editorRect
  ? {
      top: `${selection.rect.top - editorRect.top - 50}px`,
      left: `${selection.rect.left - editorRect.left}px`,
    }
  : {};
```

This must be implemented as part of the layout change.

---

## Implementation Plan

### Implementation Order

The order matters due to dependencies:

1. **globals.css** — Add design tokens first (other components depend on them)
2. **ChatSidebar.tsx** — Restructure from conditional render to flex child
3. **EditorCanvas.tsx** — Create new canvas wrapper component
4. **SelectionToolbar.tsx** — Fix coordinate calculation for new layout
5. **Editor.tsx** — Remove border/shadow (depends on EditorCanvas existing)
6. **DocumentPageClient.tsx** — Wire up new flex layout
7. **page.tsx** — Relocate breadcrumb, remove old wrapper

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

**Verification:** After adding, check that `--color-ink-tertiary` (#78716c) on `--color-canvas-bg` (#e8e6e3) meets WCAG AA contrast (4.5:1). If not, use `--color-ink-secondary` for breadcrumb text.

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
      h-full overflow-hidden
      transition-[width] duration-200 ease-out
      motion-reduce:transition-none
      ${state.isOpen ? 'w-96 border-l border-ink-faint' : 'w-0'}
    `}
  >
    {state.isOpen ? <div className="w-96 h-full flex flex-col bg-surface">{/* Panel content */}</div> : null}
  </div>
);
```

**Key changes:**

- `overflow-hidden` prevents content escaping during close transition
- Border is conditional (only when open) to avoid 1px line when closed
- FAB moves to EditorCanvas component

#### 3. New: `src/components/editor/EditorCanvas.tsx`

**Critical:** FAB must be outside the scrolling container.

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
    // Outer wrapper: relative positioning context for FAB, no overflow
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Scrolling container for canvas content */}
      <div className="flex-1 overflow-auto bg-[var(--color-canvas-bg)]">
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
      </div>

      {/* FAB - OUTSIDE scroll container so it stays fixed in viewport */}
      {!state.isOpen && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="
            absolute right-6 bottom-6 z-40
            p-3 bg-quill text-white rounded-full shadow-lg
            hover:bg-quill-dark hover:shadow-xl hover:scale-105
            active:bg-quill-darker active:scale-95
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          aria-label="Open chat sidebar"
          data-testid="chat-fab"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}
```

#### 4. `src/components/editor/SelectionToolbar.tsx`

Fix coordinate calculation:

```tsx
// Add ref to get editor element position
const editorRef = useRef<HTMLElement>(null);

// In positioning logic:
const editorRect = editorRef.current?.getBoundingClientRect();
const style =
  selection.rect && editorRect
    ? {
        position: 'absolute' as const,
        top: `${selection.rect.top - editorRect.top - 50}px`,
        left: `${selection.rect.left - editorRect.left}px`,
      }
    : { position: 'absolute' as const };
```

Ensure the parent element with `position: relative` is the correct ancestor.

#### 5. `src/components/editor/Editor.tsx`

Remove outer container styling (page wrapper now handles it):

```tsx
// REMOVE from Editor.tsx wrapper:
// border border-[var(--color-ink-faint)]
// rounded-[var(--radius-xl)]
// shadow-[var(--shadow-warm-md)]

// KEEP: The wrapper becomes the "page" visual
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

#### 6. `src/app/projects/[id]/documents/[docId]/DocumentPageClient.tsx`

Update interface and restructure to flex layout:

```tsx
interface DocumentPageClientProps {
  documentId: string;
  projectId: string;
  document: Document;
  projectTitle: string; // NEW: for breadcrumb
}

export function DocumentPageClient({ documentId, projectId, document, projectTitle }: DocumentPageClientProps) {
  return (
    <ChatProvider>
      <DiffProvider>
        <DocumentEditorProvider documentId={documentId} projectId={projectId}>
          {/* Flex container for canvas + sidebar */}
          <div className="flex h-full">
            <EditorCanvas>
              {/* Breadcrumb bar */}
              <nav className="mb-4 text-sm" aria-label="Breadcrumb">
                <Link
                  href={`/projects/${projectId}`}
                  className="text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]"
                >
                  {projectTitle}
                </Link>
                <span className="mx-2 text-[var(--color-ink-tertiary)]">›</span>
                <span className="text-[var(--color-ink-primary)] truncate">{document.title}</span>
              </nav>

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

#### 7. `src/app/projects/[id]/documents/[docId]/page.tsx`

- Remove `max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8` wrapper
- Remove breadcrumb (moved to DocumentPageClient)
- Pass project title to client component

```tsx
return (
  <ProjectLayout ...>
    <DocumentPageClient
      documentId={docId}
      projectId={projectId}
      document={document}
      projectTitle={project.title}
    />
  </ProjectLayout>
);
```

---

## Accessibility Considerations

1. **Focus management:**
   - When chat opens: move focus to chat panel header or first focusable element
   - When chat closes: return focus to FAB
   - Requires ref forwarding: EditorCanvas exposes FAB ref, ChatSidebar calls it on close
   - Use `useEffect` to manage focus on `state.isOpen` change

2. **Reduced motion:**
   - All transitions include `motion-reduce:transition-none`
   - Already established pattern in codebase

3. **Landmarks:**
   - EditorCanvas: ensure within `<main>` from AppShell
   - ChatSidebar: `role="complementary"` with `aria-label="Document chat"`
   - Breadcrumb: wrap in `<nav aria-label="Breadcrumb">`

4. **Screen reader announcements:**
   - Add `aria-live="polite"` region to announce layout changes
   - "Chat panel opened" / "Chat panel closed"

5. **Keyboard:**
   - Escape closes chat sidebar (already implemented)
   - Tab should not trap in closed sidebar (handled by `w-0` + no rendered content)

---

## Testing Considerations

1. **Viewport:** Test at 1920x1080 and larger
2. **Sidebar combinations:** Both open, one open, none open
3. **Left sidebar collapse:** Verify page recenters correctly
4. **Chat sidebar transition:** Smooth open/close animation (no jank)
5. **SelectionToolbar:** Verify positioning after layout changes - **critical test**
6. **FAB visibility:** Verify FAB stays visible when scrolling long documents
7. **Focus management:** Tab navigation, focus on open/close
8. **Keyboard:** Escape closes chat, focus returns to FAB
9. **Color contrast:** Verify breadcrumb text readable on canvas background

---

## Future Enhancements (Out of Scope)

- Support for viewports below 1920x1080 (auto-collapse sidebars)
- Page zoom controls
- Multiple page sizes (letter, A4, custom)
- Print preview mode
- Full-screen/zen mode
- Persist chat open state across document navigation
- Table overflow handling (horizontal scroll for wide tables)
