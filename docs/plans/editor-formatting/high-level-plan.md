# Editor Formatting Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use devpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make TipTap editor formatting display correctly and enable AI to generate properly formatted content.

**Architecture:** Two-layer approach: (1) CSS styling layer for visual rendering of all TipTap node types, (2) AI integration using @tiptap/markdown extension for native markdown-to-TipTap conversion. Toolbar enhancement is incremental, not a rewrite.

**Tech Stack:** TipTap/ProseMirror, @tiptap/markdown (new dependency), Tailwind CSS v4 with custom properties, lucide-react icons.

---

## Components

### 1. Formatting Style System

**Responsibility:** Render all TipTap node types with proper visual styling.

**Location:** `src/app/globals.css` (ProseMirror section)

**Interfaces:**

- CSS selectors for all TipTap node types:
  - Headings: `.ProseMirror h1`, `.ProseMirror h2`, `.ProseMirror h3`
  - Lists: `.ProseMirror ul`, `.ProseMirror ol`, `.ProseMirror li`
  - Block elements: `.ProseMirror blockquote`, `.ProseMirror pre`, `.ProseMirror code`, `.ProseMirror hr`
  - Tables: `.ProseMirror table`, `.ProseMirror th`, `.ProseMirror td`
- Uses existing CSS custom properties from design system (`--color-*`, `--font-*`)
- Dark mode automatic via custom properties (no explicit `[data-theme='dark']` needed per element)

**Dependencies:**

- Existing design tokens in `globals.css`
- TipTap's default HTML output structure

### 2. Toolbar Enhancement

**Responsibility:** Add missing formatting buttons to existing toolbar.

**Location:** `src/components/editor/Toolbar.tsx` (enhanced incrementally)

**Approach:** Extend existing patterns, not rewrite. The current toolbar already has:

- Organized button groups with dividers
- Proper ARIA attributes (`role="toolbar"`, `aria-pressed`)
- Active state styling with design system tokens
- `renderButton()` helper function

**Additions needed:**

- Blockquote toggle button
- Code block button
- Horizontal rule button
- Verify all StarterKit formats have toolbar exposure

**Keyboard shortcuts:** TipTap's StarterKit provides built-in shortcuts (Mod+B, Mod+I, etc.). Verify they work and toolbar reflects active state when used.

**Dependencies:**

- TipTap editor instance
- lucide-react for icons (already installed)

### 3. AI Markdown Integration

**Responsibility:** Enable AI to output markdown and convert to TipTap format.

**Location:** `src/components/editor/SelectionToolbar.tsx` (modified)

**Approach:** Use `@tiptap/markdown` extension for native markdown handling.

**Changes required:**

1. **Install extension:** `pnpm add @tiptap/markdown`

2. **Add to extensions:** In `src/components/editor/extensions/index.ts`:

   ```typescript
   import { Markdown } from '@tiptap/markdown';
   // Add to extensions array
   ```

3. **Update insertion:** In `handleAccept`:

   ```typescript
   editor.commands.insertContent(output, { contentType: 'markdown' });
   ```

4. **Update AI prompts:** Remove "no markdown formatting" restriction from all four action prompts in SelectionToolbar.tsx and the system prompt in streaming.ts

**Dependencies:**

- `@tiptap/markdown` extension (~15KB)
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
    → AI streams markdown response (headings, lists, bold, tables, etc.)
    → On accept: editor.commands.insertContent(output, { contentType: 'markdown' })
    → @tiptap/markdown parses and converts to TipTap nodes
    → ProseMirror renders HTML
    → CSS styles apply visual formatting
```

### Error Paths

- **Invalid markdown:** @tiptap/markdown handles gracefully, inserts as plain text
- **Toolbar command fails:** TipTap silently ignores (existing behavior)
- **AI stream error:** Existing error handling in SelectionToolbar

---

## Key Decisions

### 1. CSS-only styling vs Tailwind Typography plugin

**Decision:** Custom CSS rules in globals.css

**Rationale:**

- Full control over styling to match design system exactly
- No new dependency for CSS
- Typography plugin uses different class structure than TipTap output

**Trade-offs:** More CSS to maintain, but isolated to one file section

### 2. @tiptap/markdown vs custom parser

**Decision:** Use @tiptap/markdown extension

**Rationale:**

- Native TipTap integration, battle-tested
- Handles all markdown features including tables, nested structures, edge cases
- ~15KB bundle increase is acceptable for reliability
- AI naturally outputs markdown; this approach plays to its strengths

**Trade-offs:** New dependency, but eliminates 2-4 days of custom parser work and edge case risk

### 3. Toolbar approach: incremental vs rewrite

**Decision:** Incremental enhancement

**Rationale:**

- Current toolbar already has good structure and accessibility
- Only need to add ~3 missing buttons (blockquote, code, hr)
- Lower risk than full rewrite

**Trade-offs:** May accumulate some cruft, but faster and safer

### 4. AI prompts: allow markdown

**Decision:** Update prompts to allow/encourage markdown

**Rationale:**

- AI naturally expresses structure via markdown
- @tiptap/markdown handles conversion reliably
- Better user experience with formatted AI output

**Changes needed:** Update 4 action prompts in SelectionToolbar.tsx + system prompt in streaming.ts

---

## Error Handling Strategy

### CSS Layer

- No runtime errors possible
- Unstyled content falls back to browser defaults
- Use CSS custom properties for automatic dark mode support

### Toolbar Layer

- TipTap commands are idempotent and safe
- Disabled states for inapplicable actions
- Tooltip hints for available keyboard shortcuts

### AI Integration

- @tiptap/markdown handles malformed markdown gracefully
- Conversion failure → content inserted as plain text
- Maintain existing error UI for AI streaming failures
- Verify AI undo (useAIUndo.ts) works with formatted content

---

## Testing Strategy

### Unit Tests (Vitest)

**Toolbar additions:**

- New buttons render and toggle correctly
- Active states reflect editor state
- Keyboard shortcuts trigger correct commands (integration with StarterKit)

### Integration Tests

**Editor + CSS:**

- Apply each format via command, verify DOM structure has expected classes
- Toggle formatting, verify state changes
- Test in both light and dark mode

**AI + Markdown:**

- Insert markdown via `insertContent` with `contentType: 'markdown'`
- Verify complex markdown (nested lists, tables, bold in headings) renders correctly

### E2E Tests (Playwright)

**Full formatting flow:**

- Click heading button, type text, verify renders as heading
- Select text, apply bold, verify visual change
- Trigger AI action, accept markdown output, verify formatted result

**Dark mode:**

- Run formatting tests with `data-theme="dark"`
- Verify contrast and readability

**Accessibility:**

- Toolbar keyboard navigation (existing)
- Verify AI undo works with formatted content

---

## Implementation Phases

### Phase 1: CSS Styles

Add all ProseMirror formatting styles for headings, lists, blockquotes, code blocks, horizontal rules, and tables. Use existing CSS custom properties for automatic dark mode support.

**Verification:** Manual visual check in both light/dark modes.

### Phase 2: Toolbar Enhancement

Add missing buttons (blockquote, code block, hr) using existing `renderButton()` pattern. Verify all StarterKit keyboard shortcuts work and reflect in toolbar state.

**Verification:** Click each button, verify formatting applies and button shows active state.

### Phase 3: AI Integration

Install @tiptap/markdown, add to extensions, update `handleAccept` to use `contentType: 'markdown'`, update AI prompts to allow markdown output.

**Verification:** Trigger AI action, verify markdown output renders with proper formatting.

### Phase 4: Testing & Polish

Add dark mode E2E tests, verify AI undo works, address any edge cases discovered.

Each phase is independently deployable and testable.

---

## Revision History

### v2 - 2026-01-16 - Plan Review Round 1

**Issues Addressed:**

- [CRITICAL] Replaced custom markdown parser with @tiptap/markdown extension (Simplicity)
- [CRITICAL] Added tables, code blocks, hr to CSS scope (Completeness)
- [CRITICAL] Added dark mode testing to strategy (Completeness)
- [IMPORTANT] Removed premature component extraction (ToolbarButton, etc.) — use existing inline patterns (Simplicity)
- [IMPORTANT] Removed LinkPopover scope creep — not in requirements (Simplicity)
- [IMPORTANT] Made AI prompt updates explicit in Phase 3 (Completeness)
- [IMPORTANT] Clarified keyboard shortcuts come from StarterKit (Completeness)
- [IMPORTANT] Changed toolbar approach from "full restructure" to "incremental" (Simplicity)

**Reviewer Notes:** Major simplification by using @tiptap/markdown instead of custom parser. Reduces scope from 4 components to 2, eliminates 2-4 days of edge case handling.
