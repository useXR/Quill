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

### Step 3: Implement SelectionToolbar

Create `src/components/editor/SelectionToolbar.tsx`:

```typescript
// src/components/editor/SelectionToolbar.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
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
  { id: 'refine', label: 'Refine', description: 'Improve clarity and flow' },
  { id: 'extend', label: 'Extend', description: 'Add more detail' },
  { id: 'shorten', label: 'Shorten', description: 'Make more concise' },
  { id: 'simplify', label: 'Simplify', description: 'Use simpler language' },
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
    top: (selection.rect?.top ?? 0) - 48,
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting actions"
      aria-orientation="horizontal"
      aria-busy={isLoading}
      style={style}
      className="flex gap-1 bg-white shadow-lg rounded-lg p-2 border"
    >
      {!isPreview && ACTIONS.map((action, index) => (
        <button
          key={action.id}
          data-action={action.id}
          onClick={() => handleAction(action.id)}
          disabled={isLoading}
          tabIndex={index === focusedIndex ? 0 : -1}
          aria-describedby={`${action.id}-desc`}
          className="px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {action.label}
          <span id={`${action.id}-desc`} className="sr-only">
            {action.description}
          </span>
        </button>
      ))}

      {isPreview && (
        <>
          <button
            onClick={handleAccept}
            className="px-3 py-1 bg-green-500 text-white rounded"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="px-3 py-1 bg-gray-200 rounded"
          >
            Reject
          </button>
        </>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {isLoading && 'Generating AI response...'}
        {isPreview && `Preview ready: ${content.slice(0, 50)}...`}
        {error && `Error: ${error.message}`}
      </div>
    </div>
  );
}
```

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

---

## Verification Checklist

- [ ] `src/components/editor/SelectionToolbar.tsx` exists
- [ ] `src/components/editor/__tests__/SelectionToolbar.test.tsx` exists
- [ ] Tests pass: `npm test src/components/editor/__tests__/SelectionToolbar.test.tsx`
- [ ] Toolbar has `role="toolbar"` with `aria-label`
- [ ] Arrow key navigation works
- [ ] Escape closes toolbar
- [ ] Loading state announced via live region
- [ ] Buttons have accessible names with descriptions
- [ ] Accept/Reject buttons appear in preview mode
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.14: E2E Tests](./14-e2e-tests.md)**.
