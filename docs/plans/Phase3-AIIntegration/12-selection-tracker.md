# Task 3.12: TipTap Selection Tracker Extension

> **Phase 3** | [← Context Builder](./11-context-builder.md) | [Next: Selection Toolbar →](./13-selection-toolbar.md)

---

## Context

**This task creates a TipTap extension for tracking text selection changes.** This extension provides the foundation for the selection toolbar by monitoring selection state and notifying listeners when selections change.

### Prerequisites

- Pre-flight checklist completed
- TipTap already installed in the project

### What This Task Creates

- `src/components/editor/extensions/selection-tracker.ts` - TipTap extension
- `src/components/editor/extensions/__tests__/selection-tracker.test.ts` - Extension tests

### Tasks That Depend on This

- **Task 3.13** (Selection Toolbar) - uses selection state from this extension
- **Task 3.15** (Editor Integration) - uses this extension

### Parallel Tasks

This task can be done in parallel with:

- **Tasks 3.1-3.11** (AI infrastructure)

---

## Files to Create/Modify

- `src/components/editor/extensions/selection-tracker.ts` (create)
- `src/components/editor/extensions/__tests__/selection-tracker.test.ts` (create)

---

## Steps

### Step 1: Write the failing test

```typescript
// src/components/editor/extensions/__tests__/selection-tracker.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SelectionTracker } from '../selection-tracker';

describe('SelectionTracker', () => {
  it('should track selection changes', () => {
    const editor = new Editor({
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Test content for selection</p>',
    });

    // Set selection
    editor.commands.setTextSelection({ from: 4, to: 8 });

    const storage = editor.storage.selectionTracker;
    expect(storage.selection).not.toBeNull();
    expect(storage.selection?.text).toBe('Test');

    editor.destroy();
  });

  it('should clear selection when collapsed', () => {
    const editor = new Editor({
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Test content</p>',
    });

    editor.commands.setTextSelection({ from: 4, to: 8 });
    expect(editor.storage.selectionTracker.selection).not.toBeNull();

    editor.commands.setTextSelection(4);
    expect(editor.storage.selectionTracker.selection).toBeNull();

    editor.destroy();
  });

  it('should notify listeners on selection change', () => {
    const listener = vi.fn();
    const editor = new Editor({
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Test content</p>',
    });

    editor.storage.selectionTracker.listeners.add(listener);
    editor.commands.setTextSelection({ from: 4, to: 8 });

    expect(listener).toHaveBeenCalled();
    editor.destroy();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/editor/extensions/__tests__/selection-tracker.test.ts
```

**Expected:** FAIL (module not found)

### Step 3: Implement selection tracker

```typescript
// src/components/editor/extensions/selection-tracker.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SelectionState {
  from: number;
  to: number;
  text: string;
  rect: DOMRect | null;
}

export const SelectionTracker = Extension.create({
  name: 'selectionTracker',

  addStorage() {
    return {
      selection: null as SelectionState | null,
      listeners: new Set<(sel: SelectionState | null) => void>(),
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('selectionTracker'),
        view() {
          return {
            update(view) {
              const { selection } = view.state;
              const { from, to } = selection;

              if (from === to) {
                if (extension.storage.selection !== null) {
                  extension.storage.selection = null;
                  extension.storage.listeners.forEach((fn) => fn(null));
                }
                return;
              }

              const text = view.state.doc.textBetween(from, to, '\n');
              const start = view.coordsAtPos(from);
              const end = view.coordsAtPos(to);

              const rect = new DOMRect(start.left, start.top, end.right - start.left, end.bottom - start.top);

              const newSelection: SelectionState = { from, to, text, rect };
              extension.storage.selection = newSelection;
              extension.storage.listeners.forEach((fn) => fn(newSelection));
            },
          };
        },
      }),
    ];
  },
});
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/editor/extensions/__tests__/selection-tracker.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/editor/extensions/selection-tracker.ts src/components/editor/extensions/__tests__/selection-tracker.test.ts
git commit -m "feat(editor): add TipTap selection tracker extension"
```

---

## Verification Checklist

- [ ] `src/components/editor/extensions/selection-tracker.ts` exists
- [ ] `src/components/editor/extensions/__tests__/selection-tracker.test.ts` exists
- [ ] Tests pass: `npm test src/components/editor/extensions/__tests__/selection-tracker.test.ts`
- [ ] `SelectionTracker` extension is exported
- [ ] `SelectionState` interface is exported
- [ ] Selection state includes: from, to, text, rect
- [ ] Listeners are notified on selection changes
- [ ] Selection cleared when collapsed
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.13: Selection Toolbar](./13-selection-toolbar.md)**.
