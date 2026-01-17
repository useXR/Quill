# Editor Formatting Overhaul

## Problem Statement

The TipTap editor has formatting capabilities (headings, lists, tables, etc.) but they don't display correctly. Even when users apply formatting via the toolbar, the visual styling is missing. Additionally, when AI generates content with markdown formatting, it's inserted as plain text rather than converted to proper TipTap nodes.

## Requirements

### Scope: Large

### User Decisions

- **Formatting types**: Academic/grant writing + images (headings H1-H3, lists, bold/italic, links, tables, images, highlights, citations, code blocks, blockquotes)
- **AI behavior**: Convert markdown to TipTap formatting before insertion
- **Toolbar style**: Fixed top toolbar (Word/Docs style)
- **Visual style**: Clean academic with serif headings, professional print-ready feel

## Current State

**Already implemented (but unstyled):**

- TipTap StarterKit with headings (H1-H3), lists, bold/italic/strike
- Link, Table, Image, Highlight extensions
- Custom Citation extension
- PaginationPlus for document pages
- Selection toolbar for AI actions

**Missing:**

- CSS styles for formatted content in `.ProseMirror`
- Complete toolbar with all formatting options exposed
- Markdown-to-TipTap conversion for AI output

## Design

### 1. Core Formatting Styles

Add CSS to `globals.css` under `.ProseMirror` using existing design tokens:

**Headings:**

- H1: `font-display` (Libre Baskerville), 2rem, `ink-primary`, 1.5em margin-top
- H2: `font-display`, 1.5rem, `ink-primary`, 1.25em margin-top
- H3: `font-display`, 1.25rem, `ink-secondary`, 1em margin-top

**Lists:**

- Bullet lists: Custom disc marker using `quill` purple, proper indentation
- Numbered lists: Serif numbers matching prose font, hanging indent
- Nested lists: Smaller markers, increased indent per level

**Blockquotes:**

- Left border in `quill-light`, `ink-secondary` text, `font-prose` italic
- Subtle `bg-secondary` background

**Code blocks:**

- `font-mono` (JetBrains Mono), `bg-tertiary` background
- Rounded corners matching `radius-md`

**Tables:**

- Clean borders with `ink-faint`, header row with `bg-secondary`
- Cells with comfortable padding

All styles use CSS variables for light/dark mode consistency.

### 2. Enhanced Fixed Toolbar

Reorganize `Toolbar.tsx` into logical groups:

```
[Undo/Redo] | [Heading ▼] | [B] [I] [S] [Link] | [Bullet] [Number] [Quote] | [Table] [Image] | [Export ▼]
```

**Components:**

- Heading dropdown: Normal text, H1, H2, H3 with current state indicator
- Formatting buttons: Bold, Italic, Strikethrough with active highlighting
- Link button: Popover for URL input
- Block controls: Bullet list, Numbered list, Blockquote toggles
- Table insert: Size picker (2x2, 3x3, 4x4)
- Image insert: File picker or URL input

**Styling:**

- Buttons: `bg-secondary` with `hover:bg-tertiary`
- Active states: `quill-light` background with `quill` text
- Dividers between groups using `ink-faint`
- Icons from lucide-react

**Accessibility:**

- Full keyboard navigation (arrow keys)
- `aria-pressed` for toggle states
- Tooltips with keyboard shortcuts (Cmd+B, etc.)

### 3. AI Markdown Conversion

Create `src/lib/editor/markdown-to-tiptap.ts`:

**Conversion function:**

- Parse markdown (lightweight, no heavy deps)
- Convert to TipTap JSON nodes:
  - `# Heading` → heading node with level
  - `- item` → bulletList with listItem
  - `**bold**` → text with bold mark
  - `[link](url)` → text with link mark
  - Code blocks, blockquotes, etc.

**Integration points:**

- `SelectionToolbar.tsx` `handleAccept`: wrap output in `markdownToTiptap()`
- Chat sidebar (if applicable): same conversion

**Prompt updates:**
Change AI prompts from "no markdown" to:

```
"Output the text with markdown formatting where appropriate (headings, lists, bold, etc.)"
```

### 4. Testing Strategy

**Unit tests (Vitest):**

- `markdown-to-tiptap.test.ts` — all format conversions
- Toolbar component tests — states, keyboard nav

**E2E tests (Playwright):**

- Toolbar applies formatting correctly
- AI output renders with proper formatting
- Keyboard shortcuts work

## Implementation Order

1. **CSS styles** — Immediate visual fix, zero risk
2. **Toolbar enhancements** — Add missing buttons/dropdowns
3. **Markdown converter** — Build and test in isolation
4. **AI integration** — Update prompts and insertion logic

## Files to Modify

- `src/app/globals.css` — Add ProseMirror formatting styles
- `src/components/editor/Toolbar.tsx` — Expand with full controls
- `src/components/editor/SelectionToolbar.tsx` — Use markdown converter
- `src/lib/editor/markdown-to-tiptap.ts` — New file
- `src/lib/ai/streaming.ts` — Update system prompt (optional)

## Open Questions

None — all decisions made during brainstorming.
