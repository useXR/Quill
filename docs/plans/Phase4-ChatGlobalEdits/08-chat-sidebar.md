# Task 4.8: ChatSidebar & useStreamingChat Hook

> **Phase 4** | [← Database Migration](./07-database-migration.md) | [Next: DiffPanel & AI Undo →](./09-diff-panel-undo.md)

---

## Context

**This task creates the ChatSidebar component and useStreamingChat hook.** The sidebar provides the main chat interface, while the hook manages SSE streaming and message state.

### Design System Reference

The ChatSidebar follows the **Scholarly Craft** aesthetic from `docs/design-system.md`:

| Element       | Design Tokens                                                           |
| ------------- | ----------------------------------------------------------------------- |
| Sidebar Panel | `bg-surface`, `border-l border-ink-faint`, `shadow-lg`                  |
| Header        | `border-b border-ink-faint`, `font-display` for title                   |
| Toggle Button | `bg-quill`, `text-white`, `shadow-lg`, `rounded-full`                   |
| Icon Buttons  | `text-ink-tertiary`, `hover:text-ink-primary`, `hover:bg-surface-hover` |
| Loading State | `text-ink-tertiary`, `bg-quill` cursor, `animate-pulse`                 |
| Error State   | `bg-error-light`, `text-error`                                          |
| Empty State   | `text-ink-tertiary`, uses Lucide icons at `opacity-50`                  |

### Prerequisites

- **Task 4.7** completed (Database indexes)
- **Task 4.1** completed (ChatContext)
- **Task 4.3** completed (Chat components)

### What This Task Creates

- `src/components/chat/ChatSidebar.tsx` - Main chat interface
- `src/components/chat/__tests__/ChatSidebar.test.tsx` - Tests
- `src/hooks/useStreamingChat.ts` - Streaming hook

### Tasks That Depend on This

- **Task 4.10** (Integration) - Uses ChatSidebar

### Parallel Tasks

This task can be done in parallel with:

- **Task 4.9** (DiffPanel & AI Undo)

---

## Files to Create/Modify

- `src/components/chat/ChatSidebar.tsx` (create)
- `src/components/chat/__tests__/ChatSidebar.test.tsx` (create)
- `src/hooks/useStreamingChat.ts` (create)

---

## Task 23: ChatSidebar Component

### Step 1: Write failing test for ChatSidebar

Create `src/components/chat/__tests__/ChatSidebar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatProvider } from '@/contexts/ChatContext';
import { ChatSidebar } from '../ChatSidebar';

vi.mock('@/hooks/useStreamingChat', () => ({
  useStreamingChat: () => ({
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    retryLastMessage: vi.fn(),
    isLoading: false,
    isStreaming: false,
  }),
}));

describe('ChatSidebar', () => {
  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<ChatProvider>{ui}</ChatProvider>);
  };

  it('should render toggle button when closed', () => {
    renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
    expect(screen.getByTestId('chat-sidebar-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
  });

  it('should open sidebar when toggle clicked', () => {
    renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
    fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
    fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
    expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/chat/__tests__/ChatSidebar.test.tsx
```

**Expected:** FAIL - module not found

### Step 3: Write ChatSidebar component

Create `src/components/chat/ChatSidebar.tsx`:

```typescript
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ChatSidebarProps {
  documentId: string;
  projectId: string;
}

export function ChatSidebar({ documentId, projectId }: ChatSidebarProps) {
  const { state, dispatch } = useChat();
  const { sendMessage, cancelStream, retryLastMessage, isLoading, isStreaming } = useStreamingChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    dispatch({ type: 'SET_DOCUMENT', documentId, projectId });
  }, [documentId, projectId, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Memoized handlers (Best Practice: useCallback for event handlers)
  const handleToggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, [dispatch]);

  const handleClearHistory = useCallback(async () => {
    setShowClearConfirm(false);
    await fetch('/api/chat/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, documentId }),
    });
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, [projectId, documentId, dispatch]);

  /**
   * ChatSidebar Closed State - Floating Action Button
   *
   * Design System: FAB pattern with quill brand color
   * - Position: fixed bottom-right with spacing-6
   * - Style: bg-quill, rounded-full, shadow-lg
   * - Hover: scale transform for tactile feedback
   */
  if (!state.isOpen) {
    return (
      <button
        onClick={handleToggle}
        className="
          fixed right-6 bottom-6
          p-3
          bg-quill text-white
          rounded-full shadow-lg
          hover:bg-quill-dark hover:shadow-xl hover:scale-105
          active:bg-quill-darker active:scale-95
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
        "
        data-testid="chat-sidebar-toggle"
        aria-label="Open chat sidebar"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  /**
   * ChatSidebar Open State - Panel
   *
   * Design System: Side panel with scholarly aesthetic
   * - Background: bg-surface (clean white)
   * - Border: border-l border-ink-faint (subtle separation)
   * - Shadow: shadow-lg for elevation
   */
  return (
    <div
      className="
        fixed right-0 top-0 h-full w-96
        bg-surface
        border-l border-ink-faint
        shadow-lg
        flex flex-col
        z-50
      "
      data-testid="chat-sidebar"
    >
      {/* Header - uses display font for scholarly title */}
      <div className="flex items-center justify-between p-4 border-b border-ink-faint">
        <h2 className="font-display font-semibold text-ink-primary">
          Document Chat
        </h2>
        <div className="flex items-center gap-1">
          {/* Icon buttons - subtle with hover states */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="
              p-2 rounded-md
              text-ink-tertiary hover:text-ink-primary
              hover:bg-surface-hover
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-quill
            "
            data-testid="chat-clear-history"
            aria-label="Clear chat history"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={handleToggle}
            className="
              p-2 rounded-md
              text-ink-tertiary hover:text-ink-primary
              hover:bg-surface-hover
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-quill
            "
            data-testid="chat-sidebar-toggle"
            aria-label="Close chat sidebar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Non-blocking confirmation dialog (Best Practice: Avoid blocking confirm()) */}
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearHistory}
        title="Clear Chat History"
        message="Are you sure you want to clear all chat history? This cannot be undone."
      />

      {/* Message List - scrollable area */}
      <div className="flex-1 overflow-y-auto" data-testid="chat-message-list">
        {state.messages.length === 0 ? (
          /* Empty State - centered with subdued styling */
          <div className="p-8 text-center">
            <MessageSquare
              size={48}
              className="mx-auto mb-4 text-ink-faint opacity-50"
            />
            <p className="font-ui text-ink-tertiary">
              Start a conversation about your document
            </p>
          </div>
        ) : (
          state.messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              id={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.createdAt}
              status={msg.status}
              mode={msg.mode}
              onRetry={msg.status === 'error' ? retryLastMessage : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
        {/* Loading State - thinking indicator */}
        {isLoading && !isStreaming && (
          <div
            className="p-4 flex items-center gap-2 text-ink-tertiary"
            data-testid="chat-loading"
          >
            <Loader2
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
            <span className="font-ui text-sm">Claude is thinking...</span>
          </div>
        )}
      </div>

      {/* Error Banner - uses error semantic colors */}
      {state.error && (
        <div
          className="
            px-4 py-2
            bg-error-light
            font-ui text-sm text-error
          "
          data-testid="chat-error"
        >
          {state.error}
        </div>
      )}

      <ChatInput
        onSend={sendMessage}
        onCancel={cancelStream}
        disabled={isLoading && !isStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/chat/__tests__/ChatSidebar.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/chat/ChatSidebar.tsx src/components/chat/__tests__/ChatSidebar.test.tsx
git commit -m "feat: add ChatSidebar component"
```

---

## Task 24: useStreamingChat Hook

### Step 1: Create the hook

Create `src/hooks/useStreamingChat.ts`:

```typescript
import { useCallback, useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { detectChatMode } from '@/lib/ai/intent-detection';

// Type for SSE stream events (Best Practice: Type external data)
type StreamEvent = { type: 'content'; content: string } | { type: 'done' } | { type: 'error'; message: string };

export function useStreamingChat() {
  const { state, dispatch } = useChat();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount (Best Practice: Manage resources with useRef + cleanup)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!state.documentId || !state.projectId) {
        dispatch({ type: 'SET_ERROR', error: 'No document selected' });
        return;
      }

      const { mode } = detectChatMode(content);
      const userMessageId = crypto.randomUUID();

      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: userMessageId, role: 'user', content, createdAt: new Date(), status: 'sent', mode },
      });

      const assistantMessageId = crypto.randomUUID();
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          status: 'streaming',
          mode,
        },
      });

      dispatch({ type: 'SET_LOADING', isLoading: true });
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, documentId: state.documentId, projectId: state.projectId, mode }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) throw new Error('Chat request failed');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as StreamEvent;
                if (data.type === 'content') {
                  dispatch({ type: 'APPEND_TO_STREAMING', id: assistantMessageId, chunk: data.content });
                } else if (data.type === 'done') {
                  dispatch({ type: 'SET_MESSAGE_STATUS', id: assistantMessageId, status: 'sent' });
                } else if (data.type === 'error') {
                  dispatch({ type: 'SET_MESSAGE_STATUS', id: assistantMessageId, status: 'error' });
                  dispatch({ type: 'SET_ERROR', error: data.message });
                }
              } catch {
                /* skip malformed JSON */
              }
            }
          }
        }

        dispatch({ type: 'SET_LOADING', isLoading: false });
      } catch (error) {
        dispatch({ type: 'SET_LOADING', isLoading: false });
        dispatch({ type: 'SET_MESSAGE_STATUS', id: assistantMessageId, status: 'error' });
        if (!(error instanceof Error && error.name === 'AbortError')) {
          dispatch({ type: 'SET_ERROR', error: 'Failed to send message' });
        }
      }
    },
    [state.documentId, state.projectId, dispatch]
  );

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    dispatch({ type: 'SET_LOADING', isLoading: false });
  }, [dispatch]);

  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  }, [state.messages, sendMessage]);

  return {
    sendMessage,
    cancelStream,
    retryLastMessage,
    isLoading: state.isLoading,
    isStreaming: state.streamingMessageId !== null,
  };
}
```

### Step 2: Commit

```bash
git add src/hooks/useStreamingChat.ts
git commit -m "feat: add useStreamingChat hook"
```

---

## E2E Tests

### Required E2E Test File: `e2e/chat/chat-sidebar.spec.ts`

Create E2E tests for sidebar visibility and toggle behavior:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test.describe('Chat Sidebar E2E', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should show toggle button when sidebar is closed', async ({ workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await expect(chatPage.toggleButton).toBeVisible();
    await expect(chatPage.sidebar).not.toBeVisible();
  });

  test('should open sidebar when toggle clicked', async ({ workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await expect(chatPage.sidebar).toBeVisible();
  });

  test('should close sidebar when close button clicked', async ({ workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.close();
    await expect(chatPage.sidebar).not.toBeVisible();
  });

  test('should persist sidebar state across navigation', async ({ page, workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();

    // Navigate away and back
    await page.goto('/projects');
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);

    // Sidebar state should be remembered (if implemented with localStorage)
    // or start closed (default behavior)
    await expect(chatPage.toggleButton).toBeVisible();
  });
});
```

### CRITICAL: Required E2E Test File: `e2e/chat/chat-integration.spec.ts`

**This is a CRITICAL integration test** that verifies the chat sidebar appears on the actual editor page from Phase 1:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat + Editor Integration', () => {
  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Navigate to actual editor page (Phase 1 component)
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  });

  test('CRITICAL: chat sidebar toggle appears on editor page', async ({ page }) => {
    // Verify the editor is loaded first
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // CRITICAL: Chat sidebar toggle should be present on editor page
    await expect(page.getByTestId('chat-sidebar-toggle')).toBeVisible();
  });

  test('CRITICAL: chat sidebar opens alongside editor', async ({ page }) => {
    await expect(page.getByTestId('document-editor')).toBeVisible();

    // Open chat sidebar
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Editor should still be visible (not hidden by sidebar)
    await expect(page.getByTestId('document-editor')).toBeVisible();
  });

  test('should send chat message about document content', async ({ page }) => {
    // Type some content in the editor
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.type('This is my research paper about machine learning.');

    // Open chat and ask about the content
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('What is my document about?');
    await page.getByTestId('chat-send-button').click();

    // Verify message was sent (appears in list)
    await expect(page.getByTestId('chat-message').first()).toContainText('What is my document about?');
  });
});
```

### Additional E2E Tests

Add to `e2e/chat/chat-sidebar.spec.ts`:

```typescript
test.describe('ChatSidebar Empty and Loading States', () => {
  test('shows empty state when no messages', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Clear any existing chat history first
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // If clear button exists, clear history
    const clearButton = page.getByTestId('chat-clear-history');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.getByTestId('confirm-confirm').click();
    }

    // Verify empty state message visible
    await expect(page.getByText('Start a conversation')).toBeVisible();
    await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(0);
  });

  test('shows loading indicator during thinking phase', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock slow response to observe loading state
    await page.route('**/api/ai/chat', async (route) => {
      // Delay before first chunk to show "thinking" state
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Response"}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test loading state');
    await page.getByTestId('chat-send-button').click();

    // Verify "thinking" indicator appears before stream starts
    await expect(page.getByTestId('chat-loading')).toBeVisible();
    await expect(page.getByText('Claude is thinking')).toBeVisible();
  });

  test('shows error banner on API failure', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock API failure
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test error state');
    await page.getByTestId('chat-send-button').click();

    // Verify error banner appears
    await expect(page.getByTestId('chat-error')).toBeVisible();
    await expect(page.getByTestId('chat-error')).toHaveClass(/bg-error-light/);
  });

  test('error banner clears when new message sent successfully', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    let callCount = 0;

    await page.route('**/api/ai/chat', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Error' }) });
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"content","content":"Success"}\n\ndata: {"type":"done"}\n\n',
        });
      }
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // First message fails
    await page.getByTestId('chat-input').fill('First message');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-error')).toBeVisible();

    // Second message succeeds - error should clear
    await page.getByTestId('chat-input').fill('Second message');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-error')).not.toBeVisible();
  });
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/chat/chat-sidebar.spec.ts e2e/chat/chat-integration.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 4.9.

---

## Verification Checklist

- [ ] ChatSidebar toggle button appears when closed
- [ ] ChatSidebar opens when toggle clicked
- [ ] ChatSidebar shows empty state with no messages
- [ ] ChatSidebar displays messages when present
- [ ] useStreamingChat sends messages via SSE
- [ ] useStreamingChat handles streaming responses
- [ ] Cancel stream aborts fetch
- [ ] Retry resends last user message
- [ ] All unit tests pass
- [ ] **E2E tests pass:** `npm run test:e2e e2e/chat/chat-sidebar.spec.ts`
- [ ] **CRITICAL E2E tests pass:** `npm run test:e2e e2e/chat/chat-integration.spec.ts`
- [ ] Changes committed (2 commits for Tasks 23-24)

---

## Next Steps

After this task, proceed to **[Task 4.9: DiffPanel & AI Undo](./09-diff-panel-undo.md)**.
