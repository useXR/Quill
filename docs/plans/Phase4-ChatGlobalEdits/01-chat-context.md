# Task 4.1: ChatContext Reducer

> **Phase 4** | [← Overview](./00-overview.md) | [Next: Intent Detection →](./02-intent-detection.md)

---

## Context

**This task creates the ChatContext reducer for managing chat sidebar state.** It provides the foundation for all chat-related features including message management, sidebar visibility, and streaming state.

### Prerequisites

- Pre-flight checklist from [00-overview.md](./00-overview.md) completed

### What This Task Creates

- `src/contexts/ChatContext.tsx` - React context with reducer
- `src/contexts/__tests__/ChatContext.test.tsx` - Unit tests

### Tasks That Depend on This

- **Task 4.2** (Intent Detection) - Uses chat mode types
- **Task 4.3** (Chat Components) - Consumes ChatContext
- **Task 4.8** (ChatSidebar) - Uses ChatProvider and useChat hook

---

## Files to Create/Modify

- `src/contexts/ChatContext.tsx` (create)
- `src/contexts/__tests__/ChatContext.test.tsx` (create)

---

## Task 1: ChatContext Reducer - Initial State

### Step 1: Write the failing test for initial state

Create `src/contexts/__tests__/ChatContext.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ChatProvider, useChat } from '../ChatContext';

describe('ChatContext', () => {
  it('should provide initial state with empty messages', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.isLoading).toBe(false);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** FAIL with "Cannot find module '../ChatContext'"

### Step 3: Write minimal implementation

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

type ChatAction = { type: 'NOOP' };

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
  return state;
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

### Step 4: Run test to verify it passes

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add ChatContext with initial state"
```

---

## Task 2: ChatContext Reducer - Toggle Sidebar

### Step 1: Write the failing test for toggle

Add to `src/contexts/__tests__/ChatContext.test.tsx`:

```typescript
import { act } from '@testing-library/react';

it('should toggle sidebar open and closed', () => {
  const { result } = renderHook(() => useChat(), {
    wrapper: ChatProvider,
  });

  expect(result.current.state.isOpen).toBe(false);

  act(() => {
    result.current.dispatch({ type: 'TOGGLE_SIDEBAR' });
  });

  expect(result.current.state.isOpen).toBe(true);

  act(() => {
    result.current.dispatch({ type: 'TOGGLE_SIDEBAR' });
  });

  expect(result.current.state.isOpen).toBe(false);
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** FAIL - isOpen still false after toggle

### Step 3: Update reducer with TOGGLE_SIDEBAR action

Update `src/contexts/ChatContext.tsx` ChatAction type and reducer:

```typescript
type ChatAction = { type: 'TOGGLE_SIDEBAR' } | { type: 'OPEN_SIDEBAR' } | { type: 'CLOSE_SIDEBAR' };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_SIDEBAR':
      return { ...state, isOpen: true };
    case 'CLOSE_SIDEBAR':
      return { ...state, isOpen: false };
    default:
      return state;
  }
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add sidebar toggle actions to ChatContext"
```

---

## Task 3: ChatContext Reducer - Add Message

### Step 1: Write the failing test for adding messages

Add to `src/contexts/__tests__/ChatContext.test.tsx`:

```typescript
it('should add message to state', () => {
  const { result } = renderHook(() => useChat(), {
    wrapper: ChatProvider,
  });

  const message: ChatMessage = {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    createdAt: new Date(),
    status: 'sent',
  };

  act(() => {
    result.current.dispatch({ type: 'ADD_MESSAGE', message });
  });

  expect(result.current.state.messages).toHaveLength(1);
  expect(result.current.state.messages[0].content).toBe('Hello');
});

it('should set streamingMessageId when adding streaming message', () => {
  const { result } = renderHook(() => useChat(), {
    wrapper: ChatProvider,
  });

  const message: ChatMessage = {
    id: 'msg-streaming',
    role: 'assistant',
    content: '',
    createdAt: new Date(),
    status: 'streaming',
  };

  act(() => {
    result.current.dispatch({ type: 'ADD_MESSAGE', message });
  });

  expect(result.current.state.streamingMessageId).toBe('msg-streaming');
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** FAIL - messages still empty

### Step 3: Add ADD_MESSAGE action to reducer

Update ChatAction type and reducer in `src/contexts/ChatContext.tsx`:

```typescript
type ChatAction =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'OPEN_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'ADD_MESSAGE'; message: ChatMessage };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_SIDEBAR':
      return { ...state, isOpen: true };
    case 'CLOSE_SIDEBAR':
      return { ...state, isOpen: false };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
        streamingMessageId: action.message.status === 'streaming' ? action.message.id : state.streamingMessageId,
      };
    default:
      return state;
  }
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add ADD_MESSAGE action to ChatContext"
```

---

## Task 4: ChatContext Reducer - Streaming Append

### Step 1: Write the failing test for appending to streaming

Add to `src/contexts/__tests__/ChatContext.test.tsx`:

```typescript
it('should append content to streaming message', () => {
  const { result } = renderHook(() => useChat(), {
    wrapper: ChatProvider,
  });

  // Add initial streaming message
  act(() => {
    result.current.dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello',
        createdAt: new Date(),
        status: 'streaming',
      },
    });
  });

  // Append to it
  act(() => {
    result.current.dispatch({
      type: 'APPEND_TO_STREAMING',
      id: 'msg-1',
      chunk: ' World',
    });
  });

  expect(result.current.state.messages[0].content).toBe('Hello World');
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** FAIL - content still "Hello"

### Step 3: Add APPEND_TO_STREAMING action

Update ChatAction and reducer:

```typescript
type ChatAction =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'OPEN_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'APPEND_TO_STREAMING'; id: string; chunk: string };

// In reducer switch:
case 'APPEND_TO_STREAMING':
  return {
    ...state,
    messages: state.messages.map(m =>
      m.id === action.id ? { ...m, content: m.content + action.chunk } : m
    ),
  };
```

### Step 4: Run test to verify it passes

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add streaming append action to ChatContext"
```

---

## Task 5: ChatContext Reducer - Remaining Actions

### Step 1: Write tests for SET_MESSAGE_STATUS, SET_LOADING, SET_DOCUMENT, CLEAR_MESSAGES, SET_ERROR

Add to `src/contexts/__tests__/ChatContext.test.tsx`:

```typescript
it('should update message status', () => {
  const { result } = renderHook(() => useChat(), { wrapper: ChatProvider });

  act(() => {
    result.current.dispatch({
      type: 'ADD_MESSAGE',
      message: { id: 'msg-1', role: 'assistant', content: '', createdAt: new Date(), status: 'streaming' },
    });
  });

  act(() => {
    result.current.dispatch({ type: 'SET_MESSAGE_STATUS', id: 'msg-1', status: 'sent' });
  });

  expect(result.current.state.messages[0].status).toBe('sent');
  expect(result.current.state.streamingMessageId).toBeNull();
});

it('should set loading state', () => {
  const { result } = renderHook(() => useChat(), { wrapper: ChatProvider });

  act(() => {
    result.current.dispatch({ type: 'SET_LOADING', isLoading: true });
  });

  expect(result.current.state.isLoading).toBe(true);
});

it('should set document and clear messages', () => {
  const { result } = renderHook(() => useChat(), { wrapper: ChatProvider });

  act(() => {
    result.current.dispatch({
      type: 'ADD_MESSAGE',
      message: { id: 'msg-1', role: 'user', content: 'test', createdAt: new Date(), status: 'sent' },
    });
  });

  act(() => {
    result.current.dispatch({ type: 'SET_DOCUMENT', documentId: 'doc-1', projectId: 'proj-1' });
  });

  expect(result.current.state.documentId).toBe('doc-1');
  expect(result.current.state.projectId).toBe('proj-1');
  expect(result.current.state.messages).toEqual([]);
});

it('should set and clear error', () => {
  const { result } = renderHook(() => useChat(), { wrapper: ChatProvider });

  act(() => {
    result.current.dispatch({ type: 'SET_ERROR', error: 'Something failed' });
  });

  expect(result.current.state.error).toBe('Something failed');

  act(() => {
    result.current.dispatch({ type: 'SET_ERROR', error: null });
  });

  expect(result.current.state.error).toBeNull();
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** FAIL - actions not recognized

### Step 3: Add remaining actions to reducer

Update ChatAction type and reducer with all remaining actions:

```typescript
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

// Add cases to reducer:
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
case 'SET_DOCUMENT':
  return {
    ...state,
    documentId: action.documentId,
    projectId: action.projectId,
    messages: [],
  };
case 'CLEAR_MESSAGES':
  return { ...state, messages: [] };
case 'SET_ERROR':
  return { ...state, error: action.error };
case 'LOAD_MESSAGES':
  return { ...state, messages: action.messages };
case 'UPDATE_MESSAGE':
  return {
    ...state,
    messages: state.messages.map(m =>
      m.id === action.id ? { ...m, content: action.content } : m
    ),
  };
```

### Step 4: Run test to verify it passes

```bash
npm test src/contexts/__tests__/ChatContext.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: complete ChatContext reducer with all actions"
```

---

## Verification Checklist

- [ ] Initial state test passes
- [ ] Toggle sidebar test passes
- [ ] Add message test passes
- [ ] Streaming append test passes
- [ ] All remaining action tests pass
- [ ] All tests run without errors: `npm test src/contexts/__tests__/ChatContext.test.tsx`
- [ ] Changes committed (5 commits for Tasks 1-5)

---

## Next Steps

After this task, proceed to **[Task 4.2: Intent Detection](./02-intent-detection.md)**.
