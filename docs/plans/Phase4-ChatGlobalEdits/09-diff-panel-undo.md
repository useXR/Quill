# Task 4.9: DiffPanel & AI Undo

> **Phase 4** | [← ChatSidebar](./08-chat-sidebar.md) | [Next: Integration →](./10-integration.md)

---

## Context

**This task creates the DiffPanel component for reviewing changes and AI undo functionality.** Users can accept/reject individual changes and restore previous document states.

### Design System Reference

The DiffPanel and AIUndoButton follow the **Scholarly Craft** aesthetic from `docs/design-system.md`:

| Element           | Design Tokens                                                |
| ----------------- | ------------------------------------------------------------ |
| Modal Backdrop    | `bg-overlay` (50% opacity overlay)                           |
| Panel Container   | `bg-surface`, `shadow-xl`, `rounded-xl`                      |
| Header            | `border-b border-ink-faint`, `font-display` for title        |
| Progress Bar      | `bg-bg-secondary`, `text-ink-secondary`                      |
| Accept All Button | `bg-success`, `hover:bg-success-dark`, `text-white`          |
| Reject All Button | `border-ink-faint`, `hover:bg-surface-hover`                 |
| Added Changes     | `bg-success-light`, `border-success/20`, `text-success-dark` |
| Removed Changes   | `bg-error-light`, `border-error/20`, `text-error-dark`       |
| Apply Button      | `bg-quill`, `hover:bg-quill-dark`, `text-white`              |
| Undo Button       | `border-ink-faint`, `hover:bg-surface-hover`                 |
| History Panel     | `bg-surface`, `shadow-lg`, `border-ink-faint`                |

### Prerequisites

- **Task 4.7** completed (Database indexes)
- **Task 4.4** completed (Diff utilities)

### What This Task Creates

- `src/components/editor/DiffPanel.tsx` - Diff review component
- `src/components/editor/__tests__/DiffPanel.test.tsx` - Tests
- `src/hooks/useAIUndo.ts` - Undo hook
- `src/components/editor/AIUndoButton.tsx` - Undo UI

### Tasks That Depend on This

- **Task 4.10** (Integration) - Uses DiffPanel and AI undo

### Parallel Tasks

This task can be done in parallel with:

- **Task 4.8** (ChatSidebar)

---

## Files to Create/Modify

- `src/components/editor/DiffPanel.tsx` (create)
- `src/components/editor/__tests__/DiffPanel.test.tsx` (create)
- `src/hooks/useAIUndo.ts` (create)
- `src/components/editor/AIUndoButton.tsx` (create)

---

## Task 25: DiffPanel Component

### Step 1: Write failing test

Create `src/components/editor/__tests__/DiffPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffPanel } from '../DiffPanel';

describe('DiffPanel', () => {
  const baseProps = {
    changes: [
      { type: 'remove' as const, value: 'Old text', lineNumber: 1 },
      { type: 'add' as const, value: 'New text', lineNumber: 1 },
    ],
    acceptedIndexes: new Set<number>(),
    rejectedIndexes: new Set<number>(),
    onAcceptChange: vi.fn(),
    onRejectChange: vi.fn(),
    onAcceptAll: vi.fn(),
    onRejectAll: vi.fn(),
    onApply: vi.fn(),
    onClose: vi.fn(),
  };

  it('should render diff panel with changes', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
    expect(screen.getByText('Review Changes')).toBeInTheDocument();
  });

  it('should call onAcceptAll when Accept All clicked', () => {
    render(<DiffPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('diff-accept-all'));
    expect(baseProps.onAcceptAll).toHaveBeenCalled();
  });

  it('should call onRejectAll when Reject All clicked', () => {
    render(<DiffPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('diff-reject-all'));
    expect(baseProps.onRejectAll).toHaveBeenCalled();
  });

  it('should show stats', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.getByText(/1 additions/)).toBeInTheDocument();
    expect(screen.getByText(/1 deletions/)).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/editor/__tests__/DiffPanel.test.tsx
```

**Expected:** FAIL - module not found

### Step 3: Write DiffPanel component

Create `src/components/editor/DiffPanel.tsx`:

```typescript
'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { DiffChange, getDiffStats } from '@/lib/ai/diff-generator';

interface DiffPanelProps {
  changes: DiffChange[];
  acceptedIndexes: Set<number>;
  rejectedIndexes: Set<number>;
  onAcceptChange: (index: number) => void;
  onRejectChange: (index: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * DiffPanel Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Modal: bg-overlay backdrop, bg-surface panel, shadow-xl, rounded-xl
 * - Accept/Reject: success/error semantic color variants
 * - Typography: font-display for title, font-ui for content
 * - Buttons: Primary/Secondary patterns with 44x44px touch targets
 */
export function DiffPanel({
  changes,
  acceptedIndexes,
  rejectedIndexes,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onApply,
  onClose,
}: DiffPanelProps) {
  const stats = useMemo(() => getDiffStats(changes), [changes]);
  const modifiedChanges = useMemo(() => changes.filter(c => c.type !== 'unchanged'), [changes]);
  const allDecided = modifiedChanges.every((_, i) => {
    const idx = changes.findIndex(c => c === modifiedChanges[i]);
    return acceptedIndexes.has(idx) || rejectedIndexes.has(idx);
  });

  return (
    <div
      className="fixed inset-0 bg-overlay flex items-center justify-center z-50"
      data-testid="diff-panel"
    >
      <div className="
        bg-surface rounded-xl shadow-xl
        w-full max-w-4xl max-h-[80vh]
        flex flex-col
      ">
        {/* Header - scholarly style with display font */}
        <div className="p-4 border-b border-ink-faint flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-ink-primary">
              Review Changes
            </h3>
            <p className="font-ui text-sm text-ink-secondary">
              {stats.additions} additions, {stats.deletions} deletions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Reject All - Secondary button */}
            <button
              onClick={onRejectAll}
              className="
                px-4 py-2 min-h-[44px]
                font-ui text-sm font-semibold text-ink-primary
                bg-surface hover:bg-surface-hover
                border border-ink-faint rounded-md
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
              data-testid="diff-reject-all"
            >
              Reject All
            </button>
            {/* Accept All - Success button */}
            <button
              onClick={onAcceptAll}
              className="
                px-4 py-2 min-h-[44px]
                font-ui text-sm font-semibold text-white
                bg-success hover:bg-success-dark
                rounded-md shadow-sm
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2
              "
              data-testid="diff-accept-all"
            >
              Accept All
            </button>
            {/* Close button - Icon only */}
            <button
              onClick={onClose}
              className="
                p-3 min-w-[44px] min-h-[44px]
                text-ink-tertiary hover:text-ink-primary
                hover:bg-surface-hover
                rounded-md
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
              data-testid="diff-close"
              aria-label="Close diff panel"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Progress bar - subtle background */}
        <div
          className="px-4 py-2 bg-bg-secondary border-b border-ink-faint"
          data-testid="diff-progress"
        >
          <span className="font-ui text-sm text-ink-secondary">
            {acceptedIndexes.size} / {modifiedChanges.length} changes reviewed
          </span>
        </div>

        {/* Changes list - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {changes.map((change, index) => {
            if (change.type === 'unchanged') return null;
            const isAccepted = acceptedIndexes.has(index);
            const isRejected = rejectedIndexes.has(index);

            // Change card styling based on state
            const cardStyles = isAccepted
              ? 'border-success/30 bg-success-light'
              : isRejected
                ? 'border-error/30 bg-error-light'
                : 'border-ink-faint bg-surface';

            return (
              <div
                key={index}
                className={`border rounded-lg p-3 ${cardStyles}`}
                data-testid="diff-change"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Change type badge */}
                    <span className={`
                      inline-block px-2 py-0.5
                      font-ui text-xs font-medium rounded
                      ${change.type === 'add'
                        ? 'bg-success-light text-success-dark'
                        : 'bg-error-light text-error-dark'
                      }
                    `}>
                      {change.type === 'add' ? '+ Added' : '- Removed'}
                    </span>
                    {/* Change content */}
                    <pre className="mt-2 font-mono text-sm text-ink-secondary whitespace-pre-wrap">
                      {change.value}
                    </pre>
                  </div>
                  {/* Accept/Reject buttons with proper touch targets */}
                  <div className="flex gap-1 ml-3">
                    <button
                      onClick={() => onAcceptChange(index)}
                      className={`
                        p-3 min-w-[44px] min-h-[44px]
                        rounded-md
                        transition-all duration-150
                        focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2
                        ${isAccepted
                          ? 'bg-success text-white'
                          : 'text-success hover:bg-success-light'
                        }
                      `}
                      data-testid="accept-change"
                      aria-label="Accept this change"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => onRejectChange(index)}
                      className={`
                        p-3 min-w-[44px] min-h-[44px]
                        rounded-md
                        transition-all duration-150
                        focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2
                        ${isRejected
                          ? 'bg-error text-white'
                          : 'text-error hover:bg-error-light'
                        }
                      `}
                      data-testid="reject-change"
                      aria-label="Reject this change"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Apply footer - shown when all changes are decided */}
        {allDecided && (
          <div className="p-4 border-t border-ink-faint bg-bg-secondary">
            <button
              onClick={onApply}
              className="
                w-full py-3
                font-ui text-sm font-semibold text-white
                bg-quill hover:bg-quill-dark active:bg-quill-darker
                rounded-lg shadow-sm
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
              "
            >
              Apply {acceptedIndexes.size} Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/editor/__tests__/DiffPanel.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/editor/DiffPanel.tsx src/components/editor/__tests__/DiffPanel.test.tsx
git commit -m "feat: add DiffPanel component for reviewing changes"
```

---

## Task 26: useAIUndo Hook and AIUndoButton Component

### Step 1: Create useAIUndo hook

Create `src/hooks/useAIUndo.ts`:

```typescript
import { useCallback, useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';

interface AIOperation {
  id: string;
  operation_type: string;
  input_summary: string;
  snapshot_before: { content: string };
  status: string;
  created_at: string;
}

export function useAIUndo(editor: Editor | null, documentId: string) {
  const [operations, setOperations] = useState<AIOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadOperations = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ai/operations?documentId=${documentId}&limit=10`);
      if (response.ok) setOperations(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  const undoOperation = useCallback(
    async (operationId?: string) => {
      if (!editor) return;
      const targetOp = operationId ? operations.find((op) => op.id === operationId) : operations[0];
      if (!targetOp?.snapshot_before) return;

      editor.commands.setContent(targetOp.snapshot_before.content);
      await fetch(`/api/ai/operations/${targetOp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      await loadOperations();
    },
    [editor, operations, loadOperations]
  );

  return {
    operations,
    isLoading,
    undoOperation,
    canUndo: operations.length > 0,
    lastOperation: operations[0],
    undoCount: operations.length,
  };
}
```

### Step 2: Create AIUndoButton component

Create `src/components/editor/AIUndoButton.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Undo2, ChevronDown, History } from 'lucide-react';

interface AIOperation {
  id: string;
  input_summary: string;
  created_at: string;
}

interface AIUndoButtonProps {
  canUndo: boolean;
  undoCount: number;
  lastOperation?: AIOperation;
  onUndo: (operationId?: string) => void;
  operations: AIOperation[];
}

/**
 * AIUndoButton Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Button group: border-ink-faint, rounded-l-lg/rounded-r-lg
 * - Hover: bg-surface-hover
 * - Badge: bg-bg-tertiary, text-ink-secondary
 * - Dropdown: bg-surface, shadow-lg, border-ink-faint
 */
export function AIUndoButton({ canUndo, undoCount, lastOperation, onUndo, operations }: AIUndoButtonProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="relative">
      {/* Button group with split button pattern */}
      <div className="flex items-center">
        {/* Main undo button */}
        <button
          onClick={() => onUndo()}
          disabled={!canUndo}
          className="
            flex items-center gap-1.5
            px-3 py-2 min-h-[44px]
            font-ui text-sm font-medium text-ink-primary
            bg-surface hover:bg-surface-hover
            border border-ink-faint rounded-l-md
            transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          title={lastOperation ? `Undo: ${lastOperation.input_summary}` : 'No AI operations to undo'}
          data-testid="ai-undo-button"
        >
          <Undo2 size={16} />
          <span>Undo AI</span>
          {/* Count badge */}
          {undoCount > 0 && (
            <span
              className="
                px-1.5 py-0.5
                font-ui text-xs font-medium
                bg-bg-tertiary text-ink-secondary
                rounded-full
              "
              data-testid="undo-count"
            >
              {undoCount}
            </span>
          )}
        </button>
        {/* Dropdown toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          disabled={!canUndo}
          className="
            px-2 py-2 min-h-[44px]
            text-ink-secondary hover:text-ink-primary
            bg-surface hover:bg-surface-hover
            border-y border-r border-ink-faint rounded-r-md
            transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          data-testid="ai-history-toggle"
          aria-label="Show AI operation history"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* History dropdown panel */}
      {showHistory && operations.length > 0 && (
        <div
          className="
            absolute top-full right-0 mt-1
            w-80
            bg-surface
            border border-ink-faint rounded-lg
            shadow-lg
            z-50
          "
          data-testid="ai-history-panel"
        >
          {/* Panel header */}
          <div className="p-3 border-b border-ink-faint">
            <h4 className="
              flex items-center gap-2
              font-display font-semibold text-sm text-ink-primary
            ">
              <History size={14} />
              AI Operation History
            </h4>
          </div>
          {/* Operation list */}
          <div className="max-h-64 overflow-y-auto" data-testid="ai-snapshot-list">
            {operations.map((op) => (
              <div
                key={op.id}
                className="
                  p-3
                  border-b border-ink-faint last:border-b-0
                  hover:bg-surface-hover
                  transition-colors duration-150
                "
                data-testid="ai-snapshot"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-sm font-medium text-ink-primary truncate">
                      {op.input_summary}
                    </p>
                    <p className="font-ui text-xs text-ink-tertiary">
                      {new Date(op.created_at).toLocaleString()}
                    </p>
                  </div>
                  {/* Restore button - uses quill accent */}
                  <button
                    onClick={() => { onUndo(op.id); setShowHistory(false); }}
                    className="
                      px-2.5 py-1
                      font-ui text-xs font-medium
                      bg-quill-lighter text-quill
                      hover:bg-quill-light
                      rounded-md
                      transition-colors duration-150
                      focus:outline-none focus:ring-2 focus:ring-quill
                    "
                    data-testid="restore-snapshot"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Commit

```bash
git add src/hooks/useAIUndo.ts src/components/editor/AIUndoButton.tsx
git commit -m "feat: add AI undo functionality with history panel"
```

---

## E2E Tests

### CRITICAL: Required E2E Test File: `e2e/diff/diff-editor-integration.spec.ts`

**This is a CRITICAL integration test** that verifies editor content actually changes after accept/reject operations:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Diff + Editor Integration', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('CRITICAL: accepting changes updates actual editor content', async ({ page, workerCtx }) => {
    // Setup: Navigate to editor and add initial content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original document content that will be changed.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock response for global edit
    claudeMock.registerResponse('make formal', {
      content: 'The original document content has been formally revised.',
    });

    // Request global edit
    await chatPage.open();
    await chatPage.sendMessage('Make this more formal and academic');
    await chatPage.waitForStreamingComplete();

    // Wait for diff panel
    await diffPage.waitForPanelVisible();

    // Accept all changes
    await diffPage.acceptAll();

    // CRITICAL VERIFICATION: Editor content should have actually changed
    const newContent = await editor.textContent();
    expect(newContent).not.toBe(originalContent);
    expect(newContent).toContain('formally revised');
  });

  test('CRITICAL: rejecting changes preserves original editor content', async ({ page, workerCtx }) => {
    // Setup: Navigate to editor and add initial content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('This content should remain unchanged.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock response for global edit
    claudeMock.registerResponse('change', {
      content: 'Completely different content.',
    });

    // Request global edit
    await chatPage.open();
    await chatPage.sendMessage('Change everything');
    await chatPage.waitForStreamingComplete();

    // Wait for diff panel
    await diffPage.waitForPanelVisible();

    // Reject all changes
    await diffPage.rejectAll();

    // CRITICAL VERIFICATION: Editor content should remain unchanged
    const finalContent = await editor.textContent();
    expect(finalContent).toBe(originalContent);
  });

  test('CRITICAL: undo restores original editor content', async ({ page, workerCtx }) => {
    // Setup: Navigate to editor and add initial content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Content before AI edit.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock response for global edit
    claudeMock.registerResponse('edit', {
      content: 'Content after AI edit.',
    });

    // Apply a global edit
    await chatPage.open();
    await chatPage.sendMessage('Edit this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();

    // Verify content changed
    expect(await editor.textContent()).not.toBe(originalContent);

    // CRITICAL: Click undo
    await diffPage.undo();

    // CRITICAL VERIFICATION: Editor should restore original content
    const restoredContent = await editor.textContent();
    expect(restoredContent).toBe(originalContent);
  });

  test('editor becomes disabled during diff review', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Test content');

    claudeMock.registerResponse('modify', { content: 'Modified test content' });

    await chatPage.open();
    await chatPage.sendMessage('Modify this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Editor should be disabled/non-editable during diff review
    const editorContainer = page.getByTestId('document-editor');
    await expect(editorContainer).toHaveAttribute('data-disabled', 'true');
    // Or check for opacity/pointer-events CSS
  });
});
```

### Additional E2E Tests

Add to `e2e/diff/diff-editor-integration.spec.ts`:

```typescript
test.describe('DiffPanel Keyboard Navigation', () => {
  test('Escape key closes diff panel without applying changes', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Setup mock response
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Modified"}\n\ndata: {"type":"done","operationId":"op-1","modifiedContent":"Modified","diff":[{"type":"add","value":"Modified","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    // Trigger global edit
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Panel should close
    await expect(page.getByTestId('diff-panel')).not.toBeVisible();

    // Content should remain unchanged
    expect(await editor.textContent()).toBe('Original content');
  });

  test('Tab navigates between accept/reject buttons', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Focus first accept button and tab through
    await page.getByTestId('accept-change').first().focus();
    await expect(page.getByTestId('accept-change').first()).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('reject-change').first()).toBeFocused();
  });
});

test.describe('AI Undo History Panel', () => {
  test('history panel shows operation timestamps', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock operations endpoint
    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: 'op-1', input_summary: 'Made formal', created_at: new Date().toISOString(), status: 'accepted' },
          {
            id: 'op-2',
            input_summary: 'Fixed grammar',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            status: 'accepted',
          },
        ]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Open history panel
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    // Verify operations are listed with timestamps
    const snapshots = page.getByTestId('ai-snapshot');
    await expect(snapshots).toHaveCount(2);
    await expect(snapshots.first()).toContainText('Made formal');
    await expect(snapshots.last()).toContainText('Fixed grammar');
  });

  test('clicking outside history panel closes it', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ id: 'op-1', input_summary: 'Test', created_at: new Date().toISOString() }]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    // Click outside
    await page.getByTestId('document-editor').click();

    await expect(page.getByTestId('ai-history-panel')).not.toBeVisible();
  });
});

test.describe('Partial Accept Scenario', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('CRITICAL: partial accept - accept change 1, reject change 2, verify only change 1 applied', async ({
    page,
    workerCtx,
  }) => {
    // Setup: Create document with identifiable content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('First paragraph stays lowercase.\n\nSecond paragraph also lowercase.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock that produces two distinct changes
    // Change 1: First paragraph -> uppercase
    // Change 2: Second paragraph -> uppercase
    await page.route('**/api/ai/global-edit', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: {"type":"done","operationId":"op-partial","modifiedContent":"FIRST PARAGRAPH STAYS LOWERCASE.\\n\\nSECOND PARAGRAPH ALSO LOWERCASE.","diff":[{"type":"remove","value":"First paragraph stays lowercase.","lineNumber":1},{"type":"add","value":"FIRST PARAGRAPH STAYS LOWERCASE.","lineNumber":1},{"type":"remove","value":"Second paragraph also lowercase.","lineNumber":3},{"type":"add","value":"SECOND PARAGRAPH ALSO LOWERCASE.","lineNumber":3}]}\n\n`,
      });
    });

    // Trigger global edit
    await chatPage.open();
    await chatPage.sendMessage('Make all text uppercase');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify we have multiple changes to work with
    const changeCards = page.getByTestId('diff-change');
    await expect(changeCards).toHaveCount(4); // 2 removes + 2 adds

    // Accept the first change (first paragraph uppercase)
    await diffPage.acceptChange(0); // remove old first paragraph
    await diffPage.acceptChange(1); // add new first paragraph

    // Reject the second change (keep second paragraph lowercase)
    await diffPage.rejectChange(2); // reject remove old second paragraph
    await diffPage.rejectChange(3); // reject add new second paragraph

    // Apply the partial changes
    await page.getByRole('button', { name: /apply/i }).click();
    await diffPage.waitForPanelHidden();

    // CRITICAL VERIFICATION
    const finalContent = await editor.textContent();

    // Change 1 was ACCEPTED - first paragraph should be uppercase
    expect(finalContent).toContain('FIRST PARAGRAPH');

    // Change 2 was REJECTED - second paragraph should remain lowercase
    expect(finalContent).toContain('Second paragraph also lowercase');
    expect(finalContent).not.toContain('SECOND PARAGRAPH');
  });

  test('partial accept preserves document structure', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('# Heading\n\nParagraph 1\n\nParagraph 2\n\nParagraph 3');

    // Mock that changes all paragraphs
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: {"type":"done","operationId":"op-struct","modifiedContent":"# Heading\\n\\nModified 1\\n\\nModified 2\\n\\nModified 3","diff":[{"type":"unchanged","value":"# Heading\\n\\n","lineNumber":1},{"type":"remove","value":"Paragraph 1","lineNumber":3},{"type":"add","value":"Modified 1","lineNumber":3},{"type":"remove","value":"Paragraph 2","lineNumber":5},{"type":"add","value":"Modified 2","lineNumber":5},{"type":"remove","value":"Paragraph 3","lineNumber":7},{"type":"add","value":"Modified 3","lineNumber":7}]}\n\n`,
      });
    });

    await chatPage.open();
    await chatPage.sendMessage('Modify all paragraphs');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Accept only middle change
    const changeCards = page.getByTestId('diff-change');
    const count = await changeCards.count();

    for (let i = 0; i < count; i++) {
      // Accept only changes related to Paragraph 2 / Modified 2
      const cardText = await changeCards.nth(i).textContent();
      if (cardText?.includes('Paragraph 2') || cardText?.includes('Modified 2')) {
        await diffPage.acceptChange(i);
      } else {
        await diffPage.rejectChange(i);
      }
    }

    await page.getByRole('button', { name: /apply/i }).click();
    await diffPage.waitForPanelHidden();

    // Verify structure preserved
    const finalContent = await editor.textContent();
    expect(finalContent).toContain('# Heading');
    expect(finalContent).toContain('Paragraph 1'); // rejected
    expect(finalContent).toContain('Modified 2'); // accepted
    expect(finalContent).toContain('Paragraph 3'); // rejected
  });
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/diff/diff-editor-integration.spec.ts
```

**Gate:** All tests must pass, especially the CRITICAL tests that verify actual content changes.

---

## Verification Checklist

- [ ] DiffPanel renders with changes
- [ ] Accept All / Reject All buttons work
- [ ] Individual accept/reject buttons work
- [ ] Progress counter updates correctly
- [ ] Apply button appears when all changes decided
- [ ] **Partial accept scenario works:** accept some changes, reject others, only accepted changes applied
- [ ] useAIUndo loads operations from API
- [ ] Undo restores previous content
- [ ] History panel shows operation list
- [ ] Restore from history works
- [ ] All unit tests pass
- [ ] **CRITICAL E2E tests pass:** `npm run test:e2e e2e/diff/diff-editor-integration.spec.ts`
- [ ] Changes committed (2 commits for Tasks 25-26)

---

## Next Steps

After this task, proceed to **[Task 4.10: Integration](./10-integration.md)**.
