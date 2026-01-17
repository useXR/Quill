# Editor Formatting Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use devpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make TipTap editor formatting display correctly and enable AI to generate properly formatted content.

**Architecture:** Three-layer approach: (1) CSS styling layer for visual rendering, (2) enhanced toolbar component for user formatting controls, (3) markdown conversion utility for AI-generated content. Each layer is independent and can be implemented/tested separately.

**Tech Stack:** TipTap/ProseMirror, Tailwind CSS v4 with custom properties, lucide-react icons, lightweight markdown parsing (no new dependencies).

---

## Components

### 1. Formatting Style System

**Responsibility:** Render all TipTap node types with proper visual styling.

**Location:** `src/app/globals.css` (ProseMirror section)

**Interfaces:**

- CSS selectors for all TipTap node types (`.ProseMirror h1`, `.ProseMirror ul`, etc.)
- Uses existing CSS custom properties from design system
- Supports light/dark mode via `[data-theme='dark']` variants

**Dependencies:**

- Existing design tokens in `globals.css` (`--color-*`, `--font-*`, `--radius-*`)
- TipTap's default HTML output structure

### 2. Enhanced Toolbar

**Responsibility:** Expose all formatting options in a consistent, accessible interface.

**Location:** `src/components/editor/Toolbar.tsx` (enhanced)

**Interfaces:**

- Receives TipTap `editor` instance
- Emits formatting commands via TipTap's chain API
- Exposes keyboard shortcuts via standard DOM events

**Sub-components:**

- `ToolbarButton` — Single action button with icon, tooltip, active state
- `ToolbarDropdown` — Expandable menu (headings, table sizes)
- `ToolbarDivider` — Visual separator between groups
- `LinkPopover` — URL input for link insertion

**Dependencies:**

- TipTap editor instance
- lucide-react for icons
- Existing Button/Popover patterns from `src/components/ui/`

### 3. Markdown Converter

**Responsibility:** Transform markdown text into TipTap-compatible JSON nodes.

**Location:** `src/lib/editor/markdown-to-tiptap.ts` (new)

**Interfaces:**

```typescript
function markdownToTiptap(markdown: string): TiptapContent;
```

- Input: Raw markdown string (from AI output)
- Output: TipTap JSON structure ready for `insertContent()`

**Dependencies:**

- None (pure function, no external deps)
- TipTap type definitions for output structure

### 4. AI Integration Layer

**Responsibility:** Connect markdown converter to AI output flow.

**Location:** `src/components/editor/SelectionToolbar.tsx` (modified)

**Interfaces:**

- Wraps AI output through `markdownToTiptap()` before insertion
- Maintains existing accept/reject flow

**Dependencies:**

- Markdown converter module
- Existing AI streaming infrastructure

---

## Data Flow

### User-Initiated Formatting

```
User clicks toolbar button
    → Toolbar calls editor.chain().toggleBold().run()
    → TipTap updates document model
    → ProseMirror renders HTML nodes
    → CSS styles apply visual formatting
```

### AI-Generated Content

```
User triggers AI action (Refine, Extend, etc.)
    → AI streams markdown response
    → On accept: markdownToTiptap(output)
    → Returns TipTap JSON nodes
    → editor.insertContent(nodes)
    → ProseMirror renders HTML
    → CSS styles apply visual formatting
```

### Error Paths

- **Invalid markdown:** Converter returns plain text node (graceful fallback)
- **Toolbar command fails:** TipTap silently ignores (existing behavior)
- **AI stream error:** Existing error handling in SelectionToolbar

---

## Key Decisions

### 1. CSS-only styling vs Tailwind Typography plugin

**Decision:** Custom CSS rules in globals.css

**Rationale:**

- Full control over styling to match design system exactly
- No new dependency
- Typography plugin uses different class structure than TipTap output

**Trade-offs:** More CSS to maintain, but isolated to one file section

### 2. Custom markdown parser vs library (marked, remark)

**Decision:** Custom lightweight parser

**Rationale:**

- Only need subset of markdown (headings, lists, bold, italic, links, code, blockquotes)
- Avoid bundle size increase
- TipTap has specific JSON structure requirements

**Trade-offs:** Must handle edge cases ourselves, but limited scope makes this manageable

### 3. Toolbar restructure vs incremental additions

**Decision:** Full restructure into logical groups

**Rationale:**

- Current toolbar is minimal and unorganized
- Users expect Word/Docs-style toolbar
- Easier to add accessibility correctly from scratch

**Trade-offs:** Larger change, but cleaner result

### 4. AI prompts: allow markdown vs continue restricting

**Decision:** Allow markdown, convert on insertion

**Rationale:**

- Natural for AI to express structure via markdown
- Conversion is reliable for supported formats
- Better user experience with formatted AI output

**Trade-offs:** Must handle markdown AI doesn't support gracefully

---

## Error Handling Strategy

### CSS Layer

- No runtime errors possible
- Unstyled content falls back to browser defaults (acceptable)

### Toolbar Layer

- TipTap commands are idempotent and safe
- Disabled states for inapplicable actions (e.g., can't bold when no selection)
- Tooltip hints for why actions may be disabled

### Markdown Converter

- Unknown markdown syntax → preserve as plain text
- Malformed structures → wrap in paragraph node
- Never throw exceptions; always return valid TipTap JSON

### AI Integration

- Conversion failure → insert as plain text (user sees content, can format manually)
- Maintain existing error UI for AI streaming failures

---

## Testing Strategy

### Unit Tests (Vitest)

**Markdown converter:**

- Each supported format converts correctly
- Nested structures (list in list, bold in heading)
- Mixed content (paragraph with bold and links)
- Graceful fallback for unsupported syntax

**Toolbar components:**

- Button active states reflect editor state
- Keyboard shortcuts trigger correct commands
- Dropdowns open/close correctly

### Integration Tests

**Editor + CSS:**

- Apply formatting via command, verify DOM structure
- Toggle formatting, verify state changes

### E2E Tests (Playwright)

**Full formatting flow:**

- Click heading button, type text, verify renders as heading
- Select text, apply bold, verify visual change
- Trigger AI action, accept, verify formatted output

**Accessibility:**

- Toolbar keyboard navigation
- Screen reader announcements for state changes

---

## Implementation Phases

### Phase 1: CSS Styles

Add all ProseMirror formatting styles. Immediate visual improvement with zero risk.

### Phase 2: Toolbar Enhancement

Restructure toolbar with all formatting controls. Can be done incrementally.

### Phase 3: Markdown Converter

Build and thoroughly test the conversion function in isolation.

### Phase 4: AI Integration

Wire converter into SelectionToolbar, update AI prompts.

Each phase is independently deployable and testable.
