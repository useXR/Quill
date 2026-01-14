# Task 4.8: ChatSidebar & useStreamingChat Hook

> **Phase 4** | [← Database Migration](./07-database-migration.md) | [Next: DiffPanel & AI Undo →](./09-diff-panel-undo.md)

---

## Context

**This task creates the ChatSidebar component and useStreamingChat hook.** The sidebar provides the main chat interface, while the hook manages SSE streaming and message state.

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

  if (!state.isOpen) {
    return (
      <button
        onClick={handleToggle}
        className="fixed right-4 bottom-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700"
        data-testid="chat-sidebar-toggle"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-xl flex flex-col z-50" data-testid="chat-sidebar">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Document Chat</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            data-testid="chat-clear-history"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={handleToggle}
            className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            data-testid="chat-sidebar-toggle"
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

      <div className="flex-1 overflow-y-auto" data-testid="chat-message-list">
        {state.messages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>Start a conversation about your document</p>
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
        {isLoading && !isStreaming && (
          <div className="p-4 flex items-center gap-2 text-gray-400" data-testid="chat-loading">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Claude is thinking...</span>
          </div>
        )}
      </div>

      {state.error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm" data-testid="chat-error">
          {state.error}
        </div>
      )}

      <ChatInput onSend={sendMessage} onCancel={cancelStream} disabled={isLoading && !isStreaming} isStreaming={isStreaming} />
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

## Verification Checklist

- [ ] ChatSidebar toggle button appears when closed
- [ ] ChatSidebar opens when toggle clicked
- [ ] ChatSidebar shows empty state with no messages
- [ ] ChatSidebar displays messages when present
- [ ] useStreamingChat sends messages via SSE
- [ ] useStreamingChat handles streaming responses
- [ ] Cancel stream aborts fetch
- [ ] Retry resends last user message
- [ ] All tests pass
- [ ] Changes committed (2 commits for Tasks 23-24)

---

## Next Steps

After this task, proceed to **[Task 4.9: DiffPanel & AI Undo](./09-diff-panel-undo.md)**.
