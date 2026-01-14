# Task 4.10: Integration

> **Phase 4** | [← DiffPanel & AI Undo](./09-diff-panel-undo.md) | [Next: Tests →](./11-tests.md)

---

## Context

**This task creates the DocumentEditorContext and DiffPanelWrapper for coordinating editor state with diff review.** It connects all the chat and diff components into a cohesive editing experience.

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

## Verification Checklist

- [ ] DocumentEditorContext provides editor ref
- [ ] showDiff displays diff panel and disables editor
- [ ] hideDiff hides diff panel and re-enables editor
- [ ] DiffPanelWrapper manages accept/reject state
- [ ] Accept all/reject all work correctly
- [ ] Apply updates editor content
- [ ] Operation status updated on accept/reject
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 4.11: Tests](./11-tests.md)**.
