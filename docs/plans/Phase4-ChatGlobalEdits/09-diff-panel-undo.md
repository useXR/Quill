# Task 4.9: DiffPanel & AI Undo

> **Phase 4** | [← ChatSidebar](./08-chat-sidebar.md) | [Next: Integration →](./10-integration.md)

---

## Context

**This task creates the DiffPanel component for reviewing changes and AI undo functionality.** Users can accept/reject individual changes and restore previous document states.

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
            <button
              onClick={onRejectAll}
              className="px-3 py-1.5 min-h-[44px] text-sm border rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
              data-testid="diff-reject-all"
            >
              Reject All
            </button>
            <button
              onClick={onAcceptAll}
              className="px-3 py-1.5 min-h-[44px] text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              data-testid="diff-accept-all"
            >
              Accept All
            </button>
            <button
              onClick={onClose}
              className="p-3 min-w-[44px] min-h-[44px] text-gray-400 hover:text-gray-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
              data-testid="diff-close"
              aria-label="Close diff panel"
            >
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
                  {/* Accept/Reject buttons with proper touch targets (Best Practice: 44x44px minimum) */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAcceptChange(index)}
                      className={`p-3 min-w-[44px] min-h-[44px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${isAccepted ? 'bg-green-600 text-white' : 'hover:bg-green-100 text-green-600'}`}
                      data-testid="accept-change"
                      aria-label="Accept this change"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => onRejectChange(index)}
                      className={`p-3 min-w-[44px] min-h-[44px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${isRejected ? 'bg-red-600 text-white' : 'hover:bg-red-100 text-red-600'}`}
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

### Step 3: Commit

```bash
git add src/hooks/useAIUndo.ts src/components/editor/AIUndoButton.tsx
git commit -m "feat: add AI undo functionality with history panel"
```

---

## Verification Checklist

- [ ] DiffPanel renders with changes
- [ ] Accept All / Reject All buttons work
- [ ] Individual accept/reject buttons work
- [ ] Progress counter updates correctly
- [ ] Apply button appears when all changes decided
- [ ] useAIUndo loads operations from API
- [ ] Undo restores previous content
- [ ] History panel shows operation list
- [ ] Restore from history works
- [ ] All tests pass
- [ ] Changes committed (2 commits for Tasks 25-26)

---

## Next Steps

After this task, proceed to **[Task 4.10: Integration](./10-integration.md)**.
