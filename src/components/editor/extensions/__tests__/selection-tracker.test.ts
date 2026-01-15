import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SelectionTracker, SelectionListener, SelectionTrackerStorage } from '../selection-tracker';

/**
 * Helper to get the selection tracker storage with proper typing.
 * Uses bracket notation to avoid TypeScript errors with editor.storage type.
 */
function getStorage(editor: Editor): SelectionTrackerStorage {
  return (editor.storage as Record<string, unknown>)['selectionTracker'] as SelectionTrackerStorage;
}

describe('SelectionTracker Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    // Create a container element for the editor
    const element = document.createElement('div');
    document.body.appendChild(element);

    editor = new Editor({
      element,
      extensions: [StarterKit, SelectionTracker],
      content: '<p>Hello World! This is some test content for selection.</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
    // Clean up any remaining elements
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize with null selection', () => {
      expect(getStorage(editor).selection).toBeNull();
    });

    it('should initialize with empty listeners set', () => {
      expect(getStorage(editor).listeners).toBeInstanceOf(Set);
      expect(getStorage(editor).listeners.size).toBe(0);
    });

    it('should have the extension registered', () => {
      const extension = editor.extensionManager.extensions.find((ext) => ext.name === 'selectionTracker');
      expect(extension).toBeDefined();
    });
  });

  describe('Selection Tracking', () => {
    it('should track selection changes when text is selected', () => {
      // Select "Hello" (positions 1-6 in the document)
      editor.commands.setTextSelection({ from: 1, to: 6 });

      const selection = getStorage(editor).selection;
      expect(selection).not.toBeNull();
      expect(selection?.from).toBe(1);
      expect(selection?.to).toBe(6);
      expect(selection?.text).toBe('Hello');
    });

    it('should update selection when selection changes', () => {
      // First selection
      editor.commands.setTextSelection({ from: 1, to: 6 });
      expect(getStorage(editor).selection?.text).toBe('Hello');

      // Change selection to "World"
      editor.commands.setTextSelection({ from: 7, to: 12 });
      expect(getStorage(editor).selection?.text).toBe('World');
    });

    it('should track multi-word selections', () => {
      // Select "Hello World"
      editor.commands.setTextSelection({ from: 1, to: 12 });

      const selection = getStorage(editor).selection;
      expect(selection?.text).toBe('Hello World');
    });

    it('should include rect property (may be null in test environment)', () => {
      editor.commands.setTextSelection({ from: 1, to: 6 });

      const selection = getStorage(editor).selection;
      expect(selection).toHaveProperty('rect');
      // rect may be null in JSDOM since coordsAtPos may not work
    });
  });

  describe('Collapsed Selection (Cursor)', () => {
    it('should clear selection when collapsed (cursor position)', () => {
      // First make a selection
      editor.commands.setTextSelection({ from: 1, to: 6 });
      expect(getStorage(editor).selection).not.toBeNull();

      // Collapse to cursor position
      editor.commands.setTextSelection({ from: 3, to: 3 });
      expect(getStorage(editor).selection).toBeNull();
    });

    it('should remain null for cursor movements', () => {
      // Set cursor position (collapsed selection)
      editor.commands.setTextSelection({ from: 5, to: 5 });
      expect(getStorage(editor).selection).toBeNull();

      // Move cursor to another position
      editor.commands.setTextSelection({ from: 10, to: 10 });
      expect(getStorage(editor).selection).toBeNull();
    });
  });

  describe('Listener Notifications', () => {
    it('should notify listeners on selection change', () => {
      const listener = vi.fn<SelectionListener>();
      getStorage(editor).listeners.add(listener);

      editor.commands.setTextSelection({ from: 1, to: 6 });

      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall?.text).toBe('Hello');
    });

    it('should notify multiple listeners', () => {
      const listener1 = vi.fn<SelectionListener>();
      const listener2 = vi.fn<SelectionListener>();

      getStorage(editor).listeners.add(listener1);
      getStorage(editor).listeners.add(listener2);

      editor.commands.setTextSelection({ from: 1, to: 6 });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should notify listeners with null when selection is cleared', () => {
      const listener = vi.fn<SelectionListener>();
      getStorage(editor).listeners.add(listener);

      // Make a selection first
      editor.commands.setTextSelection({ from: 1, to: 6 });
      listener.mockClear();

      // Clear selection by collapsing
      editor.commands.setTextSelection({ from: 3, to: 3 });

      expect(listener).toHaveBeenCalledWith(null);
    });

    it('should allow removing listeners', () => {
      const listener = vi.fn<SelectionListener>();
      getStorage(editor).listeners.add(listener);

      // Remove the listener
      getStorage(editor).listeners.delete(listener);

      editor.commands.setTextSelection({ from: 1, to: 6 });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify when selection has not changed', () => {
      const listener = vi.fn<SelectionListener>();
      getStorage(editor).listeners.add(listener);

      // Make initial selection
      editor.commands.setTextSelection({ from: 1, to: 6 });
      const callCount = listener.mock.calls.length;

      // Set the same selection again
      editor.commands.setTextSelection({ from: 1, to: 6 });

      // Should not have additional calls for the same selection
      expect(listener.mock.calls.length).toBe(callCount);
    });
  });

  describe('SelectionState Interface', () => {
    it('should provide correct from position', () => {
      editor.commands.setTextSelection({ from: 3, to: 8 });
      expect(getStorage(editor).selection?.from).toBe(3);
    });

    it('should provide correct to position', () => {
      editor.commands.setTextSelection({ from: 3, to: 8 });
      expect(getStorage(editor).selection?.to).toBe(8);
    });

    it('should provide selected text', () => {
      editor.commands.setTextSelection({ from: 1, to: 12 });
      expect(getStorage(editor).selection?.text).toBe('Hello World');
    });

    it('should handle special characters in selection', () => {
      editor.commands.setContent('<p>Hello! How are you?</p>');
      editor.commands.setTextSelection({ from: 1, to: 7 });
      expect(getStorage(editor).selection?.text).toBe('Hello!');
    });
  });

  describe('Multi-paragraph Selection', () => {
    it('should handle selection across paragraphs', () => {
      editor.commands.setContent('<p>First paragraph</p><p>Second paragraph</p>');
      // Use selectAll to select across paragraphs
      editor.commands.selectAll();

      const selection = getStorage(editor).selection;
      expect(selection?.text).toContain('First');
      expect(selection?.text).toContain('Second');
    });

    it('should preserve newlines between paragraphs', () => {
      editor.commands.setContent('<p>Line 1</p><p>Line 2</p>');
      editor.commands.selectAll();

      const selection = getStorage(editor).selection;
      expect(selection?.text).toContain('\n');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty document', () => {
      editor.commands.setContent('');
      expect(getStorage(editor).selection).toBeNull();
    });

    it('should handle selection at document boundaries', () => {
      editor.commands.setContent('<p>Test</p>');
      editor.commands.selectAll();

      const selection = getStorage(editor).selection;
      expect(selection?.text).toBe('Test');
    });

    it('should handle rapid selection changes', () => {
      const listener = vi.fn<SelectionListener>();
      getStorage(editor).listeners.add(listener);

      // Rapidly change selections
      editor.commands.setTextSelection({ from: 1, to: 3 });
      editor.commands.setTextSelection({ from: 2, to: 5 });
      editor.commands.setTextSelection({ from: 3, to: 8 });

      // All changes should be tracked
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
