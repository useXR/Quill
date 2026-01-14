# Task 3.15: Integration with Editor

> **Phase 3** | [← E2E Tests](./14-e2e-tests.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task integrates all AI components into the main document editor.** This final integration task brings together the selection tracker, toolbar, and cursor prompt components into a cohesive editing experience.

### Prerequisites

- **Task 3.12** completed (Selection Tracker) - provides selection state
- **Task 3.13** completed (Selection Toolbar) - provides toolbar component

### What This Task Creates

- Updates `src/components/editor/DocumentEditor.tsx` to include AI features

### Tasks That Depend on This

- None (final implementation task)

### Design System: Editor Integration Styling

All integrated components **MUST** follow the [Quill Design System](../../design-system.md) "Scholarly Craft" aesthetic:

#### Editor Container

```tsx
<div className="bg-bg-primary min-h-screen">
  <div className="max-w-4xl mx-auto px-6 py-8">{/* Editor content */}</div>
</div>
```

#### Editor Content Area

```tsx
<EditorContent
  editor={editor}
  className="
    prose prose-stone prose-lg
    max-w-none
    font-prose
    text-ink-primary
    [&_::selection]:bg-editor-selection
    [&_.ProseMirror]:outline-none
    [&_.ProseMirror]:min-h-[60vh]
  "
/>
```

#### Typography Classes (via Tailwind prose)

- Headings: `font-display` (Libre Baskerville)
- Body: `font-prose` (Libre Baskerville)
- `prose-stone` for warm gray base colors

#### Key Design Tokens for Editor

| Element    | Token                              | Description             |
| ---------- | ---------------------------------- | ----------------------- |
| Background | `bg-bg-primary`                    | Warm cream (#fdfcfb)    |
| Text       | `text-ink-primary`                 | Deep charcoal (#1c1917) |
| Selection  | `bg-editor-selection`              | Light quill (#ede9fe)   |
| Links      | `text-quill hover:text-quill-dark` | Brand purple            |

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.14** (E2E Tests)

---

## Files to Create/Modify

- `src/components/editor/DocumentEditor.tsx` (modify)

---

## Steps

### Step 1: Create useEditorSelection hook

First, create a hook for consuming selection state:

```typescript
// src/components/editor/extensions/selection-tracker.ts
// Add to existing file:

import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useEditorSelection(editor: Editor | null): SelectionState | null {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    if (!editor) return;

    const tracker = editor.storage.selectionTracker;
    if (!tracker) return;

    // Set initial state
    setSelection(tracker.selection);

    // Subscribe to changes
    const listener = (sel: SelectionState | null) => setSelection(sel);
    tracker.listeners.add(listener);

    return () => {
      tracker.listeners.delete(listener);
    };
  }, [editor]);

  return selection;
}
```

### Step 2: Integrate all components

Update your existing DocumentEditor:

```typescript
// src/components/editor/DocumentEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SelectionTracker, useEditorSelection } from './extensions/selection-tracker';
import { SelectionToolbar } from './SelectionToolbar';
import { CursorPrompt } from './CursorPrompt';

interface DocumentEditorProps {
  projectId: string;
  documentId: string;
  initialContent?: string;
}

export function DocumentEditor({ projectId, documentId, initialContent }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      SelectionTracker,
    ],
    content: initialContent || '<p>Start writing...</p>',
  });

  const selection = useEditorSelection(editor);

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        className="prose max-w-none"
      />

      {editor && selection && (
        <SelectionToolbar
          editor={editor}
          selection={selection}
          projectId={projectId}
          documentId={documentId}
        />
      )}

      {editor && (
        <CursorPrompt
          editor={editor}
          projectId={projectId}
          documentId={documentId}
        />
      )}
    </div>
  );
}
```

### Step 3: Create CursorPrompt component with Design System

Create the component following the [Quill Design System](../../design-system.md):

```typescript
// src/components/editor/CursorPrompt.tsx
'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';

interface CursorPromptProps {
  editor: Editor;
  projectId: string;
  documentId: string;
}

export function CursorPrompt({ editor, projectId, documentId }: CursorPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const store = useAIStore();
  const { startStream, cancel, content, isStreaming } = useAIStream({
    onChunk: (chunk) => store.appendOutput(chunk),
    onComplete: () => store.setStatus('preview'),
    onError: (err) => store.setError(err),
  });

  // Handle Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const snapshot = editor.getHTML();
    store.startOperation('cursor', prompt, snapshot);
    await startStream(prompt, documentId, projectId);
  }, [editor, prompt, store, startStream, documentId, projectId]);

  const handleAccept = useCallback(() => {
    if (!store.currentOperation?.output) return;

    editor.chain()
      .focus()
      .insertContent(store.currentOperation.output)
      .run();

    store.acceptOperation();
    setIsOpen(false);
    setPrompt('');
  }, [editor, store]);

  const handleCancel = useCallback(() => {
    cancel();
    store.rejectOperation();
    setIsOpen(false);
    setPrompt('');
  }, [cancel, store]);

  if (!isOpen) return null;

  const isPreview = store.currentOperation?.status === 'preview';
  const isLoading = store.currentOperation?.status === 'loading';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cursor-prompt-title"
      className="
        fixed inset-0
        bg-ink-primary/40 backdrop-blur-sm
        flex items-center justify-center
        z-50
      "
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div className="
        bg-surface
        rounded-xl
        p-6
        w-full max-w-md
        shadow-2xl
        border border-ink-faint
      ">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-quill-light rounded-lg">
            <Sparkles className="w-5 h-5 text-quill" />
          </div>
          <h2
            id="cursor-prompt-title"
            className="font-display text-lg font-bold text-ink-primary"
          >
            Generate Content
          </h2>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isStreaming && handleGenerate()}
          placeholder="What would you like to write?"
          disabled={isLoading || isPreview}
          className="
            w-full
            px-4 py-3
            font-ui text-base
            text-ink-primary
            placeholder:text-ink-subtle
            bg-surface
            border border-ink-faint
            rounded-lg
            focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill
            disabled:opacity-50 disabled:cursor-not-allowed
            mb-4
          "
        />

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 py-3 px-4 bg-surface-muted rounded-lg mb-4">
            <Loader2 className="w-4 h-4 text-quill animate-spin" />
            <span className="font-ui text-sm text-ink-tertiary">Generating response...</span>
          </div>
        )}

        {/* Preview panel */}
        {content && (
          <div
            data-testid="preview-panel"
            aria-live="polite"
            className="
              p-4
              bg-surface-muted
              border border-ink-faint
              rounded-lg
              mb-4
              max-h-48 overflow-y-auto
              font-prose text-base text-ink-primary
              leading-relaxed
            "
          >
            {content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-quill animate-pulse ml-0.5" />
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="
              inline-flex items-center gap-2
              px-4 py-2.5
              font-ui text-sm font-medium
              bg-surface hover:bg-surface-hover active:bg-surface-active
              text-ink-primary
              border border-ink-faint
              rounded-lg
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          {!isPreview ? (
            <button
              onClick={handleGenerate}
              disabled={isStreaming || !prompt.trim()}
              className="
                inline-flex items-center gap-2
                px-4 py-2.5
                font-ui text-sm font-semibold
                bg-quill hover:bg-quill-dark active:bg-quill-darker
                text-white
                rounded-lg
                shadow-sm
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isStreaming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleAccept}
              className="
                inline-flex items-center gap-2
                px-4 py-2.5
                font-ui text-sm font-semibold
                bg-quill hover:bg-quill-dark active:bg-quill-darker
                text-white
                rounded-lg
                shadow-sm
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
            >
              <Check className="w-4 h-4" />
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Key Design System Compliance:**

- Modal backdrop uses `bg-ink-primary/40 backdrop-blur-sm` for subtle overlay
- Card uses `bg-surface rounded-xl shadow-2xl border border-ink-faint`
- Header icon uses `bg-quill-light` with `text-quill` icon
- Title uses `font-display` (Libre Baskerville)
- Input uses `font-ui` with design system border/focus tokens
- Preview uses `font-prose` for consistent reading experience
- Buttons follow primary/secondary patterns with `bg-quill` / `bg-surface`
- All focus states use `focus:ring-2 focus:ring-quill focus:ring-offset-2`
- Streaming cursor uses `bg-quill animate-pulse`

### Step 4: Verify integration

```bash
npm test
npm run build
npm run dev
```

Test manually:

1. Select text in editor - toolbar should appear
2. Click Refine - should stream response
3. Accept - should replace text
4. Press Cmd+K - should open cursor prompt
5. Enter prompt and generate - should stream
6. Accept - should insert at cursor

### Step 5: Commit

```bash
git add src/components/editor/DocumentEditor.tsx src/components/editor/CursorPrompt.tsx src/components/editor/extensions/selection-tracker.ts
git commit -m "feat(editor): integrate AI toolbar and cursor prompt"
```

### E2E Regression Verification

Before completing this task, run the full E2E test suite to ensure the integration doesn't break existing functionality.

**Phase 1 Editor Regression Tests:**

```bash
# Run ALL existing Phase 1 editor E2E tests
npx playwright test e2e/editor/*.spec.ts

# Expected: All tests pass
# Verifies the AI integration doesn't break:
# - Basic text editing
# - Formatting toolbar
# - Save/load functionality
# - Document operations
```

**Phase 3 AI E2E Tests:**

```bash
# Run ALL Phase 3 AI E2E tests
npx playwright test e2e/ai/

# Expected test files:
# - e2e/ai/ai-api.spec.ts (API error responses)
# - e2e/ai/ai-toolbar-basic.spec.ts (basic toolbar tests)
# - e2e/ai/ai-selection-toolbar.spec.ts (full toolbar tests)
# - e2e/ai/ai-cursor-generation.spec.ts (Cmd+K tests)
# - e2e/ai/ai-error-states.spec.ts (error UI tests)
# - e2e/ai/ai-reject-undo.spec.ts (reject/undo flows)
```

**Full Integration Test:**

```bash
# Run complete E2E suite to verify no regressions
npm run test:e2e

# All tests must pass before this task is complete
```

### End-to-End User Journey Test

Create `e2e/ai/ai-user-journey.spec.ts` to verify the complete user flow:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { AIToolbarPage } from '../pages/AIToolbarPage';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

test.describe('AI Complete User Journey', () => {
  test('complete selection toolbar workflow: select -> refine -> accept -> verify', async ({
    page,
    workerCtx,
    loginAsWorker,
  }) => {
    await loginAsWorker();
    const aiPage = new AIToolbarPage(page);

    // Mock AI endpoint
    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Refined and improved text with better clarity."}\n\ndata: [DONE]\n\n',
      });
    });

    // Navigate to a document
    await aiPage.goto('test-project', 'test-doc');

    // Type some content
    await aiPage.selectText('This is some rough draft text that needs improvement.');

    // Wait for toolbar to appear
    await aiPage.waitForToolbar();

    // Click Refine
    await aiPage.clickRefine();

    // Wait for streaming to complete
    await aiPage.waitForStreamingComplete();

    // Accept the changes
    await aiPage.accept();

    // Verify the content was replaced
    const content = await aiPage.getEditorContent();
    expect(content).toContain('Refined and improved');

    // Verify toolbar is hidden after accept
    await aiPage.expectToolbarHidden();
  });

  test('complete cursor prompt workflow: Cmd+K -> prompt -> generate -> accept -> verify', async ({
    page,
    workerCtx,
    loginAsWorker,
  }) => {
    await loginAsWorker();

    // Mock AI endpoint
    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI generated paragraph with meaningful content."}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Introduction: ');

    // Open cursor prompt with Cmd+K
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible(VISIBILITY_WAIT);

    // Enter prompt
    await modal.getByRole('textbox').fill('Write a transition paragraph');

    // Generate
    await modal.getByRole('button', { name: /generate/i }).click();

    // Wait for preview
    await page.waitForSelector('[data-testid="preview-panel"]', { timeout: 10000 });

    // Accept
    await modal.getByRole('button', { name: /accept/i }).click();

    // Verify content was inserted
    const content = await editor.textContent();
    expect(content).toContain('Introduction: ');
    expect(content).toContain('AI generated paragraph');

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test('reject flow preserves original content', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const aiPage = new AIToolbarPage(page);

    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Unwanted replacement text"}\n\ndata: [DONE]\n\n',
      });
    });

    await aiPage.goto('test-project', 'test-doc');

    const originalText = 'Original content that should be preserved';
    await aiPage.selectText(originalText);
    await aiPage.waitForToolbar();
    await aiPage.clickRefine();
    await aiPage.waitForStreamingComplete();

    // Reject instead of accept
    await aiPage.reject();

    // Verify original content is preserved
    const content = await aiPage.getEditorContent();
    expect(content).toContain(originalText);
    expect(content).not.toContain('Unwanted replacement');
  });

  test('undo restores previous state after accept', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const aiPage = new AIToolbarPage(page);

    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI replacement"}\n\ndata: [DONE]\n\n',
      });
    });

    await aiPage.goto('test-project', 'test-doc');

    const originalText = 'Text before AI modification';
    await aiPage.selectText(originalText);
    await aiPage.waitForToolbar();
    await aiPage.clickRefine();
    await aiPage.waitForStreamingComplete();
    await aiPage.accept();

    // Verify AI text is there
    let content = await aiPage.getEditorContent();
    expect(content).toContain('AI replacement');

    // Undo
    await page.keyboard.press('Control+z');

    // Verify original is restored
    content = await aiPage.getEditorContent();
    expect(content).toContain(originalText);
  });
});
```

### E2E Verification Checklist

- [ ] All `e2e/editor/*.spec.ts` tests pass (Phase 1 regression)
- [ ] All `e2e/ai/*.spec.ts` tests pass (Phase 3 AI tests)
- [ ] `e2e/ai/ai-user-journey.spec.ts` exists with complete workflow tests
- [ ] Full E2E suite passes: `npm run test:e2e`
- [ ] No flaky tests introduced
- [ ] Test execution time is reasonable (<5 minutes for AI tests)

---

## Verification Checklist

- [ ] `useEditorSelection` hook added to selection-tracker.ts
- [ ] DocumentEditor imports and uses SelectionTracker
- [ ] SelectionToolbar renders when text is selected
- [ ] CursorPrompt renders and responds to Cmd+K
- [ ] All unit tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing confirms functionality
- [ ] **E2E Phase 1 regression tests pass**: `npm run test:e2e e2e/editor/`
- [ ] **E2E Phase 3 AI tests pass**: `npm run test:e2e e2e/ai/`
- [ ] **User journey tests pass**: `npm run test:e2e e2e/ai/ai-user-journey.spec.ts`
- [ ] **Full E2E suite passes**: `npm run test:e2e`
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[99-verification.md](./99-verification.md)** to verify the complete phase.
