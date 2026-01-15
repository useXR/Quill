'use client';

import { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import type { SelectionState, SelectionTrackerStorage } from '@/components/editor/extensions/selection-tracker';

/**
 * Hook to subscribe to editor selection changes from the SelectionTracker extension.
 *
 * @param editor - The TipTap editor instance
 * @returns The current selection state, or null if no text is selected
 */
export function useEditorSelection(editor: Editor | null): SelectionState | null {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    if (!editor) {
      // Reset selection when editor is unmounted - this is intentional state sync
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection(null);
      return;
    }

    // Get the selection tracker storage (use bracket notation for TypeScript compatibility)
    const storage = (editor.storage as unknown as Record<string, unknown>)['selectionTracker'] as
      | SelectionTrackerStorage
      | undefined;

    if (!storage) {
      return;
    }

    // Sync initial selection from editor storage - intentional external state sync

    setSelection(storage.selection);

    // Subscribe to selection changes
    const listener = (newSelection: SelectionState | null) => {
      setSelection(newSelection);
    };

    storage.listeners.add(listener);

    return () => {
      storage.listeners.delete(listener);
    };
  }, [editor]);

  return selection;
}

export default useEditorSelection;
