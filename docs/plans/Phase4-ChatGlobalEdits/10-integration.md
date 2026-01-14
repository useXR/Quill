# Task 4.10: Integration

> **Phase 4** | [← DiffPanel & AI Undo](./09-diff-panel-undo.md) | [Next: Tests →](./11-tests.md)

---

## Context

**This task creates the DocumentEditorContext and DiffPanelWrapper for coordinating editor state with diff review.** It connects all the chat and diff components into a cohesive editing experience.

### Design System Integration

The integration layer ensures consistent styling across coordinated components:

| Integration Point     | Design Tokens                             | Notes                         |
| --------------------- | ----------------------------------------- | ----------------------------- |
| Editor disabled state | `opacity-50`, `pointer-events-none`       | While diff panel is shown     |
| Diff panel modal      | `bg-overlay` backdrop, `bg-surface` panel | Z-index 50                    |
| Status updates        | Via DiffPanel `bg-success` / `bg-error`   | Accept/reject visual feedback |

**Scholarly Craft UX Principles:**

- Editor content becomes read-only during diff review (prevents confusion)
- Diff panel uses modal pattern to focus attention
- Operation status persists for undo functionality

### Prerequisites

- **Task 4.8** completed (ChatSidebar)
- **Task 4.9** completed (DiffPanel & AI Undo)

### What This Task Creates

- `src/contexts/DocumentEditorContext.tsx` - Editor coordination context
- `src/components/editor/DiffPanelWrapper.tsx` - Diff panel with state management

### Tasks That Depend on This

- **Task 4.11** (Tests) - Integration testing

---

## Files to Create/Modify

- `src/contexts/DocumentEditorContext.tsx` (create)
- `src/components/editor/DiffPanelWrapper.tsx` (create)

---

## Task 27: Integration - DocumentEditorContext and Page Layout

### Step 1: Create DocumentEditorContext

Create `src/contexts/DocumentEditorContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useRef, ReactNode, useCallback, useState } from 'react';
import { Editor } from '@tiptap/react';
import { DiffChange } from '@/lib/ai/diff-generator';

interface DiffState {
  isVisible: boolean;
  originalContent: string;
  modifiedContent: string;
  changes: DiffChange[];
  operationId: string | null;
}

interface DocumentEditorContextValue {
  editorRef: React.MutableRefObject<Editor | null>;
  documentId: string;
  projectId: string;
  diffState: DiffState;
  showDiff: (data: Omit<DiffState, 'isVisible'>) => void;
  hideDiff: () => void;
  applyContent: (content: string) => void;
  getContent: () => string;
}

const DocumentEditorContext = createContext<DocumentEditorContextValue | null>(null);

export function DocumentEditorProvider({ children, documentId, projectId }: { children: ReactNode; documentId: string; projectId: string }) {
  const editorRef = useRef<Editor | null>(null);
  const [diffState, setDiffState] = useState<DiffState>({
    isVisible: false,
    originalContent: '',
    modifiedContent: '',
    changes: [],
    operationId: null,
  });

  const showDiff = useCallback((data: Omit<DiffState, 'isVisible'>) => {
    setDiffState({ ...data, isVisible: true });
    editorRef.current?.setEditable(false);
  }, []);

  const hideDiff = useCallback(() => {
    setDiffState(prev => ({ ...prev, isVisible: false }));
    editorRef.current?.setEditable(true);
  }, []);

  const applyContent = useCallback((content: string) => {
    editorRef.current?.commands.setContent(content);
  }, []);

  const getContent = useCallback(() => editorRef.current?.getHTML() ?? '', []);

  return (
    <DocumentEditorContext value={{ editorRef, documentId, projectId, diffState, showDiff, hideDiff, applyContent, getContent }}>
      {children}
    </DocumentEditorContext>
  );
}

export function useDocumentEditor() {
  const context = useContext(DocumentEditorContext);
  if (!context) throw new Error('useDocumentEditor must be used within DocumentEditorProvider');
  return context;
}
```

### Step 2: Create DiffPanelWrapper

Create `src/components/editor/DiffPanelWrapper.tsx`:

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDocumentEditor } from '@/contexts/DocumentEditorContext';
import { DiffPanel } from './DiffPanel';
import { applyDiffChanges } from '@/lib/ai/diff-generator';

export function DiffPanelWrapper() {
  const { diffState, hideDiff, applyContent } = useDocumentEditor();
  const [acceptedIndexes, setAcceptedIndexes] = useState<Set<number>>(new Set());
  const [rejectedIndexes, setRejectedIndexes] = useState<Set<number>>(new Set());

  const handleAcceptChange = useCallback((index: number) => {
    setAcceptedIndexes(prev => new Set(prev).add(index));
    setRejectedIndexes(prev => { const n = new Set(prev); n.delete(index); return n; });
  }, []);

  const handleRejectChange = useCallback((index: number) => {
    setRejectedIndexes(prev => new Set(prev).add(index));
    setAcceptedIndexes(prev => { const n = new Set(prev); n.delete(index); return n; });
  }, []);

  const handleAcceptAll = useCallback(() => {
    const allIndexes = diffState.changes.map((_, i) => i).filter(i => diffState.changes[i].type !== 'unchanged');
    setAcceptedIndexes(new Set(allIndexes));
    setRejectedIndexes(new Set());
  }, [diffState.changes]);

  const handleRejectAll = useCallback(async () => {
    if (diffState.operationId) {
      await fetch(`/api/ai/operations/${diffState.operationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
    }
    setAcceptedIndexes(new Set());
    setRejectedIndexes(new Set());
    hideDiff();
  }, [diffState.operationId, hideDiff]);

  const handleApply = useCallback(async () => {
    const newContent = applyDiffChanges(diffState.originalContent, diffState.changes, Array.from(acceptedIndexes));
    applyContent(newContent);

    if (diffState.operationId) {
      const status = acceptedIndexes.size === diffState.changes.filter(c => c.type !== 'unchanged').length ? 'accepted' : 'partial';
      await fetch(`/api/ai/operations/${diffState.operationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, outputContent: newContent }),
      });
    }

    setAcceptedIndexes(new Set());
    setRejectedIndexes(new Set());
    hideDiff();
  }, [diffState, acceptedIndexes, applyContent, hideDiff]);

  if (!diffState.isVisible) return null;

  return (
    <DiffPanel
      changes={diffState.changes}
      acceptedIndexes={acceptedIndexes}
      rejectedIndexes={rejectedIndexes}
      onAcceptChange={handleAcceptChange}
      onRejectChange={handleRejectChange}
      onAcceptAll={handleAcceptAll}
      onRejectAll={handleRejectAll}
      onApply={handleApply}
      onClose={handleRejectAll}
    />
  );
}
```

### Step 3: Commit

```bash
git add src/contexts/DocumentEditorContext.tsx src/components/editor/DiffPanelWrapper.tsx
git commit -m "feat: add DocumentEditorContext and DiffPanelWrapper integration"
```

---

## E2E Tests

### Required E2E Test File: `e2e/integration/editor-diff-coordination.spec.ts`

Create E2E tests that verify integration between editor and diff components:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Editor + Diff Coordination', () => {
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

  test('editor is disabled during diff review', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Add initial content
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    // Trigger global edit
    claudeMock.registerResponse('edit', { content: 'Modified content' });
    await chatPage.open();
    await chatPage.sendMessage('Edit this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify editor is disabled (pointer-events: none or contenteditable: false)
    const editorElement = page.getByTestId('document-editor');
    // Check for disabled state indicator
    await expect(editorElement).toHaveCSS('opacity', '0.5');
    // or
    // await expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  test('editor is re-enabled after diff panel closes', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    claudeMock.registerResponse('edit', { content: 'Modified content' });
    await chatPage.open();
    await chatPage.sendMessage('Edit this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Close diff panel by rejecting
    await diffPage.rejectAll();

    // Editor should be editable again
    const editorElement = page.getByTestId('document-editor');
    await expect(editorElement).not.toHaveCSS('opacity', '0.5');
    // or
    // await expect(editor).toHaveAttribute('contenteditable', 'true');

    // Verify we can type
    await editor.click();
    await editor.type(' - edited after diff closed');
    expect(await editor.textContent()).toContain('edited after diff closed');
  });
});
```

### Required E2E Test File: `e2e/integration/chat-persistence.spec.ts`

Create E2E tests for chat history persistence:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test.describe('Chat History Persistence', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('chat messages persist after page reload', async ({ page, workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);

    // Send a message
    claudeMock.registerResponse('test', mockResponses.simpleDiscussion);
    await chatPage.open();
    await chatPage.sendMessage('Test message for persistence');
    await chatPage.waitForResponse();

    // Verify message is present
    const messages = await chatPage.getMessages();
    await expect(messages.first()).toContainText('Test message for persistence');

    // Reload the page
    await page.reload();

    // Re-open chat (may need to wait for history to load)
    await chatPage.open();

    // Verify message persisted
    const messagesAfterReload = await chatPage.getMessages();
    await expect(messagesAfterReload.first()).toContainText('Test message for persistence');
  });

  test('chat history can be cleared', async ({ page, workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);

    // Send a message first
    claudeMock.registerResponse('clear', mockResponses.simpleDiscussion);
    await chatPage.open();
    await chatPage.sendMessage('Message to be cleared');
    await chatPage.waitForResponse();

    // Clear history
    await page.getByTestId('chat-clear-history').click();
    await page.getByTestId('confirm-confirm').click();

    // Verify empty state is shown
    await chatPage.expectEmptyState();

    // Reload and verify history is gone
    await page.reload();
    await chatPage.open();
    await chatPage.expectEmptyState();
  });
});
```

### Additional E2E Tests

Add to `e2e/integration/editor-diff-coordination.spec.ts`:

```typescript
test.describe('Editor State During Diff', () => {
  test('editor shows visual disabled state during diff review', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New","diff":[{"type":"add","value":"New","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor');

    // Trigger diff panel
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Verify editor is visually disabled
    await expect(editor).toHaveAttribute('data-disabled', 'true');
    // CSS check for disabled state
    await expect(editor).toHaveCSS('opacity', '0.5');
    await expect(editor).toHaveCSS('pointer-events', 'none');
  });

  test('editor autosave pauses during diff review', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const saveRequests: string[] = [];

    await page.route('**/api/documents/**', async (route) => {
      saveRequests.push(route.request().method());
      await route.continue();
    });

    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New","diff":[{"type":"add","value":"New","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Open diff panel
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Clear save tracking
    const initialSaveCount = saveRequests.length;

    // Wait to see if any saves occur during diff review
    await page.waitForTimeout(3000);

    // No additional saves should occur while diff panel is open
    expect(saveRequests.length).toBe(initialSaveCount);
  });
});
```

Add to `e2e/integration/chat-persistence.spec.ts`:

```typescript
test.describe('Chat Mode Persistence', () => {
  test('detected mode persists with message after reload', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Done"}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send global edit message
    await page.getByTestId('chat-input').fill('change all headings');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message').last()).toContainText('Done');

    // Reload page
    await page.reload();
    await page.getByTestId('chat-sidebar-toggle').click();

    // Verify message retained its mode
    const userMessage = page.getByTestId('chat-message').first();
    await expect(userMessage).toContainText('change all headings');
    // Mode indicator should show global_edit
    await expect(userMessage.getByTestId('chat-mode-indicator')).toHaveAttribute('data-mode', 'global_edit');
  });
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/integration/editor-diff-coordination.spec.ts
npm run test:e2e e2e/integration/chat-persistence.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 4.11.

---

## Verification Checklist

- [ ] DocumentEditorContext provides editor ref
- [ ] showDiff displays diff panel and disables editor
- [ ] hideDiff hides diff panel and re-enables editor
- [ ] DiffPanelWrapper manages accept/reject state
- [ ] Accept all/reject all work correctly
- [ ] Apply updates editor content
- [ ] Operation status updated on accept/reject
- [ ] **E2E tests pass:** `npm run test:e2e e2e/integration/editor-diff-coordination.spec.ts`
- [ ] **E2E tests pass:** `npm run test:e2e e2e/integration/chat-persistence.spec.ts`
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 4.11: Tests](./11-tests.md)**.
