# Editor Layout Redesign: Google Docs-Style Page Canvas

**Date:** 2026-01-16
**Status:** Approved
**Goal:** Transform the document editor from a bordered box to a floating page on a neutral canvas, with sidebars that push content rather than overlay.

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
│   or    │    │   White Page (~750px)   │   ←centered  │   when  │
│  64px)  │    │   with shadow           │    in space  │  open)  │
│         │    └─────────────────────────┘              │         │
└─────────┴─────────────────────────────────────────────┴─────────┘
```

**Benefits:**

- Page-like document feel (paper metaphor)
- Sidebars push content, never obscure it
- Optimal reading width enforced
- Professional, focused writing environment

---

## Design Specifications

### 1. Page Canvas

**Visual treatment:**

- **Canvas background:** Warm neutral gray (`--color-canvas-bg: #e8e6e3`)
- **Page surface:** White (`--color-surface`) with soft shadow
- **Page width:** ~750px (optimal 65-75 character line length)
- **Page margins:** 72px horizontal padding (mimics 1" print margins)
- **Vertical spacing:** Page floats with breathing room above/below

**Toolbar integration:**

- Toolbar stays attached to top of page
- Part of the "document" visual unit
- Same white background as page content

### 2. Sidebar Push Behavior

**Layout structure:**

- Main area becomes flex container: `[canvas-area] + [chat-sidebar?]`
- Chat sidebar is conditional flex child, not fixed overlay
- Canvas area is `flex-1`, fills remaining space

**Transition behavior:**

- Chat open/close: `transition-all duration-200`
- Page automatically recenters via `margin: auto` within canvas
- Smooth, non-jarring experience

**FAB (Floating Action Button):**

- When chat closed, FAB appears in bottom-right of canvas area
- Not fixed to viewport—positioned within canvas bounds

### 3. Width Calculations

| Component                | Width                    |
| ------------------------ | ------------------------ |
| Left sidebar (expanded)  | 256px                    |
| Left sidebar (collapsed) | 64px                     |
| Chat sidebar (open)      | 384px                    |
| Chat sidebar (closed)    | 0px                      |
| Page width               | 750px (fixed)            |
| Canvas area              | Remaining viewport width |

**Example at 1920px viewport, both sidebars open:**

- Left: 256px, Chat: 384px, Canvas: 1280px
- Page (750px) centers within 1280px canvas

---

## Implementation Plan

### Components to Modify

#### 1. `src/components/layout/AppShell.tsx`

- Subscribe to chat sidebar open/closed state
- Pass state down or use context for layout awareness

#### 2. New: `src/components/editor/EditorCanvas.tsx`

Create wrapper component:

```tsx
interface EditorCanvasProps {
  children: ReactNode;
}

export function EditorCanvas({ children }: EditorCanvasProps) {
  return (
    <div className="flex-1 bg-[var(--color-canvas-bg)] overflow-auto">
      <div className="min-h-full flex items-start justify-center py-8 px-4">
        <div className="w-[750px] max-w-full">{children}</div>
      </div>
    </div>
  );
}
```

#### 3. `src/app/projects/[id]/documents/[docId]/page.tsx`

- Remove `max-w-5xl mx-auto` wrapper
- Remove or relocate breadcrumb (consider page header)
- Wrap content in new layout structure

#### 4. `src/app/projects/[id]/documents/[docId]/DocumentPageClient.tsx`

- Restructure to flex layout
- ChatSidebar becomes flex child
- Wrap DocumentEditor in EditorCanvas

```tsx
export function DocumentPageClient({ ... }) {
  return (
    <ChatProvider>
      <DiffProvider>
        <DocumentEditorProvider ...>
          <div className="flex h-full">
            <EditorCanvas>
              <DocumentEditor ... />
            </EditorCanvas>
            <ChatSidebar ... />
          </div>
          <DiffPanelWrapper />
        </DocumentEditorProvider>
      </DiffProvider>
    </ChatProvider>
  );
}
```

#### 5. `src/components/chat/ChatSidebar.tsx`

- Remove `fixed right-0 top-0 h-full` positioning
- Become flex child: `h-full w-96` when open, `w-0` when closed
- Adjust FAB positioning to be relative to canvas, not viewport

#### 6. `src/components/editor/Editor.tsx`

- Remove outer border and shadow (page wrapper handles this)
- Page wrapper provides: white bg, shadow, border-radius
- Internal padding becomes page margins

#### 7. `src/app/globals.css`

Add new design tokens:

```css
@theme {
  --color-canvas-bg: #e8e6e3;
  --page-width: 750px;
  --page-margin-x: 72px;
}
```

### Migration Notes

- Breadcrumb navigation: Consider moving to header area or removing (document title is already shown)
- DiffPanelWrapper: May need adjustment for new layout
- Mobile: Canvas approach degrades gracefully (page fills screen)

---

## Testing Considerations

1. **Responsive behavior:** Test at various viewport widths
2. **Sidebar combinations:** Both open, one open, none open
3. **Left sidebar collapse:** Verify page recenters correctly
4. **Chat sidebar transition:** Smooth open/close animation
5. **Mobile:** Verify graceful degradation
6. **Accessibility:** Focus management, keyboard navigation still work

---

## Future Enhancements (Out of Scope)

- Page zoom controls
- Multiple page sizes (letter, A4, custom)
- Print preview mode
- Full-screen/zen mode
