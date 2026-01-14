# Task 3.13: Selection Toolbar with Accessibility

> **Phase 3** | [← Selection Tracker](./12-selection-tracker.md) | [Next: E2E Tests →](./14-e2e-tests.md)

---

## Context

**This task creates the accessible selection toolbar component for AI text operations.** This floating toolbar appears when text is selected and provides Refine/Extend/Shorten/Simplify actions with full keyboard navigation and screen reader support.

### Prerequisites

- **Task 3.8** completed (AI State Store) - provides state management
- **Task 3.9** completed (useAIStream Hook) - provides streaming functionality
- **Task 3.12** completed (Selection Tracker) - provides selection state

### What This Task Creates

- `src/components/editor/SelectionToolbar.tsx` - Accessible toolbar component
- `src/components/editor/__tests__/SelectionToolbar.test.tsx` - Component tests

### Tasks That Depend on This

- **Task 3.14** (E2E Tests) - tests this component
- **Task 3.15** (Editor Integration) - uses this component

### Design System Requirements

The Selection Toolbar is a core UI component and **MUST** strictly follow the [Quill Design System](../../design-system.md) "Scholarly Craft" aesthetic:

#### Visual Design Specifications

| Element            | Design Token                                              | Value                                    |
| ------------------ | --------------------------------------------------------- | ---------------------------------------- |
| **Container**      | `bg-surface shadow-lg rounded-lg border border-ink-faint` | White surface, elevated with warm shadow |
| **Padding**        | `p-2`                                                     | 8px internal padding                     |
| **Button spacing** | `gap-1`                                                   | 4px between buttons                      |
| **Button style**   | Ghost button pattern                                      | `bg-transparent hover:bg-surface-hover`  |
| **Active button**  | Brand accent                                              | `bg-quill-light text-quill`              |
| **Typography**     | `font-ui text-sm font-medium`                             | Source Sans 3, 14px, medium weight       |
| **Icons**          | `w-4 h-4`                                                 | 16px Lucide icons                        |
| **Focus ring**     | `focus:ring-2 focus:ring-quill focus:ring-offset-2`       | Quill brand focus indicator              |

#### Color Palette (from @theme)

- Background: `--color-surface` (#ffffff)
- Text: `--color-ink-tertiary` (#78716c) default, `--color-ink-primary` (#1c1917) on hover
- Active: `--color-quill-light` (#ede9fe) bg, `--color-quill` (#7c3aed) text
- Accept button: `--color-success` (#166534)
- Reject button: `--color-surface-hover` (#f9f8f7)

---

## Files to Create/Modify

- `src/components/editor/SelectionToolbar.tsx` (create)
- `src/components/editor/__tests__/SelectionToolbar.test.tsx` (create)

---

## Steps

### Step 1: Write the failing test with accessibility checks

**Note:** Per Phase 1 best practices, use the established TipTap mock utility from `@/test-utils/tiptap-mock.ts` instead of inline mocks.

```typescript
// src/components/editor/__tests__/SelectionToolbar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionToolbar } from '../SelectionToolbar';
import { useAIStore } from '@/lib/stores/ai-store';
import { createMockEditor } from '@/test-utils/tiptap-mock';
import { createMockAIOperation } from '@/test-utils/factories';

vi.mock('@/lib/stores/ai-store');
vi.mock('@/hooks/useAIStream', () => ({
  useAIStream: () => ({
    startStream: vi.fn(),
    cancel: vi.fn(),
    content: '',
    isStreaming: false,
    error: null,
  }),
}));

// Use established TipTap mock from Phase 1 instead of inline mock
const mockEditor = createMockEditor();

const mockSelection = {
  from: 0,
  to: 10,
  text: 'Test text',
  rect: new DOMRect(100, 100, 50, 20),
};

describe('SelectionToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock editor state
    mockEditor.getHTML.mockReturnValue('<p>Test</p>');

    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: null,
      startOperation: vi.fn().mockReturnValue('op-1'),
      appendOutput: vi.fn(),
      setOutput: vi.fn(),
      setStatus: vi.fn(),
      setError: vi.fn(),
      acceptOperation: vi.fn(),
      rejectOperation: vi.fn(),
    } as any);
  });

  it('should have proper ARIA attributes', () => {
    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Text formatting actions');
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('should support keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const refineBtn = screen.getByRole('button', { name: /refine/i });
    refineBtn.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /extend/i })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(refineBtn).toHaveFocus();
  });

  it('should close on Escape key', async () => {
    const rejectOperation = vi.fn();
    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: null,
      rejectOperation,
    } as any);

    const user = userEvent.setup();

    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    await user.keyboard('{Escape}');
    expect(rejectOperation).toHaveBeenCalled();
  });

  it('should announce loading state to screen readers', () => {
    // Use factory to create mock operation with loading status
    const loadingOperation = createMockAIOperation({ status: 'loading' });

    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: loadingOperation,
    } as any);

    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/generating/i);
  });

  it('buttons should have accessible names with descriptions', () => {
    render(
      <SelectionToolbar
        editor={mockEditor as any}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const refineBtn = screen.getByRole('button', { name: /refine.*improve clarity/i });
    expect(refineBtn).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/editor/__tests__/SelectionToolbar.test.tsx
```

**Expected:** FAIL (module not found)

### Step 3: Implement SelectionToolbar with Design System

Create `src/components/editor/SelectionToolbar.tsx` following the [Quill Design System](../../design-system.md):

```typescript
// src/components/editor/SelectionToolbar.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { Sparkles, Expand, Shrink, Wand2, Check, X, Loader2 } from 'lucide-react';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';
import type { SelectionState } from './extensions/selection-tracker';

interface SelectionToolbarProps {
  editor: Editor;
  selection: SelectionState;
  projectId: string;
  documentId: string;
}

const ACTIONS = [
  { id: 'refine', label: 'Refine', description: 'Improve clarity and flow', icon: Sparkles },
  { id: 'extend', label: 'Extend', description: 'Add more detail', icon: Expand },
  { id: 'shorten', label: 'Shorten', description: 'Make more concise', icon: Shrink },
  { id: 'simplify', label: 'Simplify', description: 'Use simpler language', icon: Wand2 },
] as const;

export function SelectionToolbar({
  editor,
  selection,
  projectId,
  documentId,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const store = useAIStore();
  const { startStream, cancel, content, isStreaming, error } = useAIStream({
    onChunk: (chunk) => store.appendOutput(chunk),
    onComplete: () => store.setStatus('preview'),
    onError: (err) => store.setError(err),
  });

  const isLoading = store.currentOperation?.status === 'loading';
  const isPreview = store.currentOperation?.status === 'preview';

  const handleAction = useCallback(async (actionId: string) => {
    const snapshot = editor.getHTML();
    store.startOperation('selection', `${actionId}: ${selection.text}`, snapshot);

    const prompt = `${actionId} the following text: "${selection.text}"`;
    await startStream(prompt, documentId, projectId);
  }, [editor, selection, store, startStream, documentId, projectId]);

  const handleAccept = useCallback(() => {
    if (!store.currentOperation?.output) return;

    editor.chain()
      .focus()
      .setTextSelection({ from: selection.from, to: selection.to })
      .insertContent(store.currentOperation.output)
      .run();

    store.acceptOperation();
  }, [editor, selection, store]);

  const handleReject = useCallback(() => {
    cancel();
    store.rejectOperation();
  }, [cancel, store]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex((i) => (i + 1) % ACTIONS.length);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex((i) => (i - 1 + ACTIONS.length) % ACTIONS.length);
          break;
        case 'Escape':
          e.preventDefault();
          handleReject();
          break;
      }
    };

    const toolbar = toolbarRef.current;
    toolbar?.addEventListener('keydown', handleKeyDown);
    return () => toolbar?.removeEventListener('keydown', handleKeyDown);
  }, [handleReject]);

  // Focus management
  useEffect(() => {
    const buttons = toolbarRef.current?.querySelectorAll('button[data-action]');
    (buttons?.[focusedIndex] as HTMLButtonElement)?.focus();
  }, [focusedIndex]);

  const style = {
    position: 'absolute' as const,
    left: selection.rect?.left ?? 0,
    top: (selection.rect?.top ?? 0) - 56,
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting actions"
      aria-orientation="horizontal"
      aria-busy={isLoading}
      style={style}
      className="
        flex items-center gap-1
        bg-surface
        shadow-lg
        rounded-lg
        p-2
        border border-ink-faint
      "
    >
      {/* Loading indicator - design system spinner */}
      {isLoading && (
        <div className="flex items-center gap-2 px-2">
          <Loader2 className="w-4 h-4 text-quill animate-spin" />
          <span className="font-ui text-sm text-ink-tertiary">Generating...</span>
        </div>
      )}

      {/* Action buttons - design system ghost button style */}
      {!isPreview && !isLoading && ACTIONS.map((action, index) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            data-action={action.id}
            onClick={() => handleAction(action.id)}
            disabled={isLoading}
            tabIndex={index === focusedIndex ? 0 : -1}
            aria-describedby={`${action.id}-desc`}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5
              font-ui text-sm font-medium
              text-ink-tertiary
              hover:text-ink-primary hover:bg-surface-hover
              active:bg-surface-active
              rounded-md
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {action.label}
            <span id={`${action.id}-desc`} className="sr-only">
              {action.description}
            </span>
          </button>
        );
      })}

      {/* Accept/Reject buttons - design system primary/secondary buttons */}
      {isPreview && (
        <>
          <button
            onClick={handleAccept}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5
              font-ui text-sm font-semibold
              bg-quill hover:bg-quill-dark active:bg-quill-darker
              text-white
              rounded-md
              shadow-sm
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            Accept
          </button>
          <button
            onClick={handleReject}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5
              font-ui text-sm font-medium
              bg-surface hover:bg-surface-hover active:bg-surface-active
              text-ink-primary
              border border-ink-faint
              rounded-md
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
          >
            <X className="w-4 h-4" aria-hidden="true" />
            Reject
          </button>
        </>
      )}

      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading && 'Generating AI response...'}
        {isPreview && `Preview ready: ${content.slice(0, 50)}...`}
        {error && `Error: ${error.message}`}
      </div>
    </div>
  );
}
```

**Key Design System Compliance:**

- Uses `bg-surface` instead of generic `bg-white`
- Uses `shadow-lg` warm-tinted shadows from design system
- Uses `font-ui` (Source Sans 3) for all text
- Uses `text-ink-tertiary` / `text-ink-primary` for text colors
- Uses `bg-quill` / `bg-quill-dark` for primary action (Accept)
- Uses `rounded-md` consistent border radius
- Uses `focus:ring-2 focus:ring-quill focus:ring-offset-2` focus pattern
- Uses `transition-all duration-150` for fast, responsive interactions
- Uses Lucide icons at `w-4 h-4` (16px) size

### Step 4: Run test to verify it passes

```bash
npm test src/components/editor/__tests__/SelectionToolbar.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/editor/SelectionToolbar.tsx src/components/editor/__tests__/SelectionToolbar.test.tsx
git commit -m "feat(editor): add accessible selection toolbar with keyboard nav"
```

### E2E Tests

Create E2E tests for the selection toolbar to verify core functionality. These tests explicitly cover each action button (Extend, Shorten, Simplify, not just Refine) to ensure complete coverage.

Add to `e2e/ai/ai-toolbar-basic.spec.ts`:

```typescript
// e2e/ai/ai-toolbar-basic.spec.ts
import { test, expect } from '@playwright/test';
import { waitForFormReady } from '../helpers/hydration';
import { VISIBILITY_WAIT } from '../config/timeouts';

test.describe('Selection Toolbar - Basic', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AI endpoint to avoid actual API calls
    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Mock response"}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await waitForFormReady(page);
  });

  test('toolbar appears on text selection', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Select this text');

    // Select all text
    await page.keyboard.press('Control+a');

    // Toolbar should appear
    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);
  });

  test('all action buttons are visible', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Test content');
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Verify all action buttons are present
    await expect(toolbar.getByRole('button', { name: /refine/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /extend/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /shorten/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /simplify/i })).toBeVisible();
  });

  test('Escape closes toolbar', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Test');
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Toolbar should be hidden
    await expect(toolbar).not.toBeVisible();
  });
});

test.describe('Selection Toolbar - Individual Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/test-project/documents/test-doc');
    await waitForFormReady(page);
  });

  test('Extend button triggers AI generation with extend prompt', async ({ page }) => {
    let capturedRequest: { prompt?: string } = {};

    await page.route('/api/ai/generate', async (route) => {
      const postData = route.request().postDataJSON();
      capturedRequest = postData;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Extended content with more details and elaboration."}\n\ndata: [DONE]\n\n',
      });
    });

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Short text');
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Click Extend button specifically
    await toolbar.getByRole('button', { name: /extend/i }).click();

    // Verify loading state appears
    await expect(toolbar).toHaveAttribute('aria-busy', 'true');

    // Wait for Accept button
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await expect(acceptButton).toBeVisible({ timeout: 10000 });

    // Verify the request included "extend" action
    expect(capturedRequest.prompt).toMatch(/extend/i);
  });

  test('Shorten button triggers AI generation with shorten prompt', async ({ page }) => {
    let capturedRequest: { prompt?: string } = {};

    await page.route('/api/ai/generate', async (route) => {
      const postData = route.request().postDataJSON();
      capturedRequest = postData;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Concise version."}\n\ndata: [DONE]\n\n',
      });
    });

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially(
      'This is a very long sentence that could definitely be shortened to be more concise and easier to read.'
    );
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Click Shorten button specifically
    await toolbar.getByRole('button', { name: /shorten/i }).click();

    // Wait for Accept button
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await expect(acceptButton).toBeVisible({ timeout: 10000 });

    // Verify the request included "shorten" action
    expect(capturedRequest.prompt).toMatch(/shorten/i);
  });

  test('Simplify button triggers AI generation with simplify prompt', async ({ page }) => {
    let capturedRequest: { prompt?: string } = {};

    await page.route('/api/ai/generate', async (route) => {
      const postData = route.request().postDataJSON();
      capturedRequest = postData;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Simple explanation in plain words."}\n\ndata: [DONE]\n\n',
      });
    });

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially(
      'The epistemological ramifications of quantum entanglement necessitate a paradigm shift.'
    );
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Click Simplify button specifically
    await toolbar.getByRole('button', { name: /simplify/i }).click();

    // Wait for Accept button
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await expect(acceptButton).toBeVisible({ timeout: 10000 });

    // Verify the request included "simplify" action
    expect(capturedRequest.prompt).toMatch(/simplify/i);
  });

  test('Refine button triggers AI generation with refine prompt', async ({ page }) => {
    let capturedRequest: { prompt?: string } = {};

    await page.route('/api/ai/generate', async (route) => {
      const postData = route.request().postDataJSON();
      capturedRequest = postData;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Polished text with improved clarity and flow."}\n\ndata: [DONE]\n\n',
      });
    });

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Text that needs some polishing');
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Click Refine button specifically
    await toolbar.getByRole('button', { name: /refine/i }).click();

    // Wait for Accept button
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await expect(acceptButton).toBeVisible({ timeout: 10000 });

    // Verify the request included "refine" action
    expect(capturedRequest.prompt).toMatch(/refine/i);
  });

  test('each action button replaces text correctly when accepted', async ({ page }) => {
    const actions = [
      { name: /extend/i, response: 'Extended content here' },
      { name: /shorten/i, response: 'Shorter' },
      { name: /simplify/i, response: 'Simple words' },
      { name: /refine/i, response: 'Refined text' },
    ];

    for (const action of actions) {
      await page.route('/api/ai/generate', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: `data: {"content":"${action.response}"}\n\ndata: [DONE]\n\n`,
        });
      });

      // Clear editor and add new text
      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Backspace');
      await editor.pressSequentially('Original text');
      await page.keyboard.press('Control+a');

      const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
      await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

      // Click the action button
      await toolbar.getByRole('button', { name: action.name }).click();

      // Accept the change
      const acceptButton = page.getByRole('button', { name: /accept/i });
      await expect(acceptButton).toBeVisible({ timeout: 10000 });
      await acceptButton.click();

      // Verify the replacement
      await expect(editor).toContainText(action.response);
    }
  });
});

test.describe('Selection Toolbar - Multiple Sequential Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI modified text"}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await waitForFormReady(page);
  });

  test('can select text, accept AI change, then select new text for another operation', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');

    // First operation: type and select text
    await editor.click();
    await editor.pressSequentially('First sentence. Second sentence.');

    // Select just "First sentence."
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+Control+Right');
    await page.keyboard.press('Shift+Right'); // Include the period and space

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Click Refine and accept
    await toolbar.getByRole('button', { name: /refine/i }).click();
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await expect(acceptButton).toBeVisible({ timeout: 10000 });
    await acceptButton.click();

    // Toolbar should close after accepting
    await expect(toolbar).not.toBeVisible();

    // Second operation: select different text
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');

    // Toolbar should appear again for new selection
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Click Extend and accept second operation
    await toolbar.getByRole('button', { name: /extend/i }).click();
    await expect(acceptButton).toBeVisible({ timeout: 10000 });
    await acceptButton.click();

    // Verify both operations completed
    await expect(toolbar).not.toBeVisible();
  });

  test('can perform multiple AI operations without page reload', async ({ page }) => {
    let operationCount = 0;

    await page.route('/api/ai/generate', async (route) => {
      operationCount++;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: {"content":"Operation ${operationCount} result"}\n\ndata: [DONE]\n\n`,
      });
    });

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Test text');

    // Perform 3 sequential operations
    for (let i = 1; i <= 3; i++) {
      await page.keyboard.press('Control+a');

      const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
      await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

      await toolbar.getByRole('button', { name: /refine/i }).click();

      const acceptButton = page.getByRole('button', { name: /accept/i });
      await expect(acceptButton).toBeVisible({ timeout: 10000 });
      await acceptButton.click();

      await expect(toolbar).not.toBeVisible();
    }

    // Verify all 3 operations were made
    expect(operationCount).toBe(3);
    await expect(editor).toContainText('Operation 3 result');
  });

  test('can reject AI change and immediately start new operation', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Original content');
    await page.keyboard.press('Control+a');

    const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Start first operation
    await toolbar.getByRole('button', { name: /refine/i }).click();

    // Wait for preview and reject
    const rejectButton = page.getByRole('button', { name: /reject/i });
    await expect(rejectButton).toBeVisible({ timeout: 10000 });
    await rejectButton.click();

    // Toolbar should close
    await expect(toolbar).not.toBeVisible();

    // Original text should be preserved
    await expect(editor).toContainText('Original content');

    // Start second operation immediately
    await page.keyboard.press('Control+a');
    await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

    // Should be able to use any action button
    await toolbar.getByRole('button', { name: /extend/i }).click();
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await expect(acceptButton).toBeVisible({ timeout: 10000 });
  });
});
```

**Run these tests before proceeding:**

```bash
npx playwright test e2e/ai/ai-toolbar-basic.spec.ts
```

---

## Verification Checklist

### Unit Tests

- [ ] `src/components/editor/SelectionToolbar.tsx` exists
- [ ] `src/components/editor/__tests__/SelectionToolbar.test.tsx` exists
- [ ] Tests pass: `npm test src/components/editor/__tests__/SelectionToolbar.test.tsx`

### Accessibility

- [ ] Toolbar has `role="toolbar"` with `aria-label`
- [ ] Arrow key navigation works
- [ ] Escape closes toolbar
- [ ] Loading state announced via live region
- [ ] Buttons have accessible names with descriptions
- [ ] Accept/Reject buttons appear in preview mode

### E2E Tests - Basic

- [ ] E2E basic tests pass: `npx playwright test e2e/ai/ai-toolbar-basic.spec.ts`
- [ ] Toolbar appears on text selection
- [ ] All action buttons visible (Refine, Extend, Shorten, Simplify)
- [ ] Escape closes toolbar

### E2E Tests - Individual Action Buttons

- [ ] Extend button triggers AI generation with extend prompt
- [ ] Shorten button triggers AI generation with shorten prompt
- [ ] Simplify button triggers AI generation with simplify prompt
- [ ] Refine button triggers AI generation with refine prompt
- [ ] Each action button replaces text correctly when accepted

### E2E Tests - Multiple Sequential Operations

- [ ] Can select text, accept AI change, then select new text for another operation
- [ ] Can perform multiple AI operations without page reload
- [ ] Can reject AI change and immediately start new operation

### Commit

- [ ] Changes committed

---

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/ai/ai-toolbar-basic.spec.ts
```

**Gate:** All basic toolbar tests must pass before proceeding to Task 3.14.

---

## Next Steps

After this task, proceed to **[Task 3.14: E2E Tests](./14-e2e-tests.md)**.
