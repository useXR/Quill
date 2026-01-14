# Task 3.8: AI State Store (Zustand)

> **Phase 3** | [← Streaming Module](./07-streaming-module.md) | [Next: useAIStream Hook →](./09-use-ai-stream-hook.md)

---

## Context

**This task creates the Zustand store for managing AI operation state.** This centralized state management enables coordination between components during AI operations, tracks operation history, and supports undo functionality.

### Prerequisites

- **Task 3.1** completed (AI Type Definitions) - provides `ClaudeError` type

### What This Task Creates

- `src/lib/stores/ai-store.ts` - Zustand AI state store
- `src/lib/stores/__tests__/ai-store.test.ts` - Store tests

### Tasks That Depend on This

- **Task 3.10** (SSE API Route) - may use store for state coordination
- **Task 3.13** (Selection Toolbar) - uses store for UI state

### Design System: State-Driven Styling

UI components consuming this store should map `AIOperationStatus` to [Quill Design System](../../design-system.md) tokens:

| Status        | UI State                    | Design Tokens                                                                                  |
| ------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `'idle'`      | Default/ready state         | Normal button styling                                                                          |
| `'loading'`   | Spinner + disabled controls | `text-quill animate-spin`, `opacity-50 cursor-not-allowed`                                     |
| `'streaming'` | Live preview visible        | `font-prose`, streaming cursor with `bg-quill animate-pulse`                                   |
| `'preview'`   | Accept/Reject buttons       | Accept: `bg-quill hover:bg-quill-dark text-white`, Reject: `bg-surface-hover text-ink-primary` |
| `'error'`     | Error alert displayed       | `bg-error-light text-error-dark`, retry button if `retryable`                                  |

**Example status-driven component:**

```tsx
const statusClasses = {
  idle: '',
  loading: 'opacity-50 cursor-not-allowed',
  streaming: 'border-l-2 border-quill',
  preview: 'ring-2 ring-quill ring-offset-2',
  error: 'border-error bg-error-light/50',
};

<div className={`p-4 rounded-lg ${statusClasses[status]}`}>{/* Content */}</div>;
```

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.7** (Streaming Module)
- **Task 3.9** (useAIStream Hook)
- **Task 3.11** (Context Builder)

---

## Files to Create/Modify

- `src/lib/stores/ai-store.ts` (create)
- `src/lib/stores/__tests__/ai-store.test.ts` (create)
- `src/lib/stores/index.ts` (create/update - barrel export per Phase 2 patterns)

---

## Steps

### Step 1: Write the failing test

```typescript
// src/lib/stores/__tests__/ai-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '../ai-store';

describe('AI Store', () => {
  beforeEach(() => {
    useAIStore.getState().reset();
  });

  it('should start with no current operation', () => {
    expect(useAIStore.getState().currentOperation).toBeNull();
  });

  it('should start an operation', () => {
    const id = useAIStore.getState().startOperation('selection', 'test input');

    const { currentOperation } = useAIStore.getState();
    expect(currentOperation).not.toBeNull();
    expect(currentOperation?.id).toBe(id);
    expect(currentOperation?.type).toBe('selection');
    expect(currentOperation?.status).toBe('loading');
  });

  it('should append output', () => {
    useAIStore.getState().startOperation('cursor', 'test');
    useAIStore.getState().appendOutput('Hello ');
    useAIStore.getState().appendOutput('world');

    expect(useAIStore.getState().currentOperation?.output).toBe('Hello world');
    expect(useAIStore.getState().currentOperation?.status).toBe('streaming');
  });

  it('should accept operation and add to history', () => {
    useAIStore.getState().startOperation('selection', 'test');
    useAIStore.getState().setOutput('result');
    useAIStore.getState().acceptOperation();

    expect(useAIStore.getState().currentOperation).toBeNull();
    expect(useAIStore.getState().operationHistory).toHaveLength(1);
  });

  it('should reject operation without adding to history', () => {
    useAIStore.getState().startOperation('selection', 'test');
    useAIStore.getState().rejectOperation();

    expect(useAIStore.getState().currentOperation).toBeNull();
    expect(useAIStore.getState().operationHistory).toHaveLength(0);
  });

  it('should undo operation and return snapshot', () => {
    const id = useAIStore.getState().startOperation('selection', 'test', '<p>snapshot</p>');
    useAIStore.getState().setOutput('result');
    useAIStore.getState().acceptOperation();

    const snapshot = useAIStore.getState().undoOperation(id);

    expect(snapshot).toBe('<p>snapshot</p>');
    expect(useAIStore.getState().operationHistory).toHaveLength(0);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/stores/__tests__/ai-store.test.ts
```

**Expected:** FAIL with "Cannot find module '../ai-store'"

### Step 3: Write minimal implementation

```typescript
// src/lib/stores/ai-store.ts
import { create } from 'zustand';
import type { ClaudeError } from '@/lib/ai/types';
import { AI } from '@/lib/constants/ai';

export type AIOperationType = 'selection' | 'cursor' | 'global' | 'chat';
export type AIOperationStatus = 'idle' | 'loading' | 'streaming' | 'preview' | 'error';

export interface AIOperation {
  id: string;
  type: AIOperationType;
  status: AIOperationStatus;
  input: string;
  output: string;
  error?: ClaudeError;
  documentSnapshot?: string;
  createdAt: Date;
}

interface AIStore {
  currentOperation: AIOperation | null;
  operationHistory: AIOperation[];

  startOperation: (type: AIOperationType, input: string, snapshot?: string) => string;
  appendOutput: (content: string) => void;
  setOutput: (content: string) => void;
  setStatus: (status: AIOperationStatus) => void;
  setError: (error: ClaudeError) => void;
  acceptOperation: () => void;
  rejectOperation: () => void;
  undoOperation: (operationId: string) => string | null;
  reset: () => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  currentOperation: null,
  operationHistory: [],

  startOperation: (type, input, snapshot) => {
    const id = crypto.randomUUID();
    set({
      currentOperation: {
        id,
        type,
        status: 'loading',
        input,
        output: '',
        documentSnapshot: snapshot,
        createdAt: new Date(),
      },
    });
    return id;
  },

  appendOutput: (content) => {
    set((state) => ({
      currentOperation: state.currentOperation
        ? {
            ...state.currentOperation,
            output: state.currentOperation.output + content,
            status: 'streaming',
          }
        : null,
    }));
  },

  setOutput: (content) => {
    set((state) => ({
      currentOperation: state.currentOperation ? { ...state.currentOperation, output: content } : null,
    }));
  },

  setStatus: (status) => {
    set((state) => ({
      currentOperation: state.currentOperation ? { ...state.currentOperation, status } : null,
    }));
  },

  setError: (error) => {
    set((state) => ({
      currentOperation: state.currentOperation ? { ...state.currentOperation, status: 'error', error } : null,
    }));
  },

  acceptOperation: () => {
    const { currentOperation } = get();
    if (!currentOperation) return;

    set((state) => ({
      currentOperation: null,
      operationHistory: [...state.operationHistory, { ...currentOperation, status: 'idle' }].slice(
        -AI.MAX_OPERATION_HISTORY
      ),
    }));
  },

  rejectOperation: () => {
    set({ currentOperation: null });
  },

  undoOperation: (operationId) => {
    const op = get().operationHistory.find((o) => o.id === operationId);
    if (op?.documentSnapshot) {
      set((state) => ({
        operationHistory: state.operationHistory.filter((o) => o.id !== operationId),
      }));
      return op.documentSnapshot;
    }
    return null;
  },

  reset: () => {
    set({ currentOperation: null });
  },
}));
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/stores/__tests__/ai-store.test.ts
```

**Expected:** PASS

### Step 5: Create/update barrel export (per Phase 2 infrastructure patterns)

Per infrastructure best practices, every `src/lib/<module>/` must have an `index.ts` barrel export:

```typescript
// src/lib/stores/index.ts
// Barrel export for stores module

// AI Store
export { useAIStore } from './ai-store';
export type { AIOperation, AIOperationType, AIOperationStatus } from './ai-store';

// Add other store exports here as they are created
```

### Step 6: Commit

```bash
git add src/lib/stores/ai-store.ts src/lib/stores/__tests__/ai-store.test.ts src/lib/stores/index.ts
git commit -m "feat(store): add Zustand AI operation state management with barrel export"
```

---

## Verification Checklist

- [ ] `src/lib/stores/ai-store.ts` exists
- [ ] `src/lib/stores/__tests__/ai-store.test.ts` exists
- [ ] `src/lib/stores/index.ts` exists with barrel exports (per Phase 2 patterns)
- [ ] Tests pass: `npm test src/lib/stores/__tests__/ai-store.test.ts`
- [ ] `useAIStore` hook is exported from both store file and barrel
- [ ] Types are re-exported from barrel for external use
- [ ] Operation lifecycle works: start → append → accept/reject
- [ ] Undo functionality returns document snapshot
- [ ] History limited to `AI.MAX_OPERATION_HISTORY` operations (uses constants)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.9: useAIStream Hook](./09-use-ai-stream-hook.md)**.
