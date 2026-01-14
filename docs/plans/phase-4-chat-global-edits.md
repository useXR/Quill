# Phase 4: Chat & Global Edits - Detailed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a document chat sidebar with mode detection, global edit capabilities with diff review, and AI operation history for undo functionality.

**Prerequisites:** Phases 0-3 completed (Next.js app, TipTap editor, Supabase auth/DB, vault, Claude CLI integration).

---

## Overview

Phase 4 adds conversational AI interaction through a chat sidebar that intelligently detects user intent (discussion, global edit, or research), presents document changes through a diff review interface, and maintains operation history for undo capability.

**Key Components:**

- Chat sidebar with streaming responses
- Intent/mode detection system
- Global edit API with diff generation
- Diff panel with accept/reject UI
- AI operations history and undo

---

## Task 4.1: Chat Context and State Management

**Files:**

- Create: `src/contexts/ChatContext.tsx`
- Create: `src/hooks/useStreamingChat.ts`
- Create: `src/contexts/__tests__/ChatContext.test.tsx`

**Step 1: Create ChatContext with reducer pattern**

Create `src/contexts/ChatContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useReducer, ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  status: 'sending' | 'sent' | 'streaming' | 'error';
  mode?: 'discussion' | 'global_edit' | 'research';
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  documentId: string | null;
  projectId: string | null;
  streamingMessageId: string | null;
  error: string | null;
}

type ChatAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; id: string; content: string }
  | { type: 'SET_MESSAGE_STATUS'; id: string; status: ChatMessage['status'] }
  | { type: 'APPEND_TO_STREAMING'; id: string; chunk: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'OPEN_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'SET_DOCUMENT'; documentId: string; projectId: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'LOAD_MESSAGES'; messages: ChatMessage[] };

const initialState: ChatState = {
  messages: [],
  isOpen: false,
  isLoading: false,
  documentId: null,
  projectId: null,
  streamingMessageId: null,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
        streamingMessageId: action.message.status === 'streaming' ? action.message.id : state.streamingMessageId,
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.id ? { ...m, content: action.content } : m
        ),
      };
    case 'APPEND_TO_STREAMING':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.id ? { ...m, content: m.content + action.chunk } : m
        ),
      };
    case 'SET_MESSAGE_STATUS':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.id ? { ...m, status: action.status } : m
        ),
        streamingMessageId: action.status !== 'streaming' && state.streamingMessageId === action.id
          ? null
          : state.streamingMessageId,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'TOGGLE_SIDEBAR':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_SIDEBAR':
      return { ...state, isOpen: true };
    case 'CLOSE_SIDEBAR':
      return { ...state, isOpen: false };
    case 'SET_DOCUMENT':
      return {
        ...state,
        documentId: action.documentId,
        projectId: action.projectId,
        messages: [], // Clear messages when switching documents
      };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'LOAD_MESSAGES':
      return { ...state, messages: action.messages };
    default:
      return state;
  }
}

const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
} | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
}
```

**Step 2: Create streaming chat hook**

Create `src/hooks/useStreamingChat.ts`:

```typescript
import { useCallback, useRef } from 'react';
import { useChat, ChatMessage } from '@/contexts/ChatContext';
import { detectChatMode } from '@/lib/ai/intent-detection';

export function useStreamingChat() {
  const { state, dispatch } = useChat();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!state.documentId || !state.projectId) {
        dispatch({ type: 'SET_ERROR', error: 'No document selected' });
        return;
      }

      // Detect mode before sending
      const { mode } = detectChatMode(content);

      // Add user message immediately (optimistic)
      const userMessageId = crypto.randomUUID();
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: userMessageId,
          role: 'user',
          content,
          createdAt: new Date(),
          status: 'sent',
          mode,
        },
      });

      // Create placeholder for assistant response
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

      // Cancel any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            documentId: state.documentId,
            projectId: state.projectId,
            mode,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error('Chat request failed');
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE format: "data: {...}\n\n"
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  dispatch({
                    type: 'APPEND_TO_STREAMING',
                    id: assistantMessageId,
                    chunk: data.content,
                  });
                } else if (data.type === 'done') {
                  dispatch({
                    type: 'SET_MESSAGE_STATUS',
                    id: assistantMessageId,
                    status: 'sent',
                  });
                } else if (data.type === 'error') {
                  dispatch({
                    type: 'SET_MESSAGE_STATUS',
                    id: assistantMessageId,
                    status: 'error',
                  });
                  dispatch({ type: 'SET_ERROR', error: data.message });
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        dispatch({ type: 'SET_LOADING', isLoading: false });
      } catch (error) {
        dispatch({ type: 'SET_LOADING', isLoading: false });

        if (error instanceof Error && error.name === 'AbortError') {
          dispatch({
            type: 'SET_MESSAGE_STATUS',
            id: assistantMessageId,
            status: 'error',
          });
        } else {
          dispatch({
            type: 'SET_MESSAGE_STATUS',
            id: assistantMessageId,
            status: 'error',
          });
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
      // Remove the failed assistant message
      const failedMessage = state.messages.find((m) => m.role === 'assistant' && m.status === 'error');
      if (failedMessage) {
        // Re-send the last user message
        await sendMessage(lastUserMessage.content);
      }
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

**Step 3: Write tests**

Create `src/contexts/__tests__/ChatContext.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ChatProvider, useChat } from '../ChatContext';

describe('ChatContext', () => {
  it('should provide initial state', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.isOpen).toBe(false);
  });

  it('should toggle sidebar', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_SIDEBAR' });
    });

    expect(result.current.state.isOpen).toBe(true);
  });

  it('should add message', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    act(() => {
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
          status: 'sent',
        },
      });
    });

    expect(result.current.state.messages).toHaveLength(1);
    expect(result.current.state.messages[0].content).toBe('Hello');
  });

  it('should append to streaming message', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    act(() => {
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: '1',
          role: 'assistant',
          content: 'Hello',
          createdAt: new Date(),
          status: 'streaming',
        },
      });
    });

    act(() => {
      result.current.dispatch({
        type: 'APPEND_TO_STREAMING',
        id: '1',
        chunk: ' World',
      });
    });

    expect(result.current.state.messages[0].content).toBe('Hello World');
  });
});
```

**Step 4: Run tests**

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add ChatContext and streaming chat hook"
```

---

## Task 4.2: Chat History API

**Files:**

- Create: `src/lib/api/chat.ts`
- Create: `src/app/api/chat/history/route.ts`
- Create: `src/lib/api/__tests__/chat.test.ts`

**Step 1: Create chat API helpers with pagination**

Create `src/lib/api/chat.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type ChatHistoryRow = Database['public']['Tables']['chat_history']['Row'];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getChatHistory(
  projectId: string,
  documentId?: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedResult<ChatMessage>> {
  const { limit = 50, cursor } = options;
  const supabase = await createClient();

  let query = supabase
    .from('chat_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) throw error;

  const hasMore = (data?.length || 0) > limit;
  const items = hasMore ? data!.slice(0, limit) : data || [];
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return {
    data: items.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: new Date(row.created_at),
    })),
    nextCursor,
    hasMore,
  };
}

export async function saveChatMessage(data: {
  projectId: string;
  documentId?: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<ChatMessage> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('chat_history')
    .insert({
      project_id: data.projectId,
      document_id: data.documentId || null,
      role: data.role,
      content: data.content,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at),
  };
}

export async function clearChatHistory(projectId: string, documentId?: string): Promise<void> {
  const supabase = await createClient();

  let query = supabase.from('chat_history').delete().eq('project_id', projectId);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { error } = await query;
  if (error) throw error;
}
```

**Step 2: Create chat history API route**

Create `src/app/api/chat/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatHistory, clearChatHistory } from '@/lib/api/chat';
import { z } from 'zod';

const querySchema = z.object({
  projectId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: searchParams.get('projectId'),
    documentId: searchParams.get('documentId'),
    limit: searchParams.get('limit'),
    cursor: searchParams.get('cursor'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await getChatHistory(parsed.data.projectId, parsed.data.documentId, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, documentId } = await request.json();

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  try {
    await clearChatHistory(projectId, documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}
```

**Step 3: Add database indexes migration**

Create `supabase/migrations/*_chat_indexes.sql`:

```sql
-- Index for fetching chat history by project
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id
  ON public.chat_history(project_id);

-- Index for fetching chat history by document
CREATE INDEX IF NOT EXISTS idx_chat_history_document_id
  ON public.chat_history(document_id);

-- Composite index for pagination queries
CREATE INDEX IF NOT EXISTS idx_chat_history_project_created
  ON public.chat_history(project_id, created_at DESC);

-- Index for AI operations lookup
CREATE INDEX IF NOT EXISTS idx_ai_operations_document_id
  ON public.ai_operations(document_id);

-- Index for recent operations query
CREATE INDEX IF NOT EXISTS idx_ai_operations_document_created
  ON public.ai_operations(document_id, created_at DESC);
```

**Step 4: Apply migration**

```bash
npx supabase db reset
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add chat history API with pagination"
```

---

## Task 4.3: Chat UI Components

**Files:**

- Create: `src/components/chat/ChatSidebar.tsx`
- Create: `src/components/chat/ChatMessage.tsx`
- Create: `src/components/chat/ChatInput.tsx`
- Create: `src/components/chat/ModeIndicator.tsx`
- Create: `src/components/chat/__tests__/ChatSidebar.test.tsx`

**Step 1: Create ModeIndicator component**

Create `src/components/chat/ModeIndicator.tsx`:

```typescript
'use client';

import { Edit3, MessageCircle, Search } from 'lucide-react';

export type ChatMode = 'discussion' | 'global_edit' | 'research';

interface ModeIndicatorProps {
  mode: ChatMode;
  confidence?: 'high' | 'medium' | 'low';
}

const MODE_CONFIG = {
  discussion: {
    icon: MessageCircle,
    label: 'Discussion',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Ask questions about your document',
  },
  global_edit: {
    icon: Edit3,
    label: 'Global Edit',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    description: 'Make changes throughout the document',
  },
  research: {
    icon: Search,
    label: 'Research',
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Find and cite relevant papers',
  },
};

export function ModeIndicator({ mode, confidence }: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}
      data-testid="chat-mode-indicator"
      data-mode={mode}
      title={config.description}
    >
      <Icon className="w-3.5 h-3.5" data-testid={`mode-icon-${mode}`} />
      <span>{config.label}</span>
      {confidence && confidence !== 'high' && (
        <span className="opacity-60">({confidence})</span>
      )}
    </div>
  );
}
```

**Step 2: Create ChatMessage component**

Create `src/components/chat/ChatMessage.tsx`:

```typescript
'use client';

import { User, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { ModeIndicator, ChatMode } from './ModeIndicator';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'streaming' | 'error';
  mode?: ChatMode;
  onRetry?: () => void;
}

export function ChatMessage({
  id,
  role,
  content,
  timestamp,
  status,
  mode,
  onRetry,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isError = status === 'error';
  const isStreaming = status === 'streaming';

  return (
    <div
      className={`flex gap-3 p-4 ${isUser ? 'bg-gray-50' : 'bg-white'}`}
      data-testid="chat-message"
      data-role={role}
      data-streaming={isStreaming}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
      }`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {isUser ? 'You' : 'Claude'}
          </span>
          {mode && <ModeIndicator mode={mode} />}
          <span className="text-xs text-gray-400">
            {timestamp.toLocaleTimeString()}
          </span>
        </div>

        <div className={`text-sm whitespace-pre-wrap ${isError ? 'text-red-600' : 'text-gray-700'}`}>
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-purple-400 animate-pulse" />
          )}
        </div>

        {isError && (
          <div className="flex items-center gap-2 mt-2 text-red-600">
            <AlertCircle size={14} />
            <span className="text-xs">Failed to send</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                data-testid="chat-retry"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create ChatInput component**

Create `src/components/chat/ChatInput.tsx`:

```typescript
'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { ModeIndicator, ChatMode } from './ModeIndicator';
import { detectChatMode } from '@/lib/ai/intent-detection';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  disabled = false,
  isStreaming = false,
  placeholder = 'Ask a question or request changes...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [detectedMode, setDetectedMode] = useState<ChatMode>('discussion');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (value: string) => {
    setMessage(value);
    const { mode } = detectChatMode(value);
    setDetectedMode(mode);
  };

  const handleSend = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
      setDetectedMode('discussion');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4 bg-white">
      {message.length > 0 && (
        <div className="mb-2">
          <ModeIndicator mode={detectedMode} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '40px', maxHeight: '120px' }}
          data-testid="chat-input"
        />

        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex-shrink-0 p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
            data-testid="chat-cancel-stream"
          >
            <Square size={20} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="flex-shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="chat-send-button"
          >
            <Send size={20} />
          </button>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
```

**Step 4: Create ChatSidebar component**

Create `src/components/chat/ChatSidebar.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { X, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatSidebarProps {
  documentId: string;
  projectId: string;
  onGlobalEditRequest?: (instruction: string, content: string) => void;
}

export function ChatSidebar({
  documentId,
  projectId,
  onGlobalEditRequest,
}: ChatSidebarProps) {
  const { state, dispatch } = useChat();
  const { sendMessage, cancelStream, retryLastMessage, isLoading, isStreaming } = useStreamingChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set document context on mount
  useEffect(() => {
    dispatch({ type: 'SET_DOCUMENT', documentId, projectId });
  }, [documentId, projectId, dispatch]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleToggle = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  const handleClearHistory = async () => {
    if (confirm('Clear all chat history for this document?')) {
      await fetch('/api/chat/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, documentId }),
      });
      dispatch({ type: 'CLEAR_MESSAGES' });
    }
  };

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
    <div
      className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-xl flex flex-col z-50"
      data-testid="chat-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Document Chat</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearHistory}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Clear history"
            data-testid="chat-clear-history"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={handleToggle}
            className="p-1 text-gray-400 hover:text-gray-600"
            data-testid="chat-sidebar-toggle"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
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

        {/* Loading indicator */}
        {isLoading && !isStreaming && (
          <div className="p-4 flex items-center gap-2 text-gray-400" data-testid="chat-loading">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Claude is thinking...</span>
          </div>
        )}

        {/* Typing indicator during streaming */}
        {isStreaming && (
          <div className="p-4" data-testid="chat-typing-indicator">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {state.error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm" data-testid="chat-error">
          {state.error}
        </div>
      )}

      {/* Input */}
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

**Step 5: Write component tests**

Create `src/components/chat/__tests__/ChatSidebar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatProvider } from '@/contexts/ChatContext';
import { ChatSidebar } from '../ChatSidebar';

// Mock the streaming hook
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
    return render(
      <ChatProvider>
        {ui}
      </ChatProvider>
    );
  };

  it('should render toggle button when closed', () => {
    renderWithProvider(
      <ChatSidebar documentId="doc-1" projectId="proj-1" />
    );

    expect(screen.getByTestId('chat-sidebar-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
  });

  it('should open sidebar when toggle clicked', () => {
    renderWithProvider(
      <ChatSidebar documentId="doc-1" projectId="proj-1" />
    );

    fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));

    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    renderWithProvider(
      <ChatSidebar documentId="doc-1" projectId="proj-1" />
    );

    fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));

    expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
  });
});
```

**Step 6: Run tests**

```bash
npm test src/components/chat/__tests__/ChatSidebar.test.tsx
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add chat sidebar UI components"
```

---

## Task 4.4: Streaming Chat API Endpoint

**Files:**

- Create: `src/app/api/ai/chat/route.ts`
- Modify: `src/lib/ai/streaming.ts`

**Step 1: Create chat API endpoint with streaming**

Create `src/app/api/ai/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
import { buildContext, formatContextForPrompt } from '@/lib/ai/context-builder';
import { saveChatMessage } from '@/lib/api/chat';
import { z } from 'zod';

const requestSchema = z.object({
  content: z.string().min(1).max(10000),
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  mode: z.enum(['discussion', 'global_edit', 'research']).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { content, documentId, projectId, mode } = parsed.data;

  // Save user message
  await saveChatMessage({
    projectId,
    documentId,
    role: 'user',
    content,
  });

  // Build context from document and vault
  const context = await buildContext(documentId, projectId, content);
  const contextPrompt = formatContextForPrompt(context);

  // Construct the full prompt based on mode
  let systemPrompt = 'You are a helpful AI assistant for academic grant writing.';

  if (mode === 'global_edit') {
    systemPrompt += ' The user wants to make changes to their document. Provide the edited content directly.';
  } else if (mode === 'research') {
    systemPrompt += ' The user is looking for research and citations. Help find relevant information.';
  } else {
    systemPrompt += ' Answer questions and provide guidance about the document.';
  }

  const fullPrompt = `${systemPrompt}

${contextPrompt}

User: ${content}`;

  // Stream the response
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = streamClaude(
        fullPrompt,
        (chunk) => {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
        },
        async () => {
          // Save assistant response
          await saveChatMessage({
            projectId,
            documentId,
            role: 'assistant',
            content: fullResponse,
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        },
        (error) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`));
          controller.close();
        }
      );

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

**Step 2: Update streaming helper**

Update `src/lib/ai/streaming.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';

export function streamClaude(
  prompt: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  timeout = 120000
): () => void {
  let proc: ChildProcess | null = null;
  let killed = false;

  try {
    proc = spawn('claude', ['-p', prompt, '--output-format', 'stream-json'], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      if (killed) return;

      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.content) {
            onChunk(parsed.content);
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      if (killed) return;
      console.error('Claude CLI stderr:', data.toString());
    });

    proc.on('close', (code) => {
      if (killed) return;

      if (code === 0) {
        onComplete();
      } else {
        onError(`Process exited with code ${code}`);
      }
    });

    proc.on('error', (err) => {
      if (killed) return;
      onError(err.message);
    });
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Failed to start Claude CLI');
  }

  // Return cleanup function
  return () => {
    killed = true;
    proc?.kill('SIGTERM');
  };
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add streaming chat API endpoint"
```

---

## Task 4.5: Chat Mode Detection with Enhanced Patterns

**Files:**

- Create: `src/lib/ai/intent-detection.ts`
- Create: `src/lib/ai/__tests__/intent-detection.test.ts`

**Step 1: Create enhanced mode detection**

Create `src/lib/ai/intent-detection.ts`:

```typescript
export type ChatMode = 'discussion' | 'global_edit' | 'research';

export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

interface Pattern {
  pattern: RegExp;
  weight: number;
  description: string;
}

const EDIT_PATTERNS: Pattern[] = [
  { pattern: /\b(change|modify|update|edit)\s+(?:all|every|each)/i, weight: 3, description: 'bulk change' },
  { pattern: /\bthroughout\s+(the\s+)?(document|text|entire)/i, weight: 3, description: 'throughout document' },
  { pattern: /\beverywhere\b/i, weight: 2, description: 'everywhere' },
  { pattern: /\ball\s+(sections?|paragraphs?|headings?|sentences?)\b/i, weight: 2, description: 'all sections' },
  { pattern: /\breplace\s+(?:all|every)/i, weight: 3, description: 'replace all' },
  { pattern: /\bremove\s+(?:all|every)/i, weight: 3, description: 'remove all' },
  { pattern: /\bdelete\s+(?:all|every)/i, weight: 3, description: 'delete all' },
  { pattern: /\bshorten\s+(the\s+)?(entire|whole|all)/i, weight: 2, description: 'shorten document' },
  { pattern: /\bexpand\s+(the\s+)?(entire|whole|all)/i, weight: 2, description: 'expand document' },
  { pattern: /\brewrite\s+(the\s+)?(entire|whole|document)/i, weight: 3, description: 'rewrite document' },
  {
    pattern: /\bmake\s+(it\s+)?(more|less)\s+\w+\s+(throughout|everywhere)/i,
    weight: 2,
    description: 'global tone change',
  },
  { pattern: /\bfix\s+(all|every)\s+/i, weight: 2, description: 'fix all' },
];

const RESEARCH_PATTERNS: Pattern[] = [
  {
    pattern: /\b(find|search\s+for|look\s+up)\s+.*(paper|study|article|research)/i,
    weight: 3,
    description: 'find papers',
  },
  { pattern: /\bwhat\s+(is|are|does|do)\s+/i, weight: 1, description: 'what is question' },
  { pattern: /\bcite|citation|reference\b/i, weight: 2, description: 'citation request' },
  {
    pattern: /\brecent\s+(papers?|studies?|research|findings?|publications?)\b/i,
    weight: 3,
    description: 'recent research',
  },
  { pattern: /\baccording\s+to\b/i, weight: 1, description: 'according to' },
  { pattern: /\bsources?\s+(for|about|on)\b/i, weight: 2, description: 'sources for' },
  { pattern: /\bliterature\s+(review|search|on)\b/i, weight: 3, description: 'literature review' },
  { pattern: /\bpeer[- ]reviewed\b/i, weight: 2, description: 'peer reviewed' },
  { pattern: /\b(doi|pmid|pubmed|arxiv)\b/i, weight: 3, description: 'database reference' },
];

export function detectChatMode(message: string): ModeDetectionResult {
  let editScore = 0;
  let researchScore = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, weight, description } of EDIT_PATTERNS) {
    if (pattern.test(message)) {
      editScore += weight;
      matchedPatterns.push(`edit:${description}`);
    }
  }

  for (const { pattern, weight, description } of RESEARCH_PATTERNS) {
    if (pattern.test(message)) {
      researchScore += weight;
      matchedPatterns.push(`research:${description}`);
    }
  }

  const maxScore = Math.max(editScore, researchScore);
  const confidence: 'high' | 'medium' | 'low' = maxScore >= 5 ? 'high' : maxScore >= 3 ? 'medium' : 'low';

  if (editScore > researchScore && editScore >= 2) {
    return { mode: 'global_edit', confidence, matchedPatterns };
  }
  if (researchScore > editScore && researchScore >= 2) {
    return { mode: 'research', confidence, matchedPatterns };
  }
  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}

// Destructive edit detection for warnings
export function isDestructiveEdit(message: string): boolean {
  const destructivePatterns = [
    /\bdelete\s+(all|every|the\s+entire)/i,
    /\bremove\s+(all|every|the\s+entire)/i,
    /\brewrite\s+(the\s+)?(entire|whole)/i,
    /\breplace\s+(all|everything)/i,
    /\bclear\s+(all|the\s+)/i,
  ];

  return destructivePatterns.some((p) => p.test(message));
}
```

**Step 2: Write tests**

Create `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectChatMode, isDestructiveEdit } from '../intent-detection';

describe('detectChatMode', () => {
  describe('discussion mode', () => {
    it('should detect discussion for general questions', () => {
      const result = detectChatMode('Can you explain this paragraph?');
      expect(result.mode).toBe('discussion');
    });

    it('should detect discussion for simple requests', () => {
      const result = detectChatMode('What do you think about this?');
      expect(result.mode).toBe('discussion');
    });
  });

  describe('global_edit mode', () => {
    it('should detect edit for "change all" patterns', () => {
      const result = detectChatMode('Change all instances of "the" to "a"');
      expect(result.mode).toBe('global_edit');
    });

    it('should detect edit for "throughout" patterns', () => {
      const result = detectChatMode('Make the tone more formal throughout');
      expect(result.mode).toBe('global_edit');
    });

    it('should detect edit for "everywhere" patterns', () => {
      const result = detectChatMode('Fix grammar everywhere');
      expect(result.mode).toBe('global_edit');
    });

    it('should detect edit for "rewrite" patterns', () => {
      const result = detectChatMode('Rewrite the entire introduction');
      expect(result.mode).toBe('global_edit');
    });

    it('should have high confidence for multiple matches', () => {
      const result = detectChatMode('Change all headings throughout the entire document');
      expect(result.mode).toBe('global_edit');
      expect(result.confidence).toBe('high');
    });
  });

  describe('research mode', () => {
    it('should detect research for "find papers" patterns', () => {
      const result = detectChatMode('Find papers on machine learning');
      expect(result.mode).toBe('research');
    });

    it('should detect research for citation requests', () => {
      const result = detectChatMode('Can you cite sources for this claim?');
      expect(result.mode).toBe('research');
    });

    it('should detect research for recent research queries', () => {
      const result = detectChatMode('What are recent studies on climate change?');
      expect(result.mode).toBe('research');
    });
  });
});

describe('isDestructiveEdit', () => {
  it('should return true for delete all', () => {
    expect(isDestructiveEdit('Delete all paragraphs about methodology')).toBe(true);
  });

  it('should return true for remove everything', () => {
    expect(isDestructiveEdit('Remove everything after the introduction')).toBe(true);
  });

  it('should return false for non-destructive edits', () => {
    expect(isDestructiveEdit('Change the word "good" to "excellent"')).toBe(false);
  });
});
```

**Step 3: Run tests**

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add enhanced chat mode detection with patterns"
```

---

## Task 4.6: Global Edit API Route

**Files:**

- Create: `src/app/api/ai/global-edit/route.ts`
- Create: `src/lib/ai/diff-generator.ts`

**Step 1: Install diff library**

```bash
npm install diff
npm install -D @types/diff
```

**Step 2: Create diff generator**

Create `src/lib/ai/diff-generator.ts`:

```typescript
import { diffLines, Change } from 'diff';

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  value: string;
  lineNumber: number;
}

export function generateDiff(original: string, modified: string): DiffChange[] {
  const changes = diffLines(original, modified);
  const result: DiffChange[] = [];
  let lineNumber = 1;

  for (const change of changes) {
    const type: DiffChange['type'] = change.added ? 'add' : change.removed ? 'remove' : 'unchanged';

    result.push({
      type,
      value: change.value,
      lineNumber,
    });

    // Only increment line number for lines that exist in the result
    if (!change.removed) {
      lineNumber += (change.value.match(/\n/g) || []).length;
    }
  }

  return result;
}

export function applyDiffChanges(original: string, changes: DiffChange[], acceptedIndexes: number[]): string {
  const lines = original.split('\n');
  const result: string[] = [];

  let originalIndex = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const isAccepted = acceptedIndexes.includes(i);

    if (change.type === 'unchanged') {
      result.push(change.value);
    } else if (change.type === 'add' && isAccepted) {
      result.push(change.value);
    } else if (change.type === 'remove' && !isAccepted) {
      result.push(change.value);
    }
  }

  return result.join('');
}

export function getDiffStats(changes: DiffChange[]): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  return {
    additions: changes.filter((c) => c.type === 'add').length,
    deletions: changes.filter((c) => c.type === 'remove').length,
    unchanged: changes.filter((c) => c.type === 'unchanged').length,
  };
}
```

**Step 3: Create global edit API route**

Create `src/app/api/ai/global-edit/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
import { buildContext, formatContextForPrompt } from '@/lib/ai/context-builder';
import { createAIOperation } from '@/lib/api/ai-operations';
import { generateDiff } from '@/lib/ai/diff-generator';
import { z } from 'zod';

const requestSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  instruction: z.string().min(1).max(2000),
  currentContent: z.string(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { documentId, projectId, instruction, currentContent } = parsed.data;

  // Verify user owns document
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, project_id, projects!inner(user_id)')
    .eq('id', documentId)
    .single();

  if (docError || !doc || (doc.projects as any).user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create AI operation record for undo
  const operation = await createAIOperation({
    documentId,
    operationType: 'global',
    inputSummary: instruction,
    snapshotBefore: { content: currentContent },
  });

  // Build context
  const context = await buildContext(documentId, projectId, instruction);
  const contextPrompt = formatContextForPrompt(context);

  const prompt = `You are an expert editor. Apply the following instruction to the entire document.

INSTRUCTION: ${instruction}

CURRENT DOCUMENT:
${currentContent}

${contextPrompt}

Respond ONLY with the complete edited document. Do not include explanations, markdown code blocks, or anything else. Just the edited document content exactly as it should appear.`;

  // Stream the response
  const encoder = new TextEncoder();
  let fullContent = '';

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = streamClaude(
        prompt,
        (chunk) => {
          fullContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
        },
        async () => {
          // Generate diff
          const diff = generateDiff(currentContent, fullContent);

          // Update operation with output
          await supabase.from('ai_operations').update({ output_content: fullContent }).eq('id', operation.id);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                operationId: operation.id,
                modifiedContent: fullContent,
                diff,
              })}\n\n`
            )
          );
          controller.close();
        },
        (error) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`));
          controller.close();
        }
      );

      request.signal.addEventListener('abort', () => {
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add global edit API with diff generation"
```

---

## Task 4.7: Diff Panel Component

**Files:**

- Create: `src/components/editor/DiffPanel.tsx`
- Create: `src/components/editor/__tests__/DiffPanel.test.tsx`
- Create: `src/hooks/useDiffView.ts`

**Step 1: Create useDiffView hook**

Create `src/hooks/useDiffView.ts`:

```typescript
import { useState, useCallback } from 'react';
import { DiffChange } from '@/lib/ai/diff-generator';

interface DiffViewState {
  isVisible: boolean;
  originalContent: string;
  modifiedContent: string;
  changes: DiffChange[];
  operationId: string | null;
  acceptedIndexes: Set<number>;
  rejectedIndexes: Set<number>;
}

export function useDiffView() {
  const [state, setState] = useState<DiffViewState>({
    isVisible: false,
    originalContent: '',
    modifiedContent: '',
    changes: [],
    operationId: null,
    acceptedIndexes: new Set(),
    rejectedIndexes: new Set(),
  });

  const showDiff = useCallback(
    (data: { originalContent: string; modifiedContent: string; changes: DiffChange[]; operationId: string }) => {
      setState({
        isVisible: true,
        originalContent: data.originalContent,
        modifiedContent: data.modifiedContent,
        changes: data.changes,
        operationId: data.operationId,
        acceptedIndexes: new Set(),
        rejectedIndexes: new Set(),
      });
    },
    []
  );

  const hideDiff = useCallback(() => {
    setState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const acceptChange = useCallback((index: number) => {
    setState((prev) => {
      const acceptedIndexes = new Set(prev.acceptedIndexes);
      const rejectedIndexes = new Set(prev.rejectedIndexes);
      acceptedIndexes.add(index);
      rejectedIndexes.delete(index);
      return { ...prev, acceptedIndexes, rejectedIndexes };
    });
  }, []);

  const rejectChange = useCallback((index: number) => {
    setState((prev) => {
      const acceptedIndexes = new Set(prev.acceptedIndexes);
      const rejectedIndexes = new Set(prev.rejectedIndexes);
      rejectedIndexes.add(index);
      acceptedIndexes.delete(index);
      return { ...prev, acceptedIndexes, rejectedIndexes };
    });
  }, []);

  const acceptAll = useCallback(() => {
    setState((prev) => {
      const modifiedIndexes = prev.changes.map((c, i) => (c.type !== 'unchanged' ? i : -1)).filter((i) => i !== -1);
      return {
        ...prev,
        acceptedIndexes: new Set(modifiedIndexes),
        rejectedIndexes: new Set(),
      };
    });
  }, []);

  const rejectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      acceptedIndexes: new Set(),
      rejectedIndexes: new Set(),
      isVisible: false,
    }));
  }, []);

  return {
    ...state,
    showDiff,
    hideDiff,
    acceptChange,
    rejectChange,
    acceptAll,
    rejectAll,
  };
}
```

**Step 2: Create DiffPanel component**

Create `src/components/editor/DiffPanel.tsx`:

```typescript
'use client';

import { useMemo } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
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

  const modifiedChanges = useMemo(
    () => changes.filter(c => c.type !== 'unchanged'),
    [changes]
  );

  const allDecided = modifiedChanges.every((_, i) => {
    const originalIndex = changes.findIndex(c => c === modifiedChanges[i]);
    return acceptedIndexes.has(originalIndex) || rejectedIndexes.has(originalIndex);
  });

  const acceptedCount = acceptedIndexes.size;
  const totalModified = modifiedChanges.length;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="diff-panel"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Review Changes</h3>
            <p className="text-sm text-gray-500">
              {stats.additions} additions, {stats.deletions} deletions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRejectAll}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
              data-testid="diff-reject-all"
            >
              Reject All
            </button>
            <button
              onClick={onAcceptAll}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              data-testid="diff-accept-all"
            >
              Accept All
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600"
              data-testid="diff-close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 bg-gray-50 border-b" data-testid="diff-progress">
          <div className="flex items-center justify-between text-sm">
            <span>{acceptedCount} / {totalModified} changes reviewed</span>
            <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(acceptedCount / totalModified) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Changes list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {changes.map((change, index) => {
            if (change.type === 'unchanged') return null;

            const isAccepted = acceptedIndexes.has(index);
            const isRejected = rejectedIndexes.has(index);

            return (
              <div
                key={index}
                className={`border rounded-lg overflow-hidden ${
                  isAccepted ? 'border-green-300 bg-green-50' :
                  isRejected ? 'border-red-300 bg-red-50' :
                  'border-gray-200'
                }`}
                data-testid="diff-change"
                data-change-type={change.type}
                data-line-number={change.lineNumber}
              >
                <div className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        change.type === 'add'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {change.type === 'add' ? '+ Added' : '- Removed'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Line {change.lineNumber}
                      </span>
                    </div>
                    <pre className={`text-sm whitespace-pre-wrap font-mono ${
                      change.type === 'add'
                        ? 'text-green-800'
                        : 'text-red-800 line-through'
                    }`}>
                      {change.value}
                    </pre>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => onAcceptChange(index)}
                      className={`p-2 rounded ${
                        isAccepted
                          ? 'bg-green-600 text-white'
                          : 'hover:bg-green-100 text-green-600'
                      }`}
                      title="Accept change"
                      data-testid="accept-change"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => onRejectChange(index)}
                      className={`p-2 rounded ${
                        isRejected
                          ? 'bg-red-600 text-white'
                          : 'hover:bg-red-100 text-red-600'
                      }`}
                      title="Reject change"
                      data-testid="reject-change"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {allDecided && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={onApply}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Apply {acceptedCount} Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add diff panel component for global edits"
```

---

## Task 4.8: AI Operations History and Undo

**Files:**

- Create: `src/lib/api/ai-operations.ts`
- Create: `src/hooks/useAIUndo.ts`
- Create: `src/components/editor/AIUndoButton.tsx`

**Step 1: Create AI operations API helpers**

Create `src/lib/api/ai-operations.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type AIOperation = Database['public']['Tables']['ai_operations']['Row'];

export async function createAIOperation(data: {
  documentId: string;
  operationType: 'selection' | 'cursor' | 'global';
  inputSummary: string;
  snapshotBefore: { content: string; selection?: { from: number; to: number } };
}): Promise<AIOperation> {
  const supabase = await createClient();

  const { data: operation, error } = await supabase
    .from('ai_operations')
    .insert({
      document_id: data.documentId,
      operation_type: data.operationType,
      input_summary: data.inputSummary,
      snapshot_before: data.snapshotBefore,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return operation;
}

export async function updateAIOperationStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'partial',
  outputContent?: string
): Promise<AIOperation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ai_operations')
    .update({
      status,
      output_content: outputContent,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentOperations(documentId: string, limit = 10): Promise<AIOperation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ai_operations')
    .select('*')
    .eq('document_id', documentId)
    .in('status', ['accepted', 'partial'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getOperationById(id: string): Promise<AIOperation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('ai_operations').select('*').eq('id', id).single();

  if (error) return null;
  return data;
}
```

**Step 2: Create useAIUndo hook**

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

  // Load recent operations
  const loadOperations = useCallback(async () => {
    if (!documentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ai/operations?documentId=${documentId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      }
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

      // If no operationId, undo the most recent
      const targetOp = operationId ? operations.find((op) => op.id === operationId) : operations[0];

      if (!targetOp || !targetOp.snapshot_before) return;

      // Restore content from snapshot
      const snapshot = targetOp.snapshot_before as { content: string };
      editor.commands.setContent(snapshot.content);

      // Update operation status
      await fetch(`/api/ai/operations/${targetOp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });

      // Refresh operations list
      await loadOperations();
    },
    [editor, operations, loadOperations]
  );

  const addOperation = useCallback((operation: AIOperation) => {
    setOperations((prev) => [operation, ...prev].slice(0, 10));
  }, []);

  const canUndo = operations.length > 0;
  const lastOperation = operations[0];

  return {
    operations,
    isLoading,
    undoOperation,
    addOperation,
    canUndo,
    lastOperation,
    undoCount: operations.length,
  };
}
```

**Step 3: Create AIUndoButton component**

Create `src/components/editor/AIUndoButton.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Undo2, ChevronDown, History } from 'lucide-react';

interface AIOperation {
  id: string;
  operation_type: string;
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

export function AIUndoButton({
  canUndo,
  undoCount,
  lastOperation,
  onUndo,
  operations,
}: AIUndoButtonProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center">
        <button
          onClick={() => onUndo()}
          disabled={!canUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-l-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title={lastOperation ? `Undo: ${lastOperation.input_summary}` : 'No AI operations to undo'}
          data-testid="ai-undo-button"
        >
          <Undo2 size={16} />
          <span>Undo AI</span>
          {undoCount > 0 && (
            <span
              className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full"
              data-testid="undo-count"
            >
              {undoCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setShowHistory(!showHistory)}
          disabled={!canUndo}
          className="px-2 py-1.5 border-y border-r rounded-r-lg hover:bg-gray-100 disabled:opacity-50"
          data-testid="ai-history-toggle"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {showHistory && operations.length > 0 && (
        <div
          className="absolute top-full right-0 mt-1 w-80 bg-white border rounded-lg shadow-lg z-50"
          data-testid="ai-history-panel"
        >
          <div className="p-2 border-b">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <History size={14} />
              AI Operation History
            </h4>
          </div>
          <div className="max-h-64 overflow-y-auto" data-testid="ai-snapshot-list">
            {operations.map((op, index) => (
              <div
                key={op.id}
                className="p-3 border-b last:border-b-0 hover:bg-gray-50"
                data-testid="ai-snapshot"
                data-snapshot-id={op.id}
                data-operation={op.operation_type}
                data-timestamp={op.created_at}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {op.input_summary}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(op.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onUndo(op.id);
                      setShowHistory(false);
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
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

**Step 4: Create operations API route**

Create `src/app/api/ai/operations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentOperations } from '@/lib/api/ai-operations';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!documentId) {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 });
  }

  try {
    const operations = await getRecentOperations(documentId, limit);
    return NextResponse.json(operations);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}
```

Create `src/app/api/ai/operations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateAIOperationStatus } from '@/lib/api/ai-operations';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status, outputContent } = await request.json();

  try {
    const operation = await updateAIOperationStatus(params.id, status, outputContent);
    return NextResponse.json(operation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update operation' }, { status: 500 });
  }
}
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add AI operations history and undo functionality"
```

---

## Task 4.9: Integration - Connect Components to Editor

**Files:**

- Create: `src/contexts/DocumentEditorContext.tsx`
- Modify: `src/app/projects/[id]/documents/[docId]/page.tsx`

**Step 1: Create DocumentEditorContext**

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

  // Global edit state
  diffState: DiffState;
  showDiff: (data: Omit<DiffState, 'isVisible'>) => void;
  hideDiff: () => void;

  // Editor operations
  applyContent: (content: string) => void;
  getContent: () => string;
  getSelectedText: () => string;
  setEditorDisabled: (disabled: boolean) => void;
}

const DocumentEditorContext = createContext<DocumentEditorContextValue | null>(null);

export function DocumentEditorProvider({
  children,
  documentId,
  projectId,
}: {
  children: ReactNode;
  documentId: string;
  projectId: string;
}) {
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
    // Disable editor while diff is visible
    if (editorRef.current) {
      editorRef.current.setEditable(false);
    }
  }, []);

  const hideDiff = useCallback(() => {
    setDiffState(prev => ({ ...prev, isVisible: false }));
    // Re-enable editor
    if (editorRef.current) {
      editorRef.current.setEditable(true);
    }
  }, []);

  const applyContent = useCallback((content: string) => {
    if (editorRef.current) {
      editorRef.current.commands.setContent(content);
    }
  }, []);

  const getContent = useCallback(() => {
    return editorRef.current?.getHTML() ?? '';
  }, []);

  const getSelectedText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  }, []);

  const setEditorDisabled = useCallback((disabled: boolean) => {
    if (editorRef.current) {
      editorRef.current.setEditable(!disabled);
    }
  }, []);

  return (
    <DocumentEditorContext.Provider
      value={{
        editorRef,
        documentId,
        projectId,
        diffState,
        showDiff,
        hideDiff,
        applyContent,
        getContent,
        getSelectedText,
        setEditorDisabled,
      }}
    >
      {children}
    </DocumentEditorContext.Provider>
  );
}

export function useDocumentEditor() {
  const context = useContext(DocumentEditorContext);
  if (!context) {
    throw new Error('useDocumentEditor must be used within DocumentEditorProvider');
  }
  return context;
}
```

**Step 2: Update document page layout**

Update `src/app/projects/[id]/documents/[docId]/page.tsx`:

```typescript
import { ChatProvider } from '@/contexts/ChatContext';
import { DocumentEditorProvider } from '@/contexts/DocumentEditorContext';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DiffPanelWrapper } from '@/components/editor/DiffPanelWrapper';

interface PageProps {
  params: { id: string; docId: string };
}

export default async function DocumentPage({ params }: PageProps) {
  const { id: projectId, docId: documentId } = params;

  return (
    <ChatProvider>
      <DocumentEditorProvider documentId={documentId} projectId={projectId}>
        <div className="flex h-screen">
          <main className="flex-1 overflow-hidden">
            <DocumentEditor documentId={documentId} />
          </main>
          <ChatSidebar documentId={documentId} projectId={projectId} />
          <DiffPanelWrapper />
        </div>
      </DocumentEditorProvider>
    </ChatProvider>
  );
}
```

**Step 3: Create DiffPanelWrapper**

Create `src/components/editor/DiffPanelWrapper.tsx`:

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDocumentEditor } from '@/contexts/DocumentEditorContext';
import { DiffPanel } from './DiffPanel';
import { updateAIOperationStatus } from '@/lib/api/ai-operations';
import { applyDiffChanges } from '@/lib/ai/diff-generator';

export function DiffPanelWrapper() {
  const { diffState, hideDiff, applyContent } = useDocumentEditor();
  const [acceptedIndexes, setAcceptedIndexes] = useState<Set<number>>(new Set());
  const [rejectedIndexes, setRejectedIndexes] = useState<Set<number>>(new Set());

  const handleAcceptChange = useCallback((index: number) => {
    setAcceptedIndexes(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    setRejectedIndexes(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handleRejectChange = useCallback((index: number) => {
    setRejectedIndexes(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    setAcceptedIndexes(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handleAcceptAll = useCallback(() => {
    const allIndexes = diffState.changes
      .map((_, i) => i)
      .filter(i => diffState.changes[i].type !== 'unchanged');
    setAcceptedIndexes(new Set(allIndexes));
    setRejectedIndexes(new Set());
  }, [diffState.changes]);

  const handleRejectAll = useCallback(async () => {
    if (diffState.operationId) {
      await updateAIOperationStatus(diffState.operationId, 'rejected');
    }
    setAcceptedIndexes(new Set());
    setRejectedIndexes(new Set());
    hideDiff();
  }, [diffState.operationId, hideDiff]);

  const handleApply = useCallback(async () => {
    // Apply accepted changes
    const newContent = applyDiffChanges(
      diffState.originalContent,
      diffState.changes,
      Array.from(acceptedIndexes)
    );

    applyContent(newContent);

    // Update operation status
    if (diffState.operationId) {
      const status = acceptedIndexes.size === diffState.changes.filter(c => c.type !== 'unchanged').length
        ? 'accepted'
        : 'partial';
      await updateAIOperationStatus(diffState.operationId, status, newContent);
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

**Step 4: Commit**

```bash
git add .
git commit -m "feat: integrate chat and diff components with editor"
```

---

## Task 4.10: E2E Tests for Phase 4

**Files:**

- Create: `e2e/chat/chat-sidebar.spec.ts`
- Create: `e2e/diff/diff-panel.spec.ts`
- Create: `e2e/fixtures/claude-cli-mock.ts`

**Step 1: Create Claude CLI mock fixture**

Create `e2e/fixtures/claude-cli-mock.ts`:

```typescript
import { Page, Route } from '@playwright/test';

export interface MockClaudeResponse {
  content: string;
  streaming?: boolean;
  streamChunks?: string[];
  delay?: number;
  error?: { type: 'network' | 'timeout' | 'api'; message: string };
}

export class ClaudeCLIMock {
  private responses: Map<string, MockClaudeResponse> = new Map();

  registerResponse(promptPattern: string, response: MockClaudeResponse): void {
    this.responses.set(promptPattern, response);
  }

  async setupRoutes(page: Page): Promise<void> {
    await page.route('**/api/ai/chat', async (route) => {
      await this.handleChatRoute(route);
    });

    await page.route('**/api/ai/global-edit', async (route) => {
      await this.handleGlobalEditRoute(route);
    });
  }

  private async handleChatRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const message = postData.content || '';

    const mockResponse = this.findMatchingResponse(message);

    if (mockResponse?.error) {
      await this.simulateError(route, mockResponse.error);
      return;
    }

    if (mockResponse?.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }

    // Simulate SSE streaming
    const content = mockResponse?.content || 'Mock response';
    const chunks = mockResponse?.streamChunks || [content];

    let body = '';
    for (const chunk of chunks) {
      body += `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
    }
    body += `data: ${JSON.stringify({ type: 'done' })}\n\n`;

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    });
  }

  private async handleGlobalEditRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');

    const mockResponse = this.findMatchingResponse(postData.instruction || '');

    if (mockResponse?.error) {
      await this.simulateError(route, mockResponse.error);
      return;
    }

    const modifiedContent = mockResponse?.content || 'Modified content.';

    let body = `data: ${JSON.stringify({ type: 'content', content: modifiedContent })}\n\n`;
    body += `data: ${JSON.stringify({
      type: 'done',
      operationId: 'test-op-id',
      modifiedContent,
      diff: [
        { type: 'remove', value: postData.currentContent, lineNumber: 1 },
        { type: 'add', value: modifiedContent, lineNumber: 1 },
      ],
    })}\n\n`;

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    });
  }

  private async simulateError(route: Route, error: { type: string; message: string }): Promise<void> {
    if (error.type === 'network') {
      await route.abort('connectionfailed');
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: error.message }),
      });
    }
  }

  private findMatchingResponse(input: string): MockClaudeResponse | undefined {
    for (const [pattern, response] of this.responses) {
      if (input.toLowerCase().includes(pattern.toLowerCase())) {
        return response;
      }
    }
    return undefined;
  }
}

export const mockResponses = {
  simpleDiscussion: {
    content: 'This is a helpful response about your document.',
  },
  globalEdit: {
    content: 'The document has been updated with your requested changes.',
  },
  networkError: {
    content: '',
    error: { type: 'network' as const, message: 'Connection failed' },
  },
};
```

**Step 2: Create chat sidebar E2E tests**

Create `e2e/chat/chat-sidebar.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test.describe('Chat Sidebar', () => {
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page }) => {
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should open and close sidebar', async ({ page }) => {
    await page.goto('/projects/test-project/documents/test-doc');

    // Sidebar should be closed initially
    await expect(page.getByTestId('chat-sidebar')).not.toBeVisible();

    // Open sidebar
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Close sidebar
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).not.toBeVisible();
  });

  test('should send message and receive response', async ({ page }) => {
    claudeMock.registerResponse('hello', mockResponses.simpleDiscussion);

    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send message
    await page.getByTestId('chat-input').fill('Hello, can you help me?');
    await page.getByTestId('chat-send-button').click();

    // Check user message appears
    const messages = page.getByTestId('chat-message');
    await expect(messages.first()).toContainText('Hello, can you help me?');

    // Wait for response
    await expect(messages.nth(1)).toContainText('helpful response');
  });

  test('should detect global edit mode', async ({ page }) => {
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    // Type edit command
    await page.getByTestId('chat-input').fill('Change all headings to title case');

    // Check mode indicator
    const modeIndicator = page.getByTestId('chat-mode-indicator');
    await expect(modeIndicator).toHaveAttribute('data-mode', 'global_edit');
  });

  test('should handle error and allow retry', async ({ page }) => {
    claudeMock.registerResponse('error', mockResponses.networkError);

    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send message that will fail
    await page.getByTestId('chat-input').fill('error test');
    await page.getByTestId('chat-send-button').click();

    // Check error appears
    await expect(page.getByTestId('chat-error')).toBeVisible();

    // Retry button should be visible
    await expect(page.getByTestId('chat-retry')).toBeVisible();
  });
});
```

**Step 3: Create diff panel E2E tests**

Create `e2e/diff/diff-panel.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';

test.describe('Diff Panel', () => {
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page }) => {
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should show diff panel after global edit', async ({ page }) => {
    claudeMock.registerResponse('simplify', {
      content: 'Simplified content here.',
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send global edit request
    await page.getByTestId('chat-input').fill('Simplify all paragraphs');
    await page.getByTestId('chat-send-button').click();

    // Wait for diff panel
    await expect(page.getByTestId('diff-panel')).toBeVisible();
  });

  test('should accept all changes', async ({ page }) => {
    claudeMock.registerResponse('rewrite', {
      content: 'Completely rewritten content.',
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    await page.getByTestId('chat-input').fill('Rewrite everything');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Accept all
    await page.getByTestId('diff-accept-all').click();

    // Diff panel should close
    await expect(page.getByTestId('diff-panel')).not.toBeVisible();
  });

  test('should reject all changes', async ({ page }) => {
    claudeMock.registerResponse('reject', {
      content: 'This will be rejected.',
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    await page.getByTestId('chat-input').fill('Reject test');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Reject all
    await page.getByTestId('diff-reject-all').click();

    // Diff panel should close
    await expect(page.getByTestId('diff-panel')).not.toBeVisible();
  });

  test('should accept individual changes', async ({ page }) => {
    claudeMock.registerResponse('partial', {
      content: 'Line 1 changed.\n\nLine 2 changed.',
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();

    await page.getByTestId('chat-input').fill('Partial accept test');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible();

    // Accept first change
    const acceptButtons = page.getByTestId('accept-change');
    await acceptButtons.first().click();

    // Check progress updated
    await expect(page.getByTestId('diff-progress')).toContainText('1 /');
  });
});
```

**Step 4: Run E2E tests**

```bash
npm run test:e2e
```

**Step 5: Commit**

```bash
git add .
git commit -m "test: add E2E tests for chat and diff functionality"
```

---

## Phase 4 Complete

At this point you have:

- Chat sidebar with streaming responses
- Chat mode detection (discussion, global_edit, research)
- Global edit API with Claude CLI integration
- Diff panel for reviewing and accepting/rejecting changes
- AI operations history with undo capability
- Integration between chat and editor components
- Comprehensive E2E tests

**Verification checklist:**

- [ ] Chat sidebar opens/closes properly
- [ ] Messages stream in real-time
- [ ] Mode detection shows correct indicator
- [ ] Global edit shows diff panel
- [ ] Accept/reject individual changes works
- [ ] Accept/reject all changes works
- [ ] Undo button restores previous content
- [ ] All unit tests pass (`npm test`)
- [ ] All E2E tests pass (`npm run test:e2e`)

---

## Data Attributes Reference

Required `data-testid` attributes for testing:

### Chat Components

- `chat-sidebar`, `chat-sidebar-toggle`
- `chat-message-list`, `chat-message`
- `chat-input`, `chat-send-button`
- `chat-mode-indicator`
- `chat-loading`, `chat-error`, `chat-retry`
- `chat-cancel-stream`, `chat-clear-history`

### Diff Components

- `diff-panel`, `diff-change`
- `diff-accept-all`, `diff-reject-all`, `diff-close`
- `accept-change`, `reject-change`
- `diff-progress`

### AI History Components

- `ai-undo-button`, `undo-count`
- `ai-history-toggle`, `ai-history-panel`
- `ai-snapshot-list`, `ai-snapshot`, `restore-snapshot`
