import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Represents the current selection state in the editor.
 */
export interface SelectionState {
  /** Start position of the selection in the document */
  from: number;
  /** End position of the selection in the document */
  to: number;
  /** The selected text content */
  text: string;
  /** Bounding rectangle of the selection (null if unavailable) */
  rect: DOMRect | null;
}

/**
 * Selection listener callback type.
 */
export type SelectionListener = (selection: SelectionState | null) => void;

/**
 * Storage interface for the SelectionTracker extension.
 */
export interface SelectionTrackerStorage {
  /** Current selection state, or null if collapsed */
  selection: SelectionState | null;
  /** Set of registered listeners */
  listeners: Set<SelectionListener>;
}

/**
 * Plugin key for the SelectionTracker ProseMirror plugin.
 */
export const selectionTrackerPluginKey = new PluginKey('selectionTracker');

/**
 * TipTap extension for tracking text selection changes.
 *
 * This extension monitors selection changes in the editor and notifies
 * registered listeners when the selection changes. It provides:
 * - Selection position (from/to)
 * - Selected text content
 * - Bounding rectangle for positioning UI elements
 *
 * @example
 * ```typescript
 * import { useEditor } from '@tiptap/react';
 * import { SelectionTracker } from './selection-tracker';
 *
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit,
 *     SelectionTracker,
 *   ],
 * });
 *
 * // Subscribe to selection changes
 * editor.storage.selectionTracker.listeners.add((selection) => {
 *   if (selection) {
 *     console.log('Selected:', selection.text);
 *   }
 * });
 * ```
 */
export const SelectionTracker = Extension.create<object, SelectionTrackerStorage>({
  name: 'selectionTracker',

  addStorage() {
    return {
      selection: null,
      listeners: new Set<SelectionListener>(),
    };
  },

  addProseMirrorPlugins() {
    // Store reference to storage to avoid eslint no-this-alias error
    const storage = this.storage;

    return [
      new Plugin({
        key: selectionTrackerPluginKey,
        view() {
          return {
            update(view) {
              const { selection } = view.state;
              const { from, to } = selection;

              // Collapsed selection (cursor without selection)
              if (from === to) {
                if (storage.selection !== null) {
                  storage.selection = null;
                  storage.listeners.forEach((fn) => fn(null));
                }
                return;
              }

              // Get selected text with newlines preserved between blocks
              const text = view.state.doc.textBetween(from, to, '\n');

              // Calculate bounding rectangle for the selection
              let rect: DOMRect | null = null;
              try {
                const start = view.coordsAtPos(from);
                const end = view.coordsAtPos(to);
                rect = new DOMRect(start.left, start.top, end.right - start.left, end.bottom - start.top);
              } catch {
                // coordsAtPos may fail in test environments or when DOM is not available
                rect = null;
              }

              const newSelection: SelectionState = { from, to, text, rect };

              // Check if selection actually changed to avoid unnecessary updates
              const currentSelection = storage.selection;
              if (
                currentSelection &&
                currentSelection.from === from &&
                currentSelection.to === to &&
                currentSelection.text === text
              ) {
                // Selection hasn't changed, skip notification
                return;
              }

              storage.selection = newSelection;
              storage.listeners.forEach((fn) => fn(newSelection));
            },
          };
        },
      }),
    ];
  },
});

export default SelectionTracker;
