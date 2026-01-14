# Phase 4: Chat & Global Edits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a document chat sidebar with intent detection, global edit capabilities with diff review, and AI operation history for undo functionality.

**Architecture:** React context-based state management for chat and editor coordination. SSE streaming for real-time AI responses. Diff-based change review allowing granular accept/reject of modifications. Snapshot-based undo system storing content before AI operations.

**Tech Stack:** Next.js 14, React 18, TipTap editor, Supabase (auth/DB), Claude CLI (streaming), Zod (validation), diff library, Playwright (E2E)

---

## Task 1: ChatContext Reducer - Initial State

**Files:**

- Create: `src/contexts/ChatContext.tsx`
- Test: `src/contexts/__tests__/ChatContext.test.tsx`

**Step 1: Write the failing test for initial state**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: FAIL with "Cannot find module '../ChatContext'"

**Step 3: Write minimal implementation**

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

**Step 4: Run test to verify it passes**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add ChatContext with initial state"
```

---

## Task 2: ChatContext Reducer - Toggle Sidebar

**Files:**

- Modify: `src/contexts/ChatContext.tsx`
- Modify: `src/contexts/__tests__/ChatContext.test.tsx`

**Step 1: Write the failing test for toggle**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: FAIL - isOpen still false after toggle

**Step 3: Update reducer with TOGGLE_SIDEBAR action**

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

**Step 4: Run test to verify it passes**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add sidebar toggle actions to ChatContext"
```

---

## Task 3: ChatContext Reducer - Add Message

**Files:**

- Modify: `src/contexts/ChatContext.tsx`
- Modify: `src/contexts/__tests__/ChatContext.test.tsx`

**Step 1: Write the failing test for adding messages**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: FAIL - messages still empty

**Step 3: Add ADD_MESSAGE action to reducer**

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

**Step 4: Run test to verify it passes**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add ADD_MESSAGE action to ChatContext"
```

---

## Task 4: ChatContext Reducer - Streaming Append

**Files:**

- Modify: `src/contexts/ChatContext.tsx`
- Modify: `src/contexts/__tests__/ChatContext.test.tsx`

**Step 1: Write the failing test for appending to streaming**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: FAIL - content still "Hello"

**Step 3: Add APPEND_TO_STREAMING action**

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

**Step 4: Run test to verify it passes**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: add streaming append action to ChatContext"
```

---

## Task 5: ChatContext Reducer - Remaining Actions

**Files:**

- Modify: `src/contexts/ChatContext.tsx`
- Modify: `src/contexts/__tests__/ChatContext.test.tsx`

**Step 1: Write tests for SET_MESSAGE_STATUS, SET_LOADING, SET_DOCUMENT, CLEAR_MESSAGES, SET_ERROR**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: FAIL - actions not recognized

**Step 3: Add remaining actions to reducer**

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

**Step 4: Run test to verify it passes**

Run: `npm test src/contexts/__tests__/ChatContext.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/ChatContext.tsx src/contexts/__tests__/ChatContext.test.tsx
git commit -m "feat: complete ChatContext reducer with all actions"
```

---

## Task 6: Intent Detection - Discussion Mode

**Files:**

- Create: `src/lib/ai/intent-detection.ts`
- Test: `src/lib/ai/__tests__/intent-detection.test.ts`

**Step 1: Write failing test for discussion mode detection**

Create `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectChatMode } from '../intent-detection';

describe('detectChatMode', () => {
  it('should return discussion mode for general questions', () => {
    const result = detectChatMode('Can you explain this paragraph?');
    expect(result.mode).toBe('discussion');
  });

  it('should return discussion mode for simple requests', () => {
    const result = detectChatMode('What do you think about this?');
    expect(result.mode).toBe('discussion');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/lib/ai/intent-detection.ts`:

```typescript
export type ChatMode = 'discussion' | 'global_edit' | 'research';

export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

export function detectChatMode(message: string): ModeDetectionResult {
  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add intent detection with discussion mode default"
```

---

## Task 7: Intent Detection - Global Edit Mode

**Files:**

- Modify: `src/lib/ai/intent-detection.ts`
- Modify: `src/lib/ai/__tests__/intent-detection.test.ts`

**Step 1: Write failing tests for global edit patterns**

Add to `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
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

  it('should detect edit for "rewrite entire" patterns', () => {
    const result = detectChatMode('Rewrite the entire introduction');
    expect(result.mode).toBe('global_edit');
  });

  it('should have high confidence for multiple edit pattern matches', () => {
    const result = detectChatMode('Change all headings throughout the entire document');
    expect(result.mode).toBe('global_edit');
    expect(result.confidence).toBe('high');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: FAIL - mode is still 'discussion'

**Step 3: Implement edit pattern detection**

Update `src/lib/ai/intent-detection.ts`:

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
  { pattern: /\brewrite\s+(the\s+)?(entire|whole|document)/i, weight: 3, description: 'rewrite document' },
  { pattern: /\bfix\s+(all|every)\s+/i, weight: 2, description: 'fix all' },
];

export function detectChatMode(message: string): ModeDetectionResult {
  let editScore = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, weight, description } of EDIT_PATTERNS) {
    if (pattern.test(message)) {
      editScore += weight;
      matchedPatterns.push(`edit:${description}`);
    }
  }

  const confidence: 'high' | 'medium' | 'low' = editScore >= 5 ? 'high' : editScore >= 3 ? 'medium' : 'low';

  if (editScore >= 2) {
    return { mode: 'global_edit', confidence, matchedPatterns };
  }

  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add global edit pattern detection"
```

---

## Task 8: Intent Detection - Research Mode

**Files:**

- Modify: `src/lib/ai/intent-detection.ts`
- Modify: `src/lib/ai/__tests__/intent-detection.test.ts`

**Step 1: Write failing tests for research patterns**

Add to `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
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

  it('should detect research for literature review requests', () => {
    const result = detectChatMode('Help me with the literature review on this topic');
    expect(result.mode).toBe('research');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: FAIL - returns 'discussion' instead of 'research'

**Step 3: Add research pattern detection**

Update `src/lib/ai/intent-detection.ts` to add research patterns:

```typescript
const RESEARCH_PATTERNS: Pattern[] = [
  {
    pattern: /\b(find|search\s+for|look\s+up)\s+.*(paper|study|article|research)/i,
    weight: 3,
    description: 'find papers',
  },
  { pattern: /\bcite|citation|reference\b/i, weight: 2, description: 'citation request' },
  {
    pattern: /\brecent\s+(papers?|studies?|research|findings?|publications?)\b/i,
    weight: 3,
    description: 'recent research',
  },
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
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add research mode pattern detection"
```

---

## Task 9: Intent Detection - Destructive Edit Warning

**Files:**

- Modify: `src/lib/ai/intent-detection.ts`
- Modify: `src/lib/ai/__tests__/intent-detection.test.ts`

**Step 1: Write failing tests for destructive edit detection**

Add to `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
import { detectChatMode, isDestructiveEdit } from '../intent-detection';

describe('isDestructiveEdit', () => {
  it('should return true for delete all', () => {
    expect(isDestructiveEdit('Delete all paragraphs about methodology')).toBe(true);
  });

  it('should return true for remove everything', () => {
    expect(isDestructiveEdit('Remove everything after the introduction')).toBe(true);
  });

  it('should return true for rewrite entire document', () => {
    expect(isDestructiveEdit('Rewrite the entire document')).toBe(true);
  });

  it('should return false for non-destructive edits', () => {
    expect(isDestructiveEdit('Change the word "good" to "excellent"')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: FAIL - isDestructiveEdit not exported

**Step 3: Add isDestructiveEdit function**

Add to `src/lib/ai/intent-detection.ts`:

```typescript
export function isDestructiveEdit(message: string): boolean {
  const destructivePatterns = [
    /\bdelete\s+(all|every|the\s+entire)/i,
    /\bremove\s+(all|every|everything|the\s+entire)/i,
    /\brewrite\s+(the\s+)?(entire|whole)/i,
    /\breplace\s+(all|everything)/i,
    /\bclear\s+(all|the\s+)/i,
  ];

  return destructivePatterns.some((p) => p.test(message));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add destructive edit detection for warnings"
```

---

## Task 10: ModeIndicator Component

**Files:**

- Create: `src/components/chat/ModeIndicator.tsx`
- Test: `src/components/chat/__tests__/ModeIndicator.test.tsx`

**Step 1: Write failing test for ModeIndicator**

Create `src/components/chat/__tests__/ModeIndicator.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeIndicator } from '../ModeIndicator';

describe('ModeIndicator', () => {
  it('should render discussion mode with correct label', () => {
    render(<ModeIndicator mode="discussion" />);
    expect(screen.getByText('Discussion')).toBeInTheDocument();
  });

  it('should render global_edit mode with correct label', () => {
    render(<ModeIndicator mode="global_edit" />);
    expect(screen.getByText('Global Edit')).toBeInTheDocument();
  });

  it('should render research mode with correct label', () => {
    render(<ModeIndicator mode="research" />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('should show confidence when not high', () => {
    render(<ModeIndicator mode="discussion" confidence="medium" />);
    expect(screen.getByText('(medium)')).toBeInTheDocument();
  });

  it('should have correct data-mode attribute', () => {
    render(<ModeIndicator mode="global_edit" />);
    expect(screen.getByTestId('chat-mode-indicator')).toHaveAttribute('data-mode', 'global_edit');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/chat/__tests__/ModeIndicator.test.tsx`
Expected: FAIL - module not found

**Step 3: Write ModeIndicator component**

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
  },
  global_edit: {
    icon: Edit3,
    label: 'Global Edit',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  research: {
    icon: Search,
    label: 'Research',
    color: 'text-green-600 bg-green-50 border-green-200',
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
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
      {confidence && confidence !== 'high' && (
        <span className="opacity-60">({confidence})</span>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/chat/__tests__/ModeIndicator.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/chat/ModeIndicator.tsx src/components/chat/__tests__/ModeIndicator.test.tsx
git commit -m "feat: add ModeIndicator component for chat modes"
```

---

## Task 11: ChatMessage Component

**Files:**

- Create: `src/components/chat/ChatMessage.tsx`
- Test: `src/components/chat/__tests__/ChatMessage.test.tsx`

**Step 1: Write failing test for ChatMessage**

Create `src/components/chat/__tests__/ChatMessage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  const baseProps = {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Hello world',
    timestamp: new Date('2024-01-01T12:00:00'),
    status: 'sent' as const,
  };

  it('should render user message with correct role indicator', () => {
    render(<ChatMessage {...baseProps} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('should render assistant message with Claude label', () => {
    render(<ChatMessage {...baseProps} role="assistant" />);
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('should show streaming cursor when streaming', () => {
    render(<ChatMessage {...baseProps} status="streaming" />);
    expect(screen.getByTestId('chat-message')).toHaveAttribute('data-streaming', 'true');
  });

  it('should show error state with retry button', () => {
    const onRetry = vi.fn();
    render(<ChatMessage {...baseProps} status="error" onRetry={onRetry} />);

    expect(screen.getByText('Failed to send')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should display mode indicator when mode provided', () => {
    render(<ChatMessage {...baseProps} mode="global_edit" />);
    expect(screen.getByTestId('chat-mode-indicator')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/chat/__tests__/ChatMessage.test.tsx`
Expected: FAIL - module not found

**Step 3: Write ChatMessage component**

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
          <span className="font-medium text-sm">{isUser ? 'You' : 'Claude'}</span>
          {mode && <ModeIndicator mode={mode} />}
          <span className="text-xs text-gray-400">{timestamp.toLocaleTimeString()}</span>
        </div>

        <div className={`text-sm whitespace-pre-wrap ${isError ? 'text-red-600' : 'text-gray-700'}`}>
          {content}
          {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-purple-400 animate-pulse" />}
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

**Step 4: Run test to verify it passes**

Run: `npm test src/components/chat/__tests__/ChatMessage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/chat/ChatMessage.tsx src/components/chat/__tests__/ChatMessage.test.tsx
git commit -m "feat: add ChatMessage component"
```

---

## Task 12: ChatInput Component

**Files:**

- Create: `src/components/chat/ChatInput.tsx`
- Test: `src/components/chat/__tests__/ChatInput.test.tsx`

**Step 1: Write failing test for ChatInput**

Create `src/components/chat/__tests__/ChatInput.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

// Mock intent detection
vi.mock('@/lib/ai/intent-detection', () => ({
  detectChatMode: (msg: string) => ({
    mode: msg.includes('change all') ? 'global_edit' : 'discussion',
    confidence: 'high',
    matchedPatterns: [],
  }),
}));

describe('ChatInput', () => {
  it('should render textarea and send button', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
  });

  it('should call onSend with message when send clicked', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('chat-send-button'));

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should clear input after sending', () => {
    render(<ChatInput onSend={vi.fn()} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('chat-send-button'));

    expect(input).toHaveValue('');
  });

  it('should send on Enter key', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should show cancel button when streaming', () => {
    const onCancel = vi.fn();
    render(<ChatInput onSend={vi.fn()} onCancel={onCancel} isStreaming />);

    expect(screen.getByTestId('chat-cancel-stream')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-cancel-stream'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/chat/__tests__/ChatInput.test.tsx`
Expected: FAIL - module not found

**Step 3: Write ChatInput component**

Create `src/components/chat/ChatInput.tsx`:

```typescript
'use client';

import { useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { ModeIndicator } from './ModeIndicator';
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
  const { mode: detectedMode } = detectChatMode(message);

  const handleSend = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
            className="flex-shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="chat-send-button"
          >
            <Send size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/chat/__tests__/ChatInput.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/chat/ChatInput.tsx src/components/chat/__tests__/ChatInput.test.tsx
git commit -m "feat: add ChatInput component with mode detection"
```

---

## Task 13: Diff Generator Library

**Files:**

- Create: `src/lib/ai/diff-generator.ts`
- Test: `src/lib/ai/__tests__/diff-generator.test.ts`

**Step 1: Install diff library**

```bash
npm install diff
npm install -D @types/diff
```

**Step 2: Write failing tests for diff generation**

Create `src/lib/ai/__tests__/diff-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateDiff, getDiffStats } from '../diff-generator';

describe('generateDiff', () => {
  it('should detect added lines', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';

    const diff = generateDiff(original, modified);
    const additions = diff.filter((d) => d.type === 'add');

    expect(additions.length).toBeGreaterThan(0);
  });

  it('should detect removed lines', () => {
    const original = 'Line 1\nLine 2\nLine 3';
    const modified = 'Line 1\nLine 3';

    const diff = generateDiff(original, modified);
    const removals = diff.filter((d) => d.type === 'remove');

    expect(removals.length).toBeGreaterThan(0);
  });

  it('should detect unchanged lines', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nLine 2';

    const diff = generateDiff(original, modified);
    const unchanged = diff.filter((d) => d.type === 'unchanged');

    expect(unchanged.length).toBeGreaterThan(0);
  });
});

describe('getDiffStats', () => {
  it('should count additions, deletions, and unchanged', () => {
    const diff = [
      { type: 'unchanged' as const, value: 'Line 1\n', lineNumber: 1 },
      { type: 'remove' as const, value: 'Old line\n', lineNumber: 2 },
      { type: 'add' as const, value: 'New line\n', lineNumber: 2 },
    ];

    const stats = getDiffStats(diff);

    expect(stats.additions).toBe(1);
    expect(stats.deletions).toBe(1);
    expect(stats.unchanged).toBe(1);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/diff-generator.test.ts`
Expected: FAIL - module not found

**Step 4: Write diff generator implementation**

Create `src/lib/ai/diff-generator.ts`:

```typescript
import { diffLines } from 'diff';

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

    if (!change.removed) {
      lineNumber += (change.value.match(/\n/g) || []).length;
    }
  }

  return result;
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

**Step 5: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/diff-generator.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/ai/diff-generator.ts src/lib/ai/__tests__/diff-generator.test.ts
git commit -m "feat: add diff generator library"
```

---

## Task 14: Apply Diff Changes Function

**Files:**

- Modify: `src/lib/ai/diff-generator.ts`
- Modify: `src/lib/ai/__tests__/diff-generator.test.ts`

**Step 1: Write failing test for applying changes**

Add to `src/lib/ai/__tests__/diff-generator.test.ts`:

```typescript
import { generateDiff, getDiffStats, applyDiffChanges } from '../diff-generator';

describe('applyDiffChanges', () => {
  it('should apply all accepted changes', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';
    const diff = generateDiff(original, modified);

    // Accept all changes (indexes of non-unchanged items)
    const acceptedIndexes = diff.map((d, i) => (d.type !== 'unchanged' ? i : -1)).filter((i) => i !== -1);

    const result = applyDiffChanges(original, diff, acceptedIndexes);

    expect(result).toBe(modified);
  });

  it('should keep original when no changes accepted', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';
    const diff = generateDiff(original, modified);

    const result = applyDiffChanges(original, diff, []);

    expect(result).toBe(original);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/diff-generator.test.ts`
Expected: FAIL - applyDiffChanges not exported

**Step 3: Implement applyDiffChanges**

Add to `src/lib/ai/diff-generator.ts`:

```typescript
export function applyDiffChanges(original: string, changes: DiffChange[], acceptedIndexes: number[]): string {
  const result: string[] = [];

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
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/diff-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/diff-generator.ts src/lib/ai/__tests__/diff-generator.test.ts
git commit -m "feat: add applyDiffChanges function"
```

---

## Task 15: Chat History API Helpers

**Files:**

- Create: `src/lib/api/chat.ts`
- Test: `src/lib/api/__tests__/chat.test.ts`

**Step 1: Write failing test for chat API helpers**

Create `src/lib/api/__tests__/chat.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { getChatHistory, saveChatMessage, clearChatHistory } from '../chat';
import { createClient } from '@/lib/supabase/server';

describe('Chat API helpers', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  describe('getChatHistory', () => {
    it('should fetch paginated chat history', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [{ id: '1', role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00Z' }],
        error: null,
      });

      const result = await getChatHistory('project-1', 'doc-1', { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].content).toBe('Hello');
      expect(result.hasMore).toBe(false);
    });
  });

  describe('saveChatMessage', () => {
    it('should save message and return it', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: '1', role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      const result = await saveChatMessage({
        projectId: 'project-1',
        documentId: 'doc-1',
        role: 'user',
        content: 'Hello',
      });

      expect(result.content).toBe('Hello');
      expect(result.role).toBe('user');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/api/__tests__/chat.test.ts`
Expected: FAIL - module not found

**Step 3: Write chat API helpers**

Create `src/lib/api/chat.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

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

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/api/__tests__/chat.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/api/chat.ts src/lib/api/__tests__/chat.test.ts
git commit -m "feat: add chat history API helpers"
```

---

## Task 16: AI Operations API Helpers

**Files:**

- Create: `src/lib/api/ai-operations.ts`
- Test: `src/lib/api/__tests__/ai-operations.test.ts`

**Step 1: Write failing test for AI operations helpers**

Create `src/lib/api/__tests__/ai-operations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createAIOperation, getRecentOperations, updateAIOperationStatus } from '../ai-operations';
import { createClient } from '@/lib/supabase/server';

describe('AI Operations helpers', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  describe('createAIOperation', () => {
    it('should create operation with snapshot', async () => {
      const mockOperation = {
        id: 'op-1',
        document_id: 'doc-1',
        operation_type: 'global',
        input_summary: 'Test edit',
        snapshot_before: { content: 'Original' },
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.single.mockResolvedValue({ data: mockOperation, error: null });

      const result = await createAIOperation({
        documentId: 'doc-1',
        operationType: 'global',
        inputSummary: 'Test edit',
        snapshotBefore: { content: 'Original' },
      });

      expect(result.id).toBe('op-1');
      expect(result.status).toBe('pending');
    });
  });

  describe('getRecentOperations', () => {
    it('should fetch recent accepted/partial operations', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [{ id: 'op-1', status: 'accepted' }],
        error: null,
      });

      const result = await getRecentOperations('doc-1', 10);

      expect(result).toHaveLength(1);
      expect(mockSupabase.in).toHaveBeenCalledWith('status', ['accepted', 'partial']);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/api/__tests__/ai-operations.test.ts`
Expected: FAIL - module not found

**Step 3: Write AI operations helpers**

Create `src/lib/api/ai-operations.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

interface AIOperation {
  id: string;
  document_id: string;
  operation_type: string;
  input_summary: string;
  snapshot_before: Record<string, unknown>;
  output_content: string | null;
  status: string;
  created_at: string;
}

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

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/api/__tests__/ai-operations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/api/ai-operations.ts src/lib/api/__tests__/ai-operations.test.ts
git commit -m "feat: add AI operations API helpers"
```

---

## Task 17: Claude CLI Streaming Helper

**Files:**

- Create: `src/lib/ai/streaming.ts`
- Test: `src/lib/ai/__tests__/streaming.test.ts`

**Step 1: Write failing test for streaming helper**

Create `src/lib/ai/__tests__/streaming.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { streamClaude } from '../streaming';

describe('streamClaude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should spawn claude CLI with correct arguments', () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as any).mockReturnValue(mockProc);

    streamClaude('test prompt', vi.fn(), vi.fn(), vi.fn());

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', 'test prompt', '--output-format', 'stream-json'],
      expect.any(Object)
    );
  });

  it('should return cleanup function that kills process', () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as any).mockReturnValue(mockProc);

    const cleanup = streamClaude('test', vi.fn(), vi.fn(), vi.fn());
    cleanup();

    expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/ai/__tests__/streaming.test.ts`
Expected: FAIL - module not found

**Step 3: Write streaming helper**

Create `src/lib/ai/streaming.ts`:

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

  return () => {
    killed = true;
    proc?.kill('SIGTERM');
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/ai/__tests__/streaming.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/streaming.ts src/lib/ai/__tests__/streaming.test.ts
git commit -m "feat: add Claude CLI streaming helper"
```

---

## Task 18: Chat History API Route

**Files:**

- Create: `src/app/api/chat/history/route.ts`
- Test: `src/app/api/chat/history/__tests__/route.test.ts`

**Step 1: Write failing test for chat history route**

Create `src/app/api/chat/history/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/chat', () => ({
  getChatHistory: vi.fn(() => ({ data: [], hasMore: false, nextCursor: null })),
  clearChatHistory: vi.fn(),
}));

describe('Chat History API Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });

    const request = new NextRequest('http://localhost/api/chat/history?projectId=123');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid projectId', async () => {
    const request = new NextRequest('http://localhost/api/chat/history?projectId=invalid');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should return chat history for valid request', async () => {
    const request = new NextRequest('http://localhost/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/chat/history/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: Create the route file**

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
  } catch {
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
  } catch {
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/chat/history/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/chat/history/route.ts src/app/api/chat/history/__tests__/route.test.ts
git commit -m "feat: add chat history API route with tests"
```

---

## Task 19: Streaming Chat API Route

**Files:**

- Create: `src/app/api/ai/chat/route.ts`
- Test: `src/app/api/ai/chat/__tests__/route.test.ts`

**Step 1: Write failing test for streaming chat route**

Create `src/app/api/ai/chat/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/chat', () => ({
  saveChatMessage: vi.fn(),
}));

vi.mock('@/lib/ai/streaming', () => ({
  streamClaude: vi.fn((prompt, onChunk, onComplete) => {
    onChunk('Hello');
    onComplete();
    return () => {};
  }),
}));

describe('Streaming Chat API Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ content: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return SSE stream for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/ai/chat/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: Create the streaming chat route**

Create `src/app/api/ai/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
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

  await saveChatMessage({ projectId, documentId, role: 'user', content });

  let systemPrompt = 'You are a helpful AI assistant for academic grant writing.';
  if (mode === 'global_edit') {
    systemPrompt += ' The user wants to make changes to their document.';
  } else if (mode === 'research') {
    systemPrompt += ' Help find relevant research and citations.';
  }

  const fullPrompt = `${systemPrompt}\n\nUser: ${content}`;
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
          await saveChatMessage({ projectId, documentId, role: 'assistant', content: fullResponse });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
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

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/ai/chat/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/ai/chat/route.ts src/app/api/ai/chat/__tests__/route.test.ts
git commit -m "feat: add streaming chat API route with tests"
```

---

## Task 20: Global Edit API Route

**Files:**

- Create: `src/app/api/ai/global-edit/route.ts`
- Test: `src/app/api/ai/global-edit/__tests__/route.test.ts`

**Step 1: Write failing test for global edit route**

Create `src/app/api/ai/global-edit/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn() })) })),
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  createAIOperation: vi.fn(() => ({ id: 'op-1' })),
}));

vi.mock('@/lib/ai/streaming', () => ({
  streamClaude: vi.fn((prompt, onChunk, onComplete) => {
    onChunk('Modified content');
    onComplete();
    return () => {};
  }),
}));

vi.mock('@/lib/ai/diff-generator', () => ({
  generateDiff: vi.fn(() => [{ type: 'add', value: 'Modified', lineNumber: 1 }]),
}));

describe('Global Edit API Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });

    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Test',
        currentContent: 'Content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing instruction', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({ currentContent: 'Content' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return SSE stream for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/ai/global-edit/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: Create the global edit route**

Create `src/app/api/ai/global-edit/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
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

  const operation = await createAIOperation({
    documentId,
    operationType: 'global',
    inputSummary: instruction,
    snapshotBefore: { content: currentContent },
  });

  const prompt = `You are an expert editor. Apply the following instruction to the document.

INSTRUCTION: ${instruction}

CURRENT DOCUMENT:
${currentContent}

Respond ONLY with the complete edited document. No explanations.`;

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
          const diff = generateDiff(currentContent, fullContent);

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

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/ai/global-edit/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/ai/global-edit/route.ts src/app/api/ai/global-edit/__tests__/route.test.ts
git commit -m "feat: add global edit API route with tests"
```

---

## Task 21a: AI Operations List API Route

**Files:**

- Create: `src/app/api/ai/operations/route.ts`
- Test: `src/app/api/ai/operations/__tests__/route.test.ts`

**Step 1: Write failing test for operations list route**

Create `src/app/api/ai/operations/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  getRecentOperations: vi.fn(() => [{ id: 'op-1', status: 'accepted' }]),
}));

describe('AI Operations List Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });
    const request = new NextRequest('http://localhost/api/ai/operations?documentId=doc-1');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 when documentId missing', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should return operations for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations?documentId=doc-1');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/ai/operations/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: Create operations list route**

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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/ai/operations/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/ai/operations/route.ts src/app/api/ai/operations/__tests__/route.test.ts
git commit -m "feat: add AI operations list route with tests"
```

---

## Task 21b: AI Operations Update API Route

**Files:**

- Create: `src/app/api/ai/operations/[id]/route.ts`
- Test: `src/app/api/ai/operations/[id]/__tests__/route.test.ts`

**Step 1: Write failing test for operation update route**

Create `src/app/api/ai/operations/[id]/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '../route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  updateAIOperationStatus: vi.fn(() => ({ id: 'op-1', status: 'accepted' })),
}));

describe('AI Operations Update Route', () => {
  it('should return 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValueOnce({
      auth: { getUser: () => ({ data: { user: null } }) },
    });
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: { id: 'op-1' } });
    expect(response.status).toBe(401);
  });

  it('should update operation status', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: { id: 'op-1' } });
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/ai/operations/[id]/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: Create operation update route**

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
  } catch {
    return NextResponse.json({ error: 'Failed to update operation' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/ai/operations/[id]/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/ai/operations/[id]/route.ts src/app/api/ai/operations/[id]/__tests__/route.test.ts
git commit -m "feat: add AI operations update route with tests"
```

---

## Task 22: Database Migration for Chat Indexes

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_chat_indexes.sql`

**Step 1: Create migration file**

Create `supabase/migrations/20260113000000_chat_indexes.sql`:

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

**Step 2: Apply migration**

```bash
npx supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260113000000_chat_indexes.sql
git commit -m "feat: add database indexes for chat and AI operations"
```

---

## Task 23: ChatSidebar Component

**Files:**

- Create: `src/components/chat/ChatSidebar.tsx`
- Test: `src/components/chat/__tests__/ChatSidebar.test.tsx`

**Step 1: Write failing test for ChatSidebar**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/components/chat/__tests__/ChatSidebar.test.tsx`
Expected: FAIL - module not found

**Step 3: Write ChatSidebar component**

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
}

export function ChatSidebar({ documentId, projectId }: ChatSidebarProps) {
  const { state, dispatch } = useChat();
  const { sendMessage, cancelStream, retryLastMessage, isLoading, isStreaming } = useStreamingChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatch({ type: 'SET_DOCUMENT', documentId, projectId });
  }, [documentId, projectId, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleToggle = () => dispatch({ type: 'TOGGLE_SIDEBAR' });

  const handleClearHistory = async () => {
    if (confirm('Clear all chat history?')) {
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
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-xl flex flex-col z-50" data-testid="chat-sidebar">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Document Chat</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleClearHistory} className="p-1 text-gray-400 hover:text-gray-600" data-testid="chat-clear-history">
            <Trash2 size={18} />
          </button>
          <button onClick={handleToggle} className="p-1 text-gray-400 hover:text-gray-600" data-testid="chat-sidebar-toggle">
            <X size={20} />
          </button>
        </div>
      </div>

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

**Step 4: Run test to verify it passes**

Run: `npm test src/components/chat/__tests__/ChatSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/chat/ChatSidebar.tsx src/components/chat/__tests__/ChatSidebar.test.tsx
git commit -m "feat: add ChatSidebar component"
```

---

## Task 24: useStreamingChat Hook

**Files:**

- Create: `src/hooks/useStreamingChat.ts`

**Step 1: Create the hook**

Create `src/hooks/useStreamingChat.ts`:

```typescript
import { useCallback, useRef } from 'react';
import { useChat } from '@/contexts/ChatContext';
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
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  dispatch({ type: 'APPEND_TO_STREAMING', id: assistantMessageId, chunk: data.content });
                } else if (data.type === 'done') {
                  dispatch({ type: 'SET_MESSAGE_STATUS', id: assistantMessageId, status: 'sent' });
                } else if (data.type === 'error') {
                  dispatch({ type: 'SET_MESSAGE_STATUS', id: assistantMessageId, status: 'error' });
                  dispatch({ type: 'SET_ERROR', error: data.message });
                }
              } catch {
                /* skip malformed */
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

**Step 2: Commit**

```bash
git add src/hooks/useStreamingChat.ts
git commit -m "feat: add useStreamingChat hook"
```

---

## Task 25: DiffPanel Component

**Files:**

- Create: `src/components/editor/DiffPanel.tsx`
- Test: `src/components/editor/__tests__/DiffPanel.test.tsx`

**Step 1: Write failing test**

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

**Step 2: Run test to verify it fails**

Run: `npm test src/components/editor/__tests__/DiffPanel.test.tsx`
Expected: FAIL - module not found

**Step 3: Write DiffPanel component**

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="diff-panel">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Review Changes</h3>
            <p className="text-sm text-gray-500">{stats.additions} additions, {stats.deletions} deletions</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRejectAll} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100" data-testid="diff-reject-all">
              Reject All
            </button>
            <button onClick={onAcceptAll} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700" data-testid="diff-accept-all">
              Accept All
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600" data-testid="diff-close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-b" data-testid="diff-progress">
          <span className="text-sm">{acceptedIndexes.size} / {modifiedChanges.length} changes reviewed</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {changes.map((change, index) => {
            if (change.type === 'unchanged') return null;
            const isAccepted = acceptedIndexes.has(index);
            const isRejected = rejectedIndexes.has(index);

            return (
              <div key={index} className={`border rounded-lg p-3 ${isAccepted ? 'border-green-300 bg-green-50' : isRejected ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} data-testid="diff-change">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2 py-0.5 text-xs rounded ${change.type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {change.type === 'add' ? '+ Added' : '- Removed'}
                    </span>
                    <pre className="mt-2 text-sm">{change.value}</pre>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onAcceptChange(index)} className={`p-2 rounded ${isAccepted ? 'bg-green-600 text-white' : 'hover:bg-green-100 text-green-600'}`} data-testid="accept-change">
                      <Check size={16} />
                    </button>
                    <button onClick={() => onRejectChange(index)} className={`p-2 rounded ${isRejected ? 'bg-red-600 text-white' : 'hover:bg-red-100 text-red-600'}`} data-testid="reject-change">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {allDecided && (
          <div className="p-4 border-t bg-gray-50">
            <button onClick={onApply} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Apply {acceptedIndexes.size} Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/editor/__tests__/DiffPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/editor/DiffPanel.tsx src/components/editor/__tests__/DiffPanel.test.tsx
git commit -m "feat: add DiffPanel component for reviewing changes"
```

---

## Task 26: useAIUndo Hook and AIUndoButton Component

**Files:**

- Create: `src/hooks/useAIUndo.ts`
- Create: `src/components/editor/AIUndoButton.tsx`

**Step 1: Create useAIUndo hook**

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

**Step 2: Create AIUndoButton component**

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

export function AIUndoButton({ canUndo, undoCount, lastOperation, onUndo, operations }: AIUndoButtonProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center">
        <button
          onClick={() => onUndo()}
          disabled={!canUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-l-lg hover:bg-gray-100 disabled:opacity-50"
          title={lastOperation ? `Undo: ${lastOperation.input_summary}` : 'No AI operations to undo'}
          data-testid="ai-undo-button"
        >
          <Undo2 size={16} />
          <span>Undo AI</span>
          {undoCount > 0 && <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full" data-testid="undo-count">{undoCount}</span>}
        </button>
        <button onClick={() => setShowHistory(!showHistory)} disabled={!canUndo} className="px-2 py-1.5 border-y border-r rounded-r-lg hover:bg-gray-100 disabled:opacity-50" data-testid="ai-history-toggle">
          <ChevronDown size={16} />
        </button>
      </div>

      {showHistory && operations.length > 0 && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-white border rounded-lg shadow-lg z-50" data-testid="ai-history-panel">
          <div className="p-2 border-b">
            <h4 className="font-medium text-sm flex items-center gap-2"><History size={14} />AI Operation History</h4>
          </div>
          <div className="max-h-64 overflow-y-auto" data-testid="ai-snapshot-list">
            {operations.map((op) => (
              <div key={op.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50" data-testid="ai-snapshot">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium truncate">{op.input_summary}</p>
                    <p className="text-xs text-gray-500">{new Date(op.created_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => { onUndo(op.id); setShowHistory(false); }} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200" data-testid="restore-snapshot">
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

**Step 3: Commit**

```bash
git add src/hooks/useAIUndo.ts src/components/editor/AIUndoButton.tsx
git commit -m "feat: add AI undo functionality with history panel"
```

---

## Task 27: Integration - DocumentEditorContext and Page Layout

**Files:**

- Create: `src/contexts/DocumentEditorContext.tsx`
- Create: `src/components/editor/DiffPanelWrapper.tsx`

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
    <DocumentEditorContext.Provider value={{ editorRef, documentId, projectId, diffState, showDiff, hideDiff, applyContent, getContent }}>
      {children}
    </DocumentEditorContext.Provider>
  );
}

export function useDocumentEditor() {
  const context = useContext(DocumentEditorContext);
  if (!context) throw new Error('useDocumentEditor must be used within DocumentEditorProvider');
  return context;
}
```

**Step 2: Create DiffPanelWrapper**

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

**Step 3: Commit**

```bash
git add src/contexts/DocumentEditorContext.tsx src/components/editor/DiffPanelWrapper.tsx
git commit -m "feat: add DocumentEditorContext and DiffPanelWrapper integration"
```

---

## Task 28: Run All Tests

**Step 1: Run unit tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Run type check**

```bash
npm run typecheck
```

Expected: No type errors

**Step 3: Commit if any fixes needed**

```bash
git add .
git commit -m "fix: resolve test and type issues"
```

---

## Task 29: E2E Test Infrastructure - Claude CLI Mock

**Files:**

- Create: `e2e/fixtures/claude-cli-mock.ts`

**Step 1: Write the mock fixture**

Create `e2e/fixtures/claude-cli-mock.ts`:

```typescript
import { Page, Route } from '@playwright/test';

export interface MockClaudeResponse {
  content: string;
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
    await page.route('**/api/ai/chat', (route) => this.handleChatRoute(route));
    await page.route('**/api/ai/global-edit', (route) => this.handleGlobalEditRoute(route));
  }

  private async handleChatRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const mockResponse = this.findMatchingResponse(postData.content || '');

    if (mockResponse?.error) {
      if (mockResponse.error.type === 'network') {
        await route.abort('connectionfailed');
      } else {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: mockResponse.error.message }) });
      }
      return;
    }

    if (mockResponse?.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }

    const content = mockResponse?.content || 'Mock response';
    const chunks = mockResponse?.streamChunks || [content];
    let body = '';
    for (const chunk of chunks) {
      body += `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
    }
    body += `data: ${JSON.stringify({ type: 'done' })}\n\n`;

    await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
  }

  private async handleGlobalEditRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const mockResponse = this.findMatchingResponse(postData.instruction || '');

    if (mockResponse?.error) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: mockResponse.error.message }) });
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

    await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
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
  simpleDiscussion: { content: 'This is a helpful response about your document.' },
  globalEdit: { content: 'The document has been updated with your requested changes.' },
  networkError: { content: '', error: { type: 'network' as const, message: 'Connection failed' } },
};
```

**Step 2: Commit**

```bash
git add e2e/fixtures/claude-cli-mock.ts
git commit -m "feat: add Claude CLI mock fixture for E2E tests"
```

---

## Task 30: E2E Tests - Chat Sidebar Basic

**Files:**

- Create: `e2e/chat/chat-sidebar.spec.ts`

**Step 1: Write chat sidebar E2E tests**

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
    await expect(page.getByTestId('chat-sidebar')).not.toBeVisible();
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).not.toBeVisible();
  });

  test('should send message and receive response', async ({ page }) => {
    claudeMock.registerResponse('hello', mockResponses.simpleDiscussion);
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Hello, can you help me?');
    await page.getByTestId('chat-send-button').click();

    const messages = page.getByTestId('chat-message');
    await expect(messages.first()).toContainText('Hello, can you help me?');
    await expect(messages.nth(1)).toContainText('helpful response');
  });

  test('should detect global edit mode', async ({ page }) => {
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Change all headings to title case');
    await expect(page.getByTestId('chat-mode-indicator')).toHaveAttribute('data-mode', 'global_edit');
  });

  test('should handle error and allow retry', async ({ page }) => {
    claudeMock.registerResponse('error', mockResponses.networkError);
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('error test');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-error')).toBeVisible();
    await expect(page.getByTestId('chat-retry')).toBeVisible();
  });

  test('should show empty state when no messages', async ({ page }) => {
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByText('Start a conversation')).toBeVisible();
  });
});
```

**Step 2: Run E2E test to verify setup**

Run: `npm run test:e2e e2e/chat/chat-sidebar.spec.ts`
Expected: Tests run (may fail if app not set up, but verifies test infrastructure)

**Step 3: Commit**

```bash
git add e2e/chat/chat-sidebar.spec.ts
git commit -m "test: add chat sidebar E2E tests"
```

---

## Task 31: E2E Tests - Diff Panel

**Files:**

- Create: `e2e/diff/diff-panel.spec.ts`

**Step 1: Write diff panel E2E tests**

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
    claudeMock.registerResponse('simplify', { content: 'Simplified content here.' });
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Simplify all paragraphs');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('diff-panel')).toBeVisible();
  });

  test('should accept all changes', async ({ page }) => {
    claudeMock.registerResponse('rewrite', { content: 'Completely rewritten content.' });
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Rewrite everything');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('diff-panel')).toBeVisible();
    await page.getByTestId('diff-accept-all').click();
    await expect(page.getByTestId('diff-panel')).not.toBeVisible();
  });

  test('should reject all changes', async ({ page }) => {
    claudeMock.registerResponse('reject', { content: 'This will be rejected.' });
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Reject test');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('diff-panel')).toBeVisible();
    await page.getByTestId('diff-reject-all').click();
    await expect(page.getByTestId('diff-panel')).not.toBeVisible();
  });

  test('should accept individual changes', async ({ page }) => {
    claudeMock.registerResponse('partial', { content: 'Line 1 changed.\n\nLine 2 changed.' });
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Partial accept test');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('diff-panel')).toBeVisible();
    await page.getByTestId('accept-change').first().click();
    await expect(page.getByTestId('diff-progress')).toContainText('1 /');
  });
});
```

**Step 2: Run E2E test**

Run: `npm run test:e2e e2e/diff/diff-panel.spec.ts`
Expected: Tests run

**Step 3: Commit**

```bash
git add e2e/diff/diff-panel.spec.ts
git commit -m "test: add diff panel E2E tests"
```

---

## Task 32: E2E Tests - AI Undo

**Files:**

- Create: `e2e/ai-undo/ai-undo.spec.ts`

**Step 1: Write AI undo E2E tests**

Create `e2e/ai-undo/ai-undo.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';

test.describe('AI Undo', () => {
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page }) => {
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should show undo button with operation count', async ({ page }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });
    await page.goto('/projects/test-project/documents/test-doc');

    // Perform AI edit
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Edit this document');
    await page.getByTestId('chat-send-button').click();
    await page.getByTestId('diff-accept-all').click();

    // Check undo button
    await expect(page.getByTestId('ai-undo-button')).toBeVisible();
    await expect(page.getByTestId('undo-count')).toContainText('1');
  });

  test('should restore content when undo clicked', async ({ page }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });
    await page.goto('/projects/test-project/documents/test-doc');

    // Perform edit and accept
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Edit this document');
    await page.getByTestId('chat-send-button').click();
    await page.getByTestId('diff-accept-all').click();

    // Click undo
    await page.getByTestId('ai-undo-button').click();

    // Verify undo count decremented
    await expect(page.getByTestId('undo-count')).not.toBeVisible();
  });

  test('should open history panel', async ({ page }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });
    await page.goto('/projects/test-project/documents/test-doc');

    // Perform edit
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Edit this document');
    await page.getByTestId('chat-send-button').click();
    await page.getByTestId('diff-accept-all').click();

    // Open history
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();
    await expect(page.getByTestId('ai-snapshot-list')).toBeVisible();
  });

  test('should restore specific snapshot from history', async ({ page }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });
    await page.goto('/projects/test-project/documents/test-doc');

    // Perform edit
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Edit this document');
    await page.getByTestId('chat-send-button').click();
    await page.getByTestId('diff-accept-all').click();

    // Open history and restore
    await page.getByTestId('ai-history-toggle').click();
    await page.getByTestId('restore-snapshot').first().click();

    // Verify history panel closed
    await expect(page.getByTestId('ai-history-panel')).not.toBeVisible();
  });
});
```

**Step 2: Run E2E test**

Run: `npm run test:e2e e2e/ai-undo/ai-undo.spec.ts`
Expected: Tests run

**Step 3: Commit**

```bash
git add e2e/ai-undo/ai-undo.spec.ts
git commit -m "test: add AI undo E2E tests"
```

---

## Task 33: E2E Tests - Error Handling

**Files:**

- Create: `e2e/chat/chat-errors.spec.ts`

**Step 1: Write error handling E2E tests**

Create `e2e/chat/chat-errors.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test.describe('Chat Error Handling', () => {
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page }) => {
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should display error message on network failure', async ({ page }) => {
    claudeMock.registerResponse('fail', mockResponses.networkError);
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('This will fail');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-error')).toBeVisible();
  });

  test('should show retry button after error', async ({ page }) => {
    claudeMock.registerResponse('retry', mockResponses.networkError);
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('retry test');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-retry')).toBeVisible();
  });

  test('should allow cancel during streaming', async ({ page }) => {
    claudeMock.registerResponse('slow', { content: 'Slow response', delay: 5000 });
    await page.goto('/projects/test-project/documents/test-doc');
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('slow request');
    await page.getByTestId('chat-send-button').click();

    // Should show cancel button during streaming
    await expect(page.getByTestId('chat-cancel-stream')).toBeVisible();
  });
});
```

**Step 2: Run E2E test**

Run: `npm run test:e2e e2e/chat/chat-errors.spec.ts`
Expected: Tests run

**Step 3: Commit**

```bash
git add e2e/chat/chat-errors.spec.ts
git commit -m "test: add chat error handling E2E tests"
```

---

## Task 34: Run All E2E Tests

**Step 1: Run complete E2E test suite**

```bash
npm run test:e2e
```

Expected: All E2E tests pass

**Step 2: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve E2E test issues"
```

---

## Phase 4 Complete

**Verification checklist:**

- [ ] Chat sidebar opens/closes properly
- [ ] Messages stream in real-time
- [ ] Mode detection shows correct indicator
- [ ] Global edit shows diff panel
- [ ] Accept/reject individual changes works
- [ ] Accept/reject all changes works
- [ ] Undo button restores previous content
- [ ] All unit tests pass (`npm test`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] All E2E tests pass (`npm run test:e2e`)

---

## Data Attributes Reference

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
