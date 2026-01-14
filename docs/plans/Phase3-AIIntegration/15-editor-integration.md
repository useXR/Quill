# Task 3.15: Integration with Editor

> **Phase 3** | [← E2E Tests](./14-e2e-tests.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task integrates all AI components into the main document editor.** This final integration task brings together the selection tracker, toolbar, and cursor prompt components into a cohesive editing experience.

### Prerequisites

- **Task 3.12** completed (Selection Tracker) - provides selection state
- **Task 3.13** completed (Selection Toolbar) - provides toolbar component

### What This Task Creates

- Updates `src/components/editor/DocumentEditor.tsx` to include AI features

### Tasks That Depend on This

- None (final implementation task)

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.14** (E2E Tests)

---

## Files to Create/Modify

- `src/components/editor/DocumentEditor.tsx` (modify)

---

## Steps

### Step 1: Create useEditorSelection hook

First, create a hook for consuming selection state:

```typescript
// src/components/editor/extensions/selection-tracker.ts
// Add to existing file:

import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useEditorSelection(editor: Editor | null): SelectionState | null {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    if (!editor) return;

    const tracker = editor.storage.selectionTracker;
    if (!tracker) return;

    // Set initial state
    setSelection(tracker.selection);

    // Subscribe to changes
    const listener = (sel: SelectionState | null) => setSelection(sel);
    tracker.listeners.add(listener);

    return () => {
      tracker.listeners.delete(listener);
    };
  }, [editor]);

  return selection;
}
```

### Step 2: Integrate all components

Update your existing DocumentEditor:

```typescript
// src/components/editor/DocumentEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SelectionTracker, useEditorSelection } from './extensions/selection-tracker';
import { SelectionToolbar } from './SelectionToolbar';
import { CursorPrompt } from './CursorPrompt';

interface DocumentEditorProps {
  projectId: string;
  documentId: string;
  initialContent?: string;
}

export function DocumentEditor({ projectId, documentId, initialContent }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      SelectionTracker,
    ],
    content: initialContent || '<p>Start writing...</p>',
  });

  const selection = useEditorSelection(editor);

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        className="prose max-w-none"
      />

      {editor && selection && (
        <SelectionToolbar
          editor={editor}
          selection={selection}
          projectId={projectId}
          documentId={documentId}
        />
      )}

      {editor && (
        <CursorPrompt
          editor={editor}
          projectId={projectId}
          documentId={documentId}
        />
      )}
    </div>
  );
}
```

### Step 3: Create CursorPrompt component (if not already created)

```typescript
// src/components/editor/CursorPrompt.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';

interface CursorPromptProps {
  editor: Editor;
  projectId: string;
  documentId: string;
}

export function CursorPrompt({ editor, projectId, documentId }: CursorPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');

  const store = useAIStore();
  const { startStream, cancel, content, isStreaming } = useAIStream({
    onChunk: (chunk) => store.appendOutput(chunk),
    onComplete: () => store.setStatus('preview'),
    onError: (err) => store.setError(err),
  });

  // Handle Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const snapshot = editor.getHTML();
    store.startOperation('cursor', prompt, snapshot);
    await startStream(prompt, documentId, projectId);
  }, [editor, prompt, store, startStream, documentId, projectId]);

  const handleAccept = useCallback(() => {
    if (!store.currentOperation?.output) return;

    editor.chain()
      .focus()
      .insertContent(store.currentOperation.output)
      .run();

    store.acceptOperation();
    setIsOpen(false);
    setPrompt('');
  }, [editor, store]);

  const handleCancel = useCallback(() => {
    cancel();
    store.rejectOperation();
    setIsOpen(false);
    setPrompt('');
  }, [cancel, store]);

  if (!isOpen) return null;

  const isPreview = store.currentOperation?.status === 'preview';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cursor-prompt-title"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 id="cursor-prompt-title" className="text-lg font-semibold mb-4">
          Generate Content
        </h2>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="What would you like to write?"
          className="w-full px-3 py-2 border rounded mb-4"
          autoFocus
        />

        {content && (
          <div
            data-testid="preview-panel"
            aria-live="polite"
            className="bg-gray-50 p-3 rounded mb-4 max-h-48 overflow-y-auto"
          >
            {content}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
          {!isPreview ? (
            <button
              onClick={handleGenerate}
              disabled={isStreaming || !prompt.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {isStreaming ? 'Generating...' : 'Generate'}
            </button>
          ) : (
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Verify integration

```bash
npm test
npm run build
npm run dev
```

Test manually:

1. Select text in editor - toolbar should appear
2. Click Refine - should stream response
3. Accept - should replace text
4. Press Cmd+K - should open cursor prompt
5. Enter prompt and generate - should stream
6. Accept - should insert at cursor

### Step 5: Commit

```bash
git add src/components/editor/DocumentEditor.tsx src/components/editor/CursorPrompt.tsx src/components/editor/extensions/selection-tracker.ts
git commit -m "feat(editor): integrate AI toolbar and cursor prompt"
```

---

## Verification Checklist

- [ ] `useEditorSelection` hook added to selection-tracker.ts
- [ ] DocumentEditor imports and uses SelectionTracker
- [ ] SelectionToolbar renders when text is selected
- [ ] CursorPrompt renders and responds to Cmd+K
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing confirms functionality
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[99-verification.md](./99-verification.md)** to verify the complete phase.
