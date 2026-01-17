import { vi, type Mock } from 'vitest';
import type { TipTapDocument, TipTapNode } from '@/lib/supabase/types';

// ============================================
// MOCK FUNCTION TYPE
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn<T extends (...args: any[]) => any = (...args: any[]) => any> = Mock<T>;

// ============================================
// EDITOR STATE TYPES
// ============================================

export interface MockEditorState {
  doc: TipTapDocument;
  selection: MockSelection;
  storedMarks: MockMark[] | null;
}

export interface MockSelection {
  from: number;
  to: number;
  empty: boolean;
  $from: { pos: number };
  $to: { pos: number };
}

export interface MockMark {
  type: { name: string };
  attrs: Record<string, unknown>;
}

export interface MockTransaction {
  doc: TipTapDocument;
  selection: MockSelection;
  setMeta: MockFn;
  getMeta: MockFn;
  steps: unknown[];
}

// ============================================
// CHAIN COMMAND TYPES
// ============================================

export interface MockChainCommands {
  focus: MockFn;
  blur: MockFn;
  setContent: MockFn;
  clearContent: MockFn;
  insertContent: MockFn;
  insertContentAt: MockFn;
  setTextSelection: MockFn;
  selectAll: MockFn;
  deleteSelection: MockFn;
  deleteRange: MockFn;
  toggleBold: MockFn;
  toggleItalic: MockFn;
  toggleUnderline: MockFn;
  toggleStrike: MockFn;
  toggleCode: MockFn;
  toggleHeading: MockFn;
  toggleBulletList: MockFn;
  toggleOrderedList: MockFn;
  toggleBlockquote: MockFn;
  toggleCodeBlock: MockFn;
  toggleHighlight: MockFn;
  setTextAlign: MockFn;
  setHardBreak: MockFn;
  setHorizontalRule: MockFn;
  undo: MockFn;
  redo: MockFn;
  run: MockFn;
}

// ============================================
// MOCK EDITOR TYPE
// ============================================

export interface MockEditor {
  // State
  state: MockEditorState;
  view: {
    dom: HTMLElement;
    focus: MockFn;
    hasFocus: MockFn<() => boolean>;
  };
  options: {
    element: HTMLElement;
    content: TipTapDocument;
    editable: boolean;
  };
  storage: Record<string, unknown>;
  extensionManager: {
    extensions: unknown[];
  };

  // Content methods
  getHTML: MockFn<() => string>;
  getJSON: MockFn<() => TipTapDocument>;
  getText: MockFn<() => string>;
  getCharacterCount: MockFn<() => number>;
  isEmpty: boolean;

  // Commands
  commands: MockChainCommands;
  chain: MockFn<() => MockChainCommands>;
  can: MockFn;
  isActive: MockFn<(name: string, attrs?: Record<string, unknown>) => boolean>;

  // Lifecycle
  isEditable: boolean;
  isDestroyed: boolean;
  isFocused: boolean;
  destroy: MockFn;
  setEditable: MockFn<(value: boolean) => void>;

  // Events
  on: MockFn<(event: string, handler: (...args: unknown[]) => void) => MockEditor>;
  off: MockFn<(event: string, handler: (...args: unknown[]) => void) => MockEditor>;
  emit: MockFn<(event: string, ...args: unknown[]) => MockEditor>;

  // Internal helpers for tests
  _setContent: (content: TipTapDocument) => void;
  _setSelection: (from: number, to: number) => void;
  _eventHandlers: Map<string, Set<(...args: unknown[]) => void>>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create an empty TipTap document
 */
export function createEmptyDocument(): TipTapDocument {
  return {
    type: 'doc',
    content: [],
  };
}

/**
 * Create a simple paragraph node
 */
export function createParagraphNode(text: string, marks?: MockMark[]): TipTapNode {
  const node: TipTapNode = {
    type: 'paragraph',
    content: text
      ? [
          {
            type: 'text',
            text,
            marks: marks?.map((m) => ({ type: m.type.name, attrs: m.attrs })),
          },
        ]
      : [],
  };
  return node;
}

/**
 * Create a heading node
 */
export function createHeadingNode(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1): TipTapNode {
  return {
    type: 'heading',
    attrs: { level },
    content: text ? [{ type: 'text', text }] : [],
  };
}

/**
 * Create a document with paragraphs from text lines
 */
export function createDocumentFromText(lines: string[]): TipTapDocument {
  return {
    type: 'doc',
    content: lines.map((line) => createParagraphNode(line)),
  };
}

/**
 * Get plain text from a TipTap document
 */
export function getPlainTextFromDocument(doc: TipTapDocument): string {
  const extractText = (node: TipTapNode): string => {
    if (node.text) return node.text;
    if (!node.content) return '';
    return node.content.map(extractText).join('');
  };

  return doc.content.map(extractText).join('\n');
}

// ============================================
// MOCK EDITOR FACTORY
// ============================================

/**
 * Create chain commands that return themselves for chaining
 */
function createMockChainCommands(): MockChainCommands {
  const chain: MockChainCommands = {
    focus: vi.fn(),
    blur: vi.fn(),
    setContent: vi.fn(),
    clearContent: vi.fn(),
    insertContent: vi.fn(),
    insertContentAt: vi.fn(),
    setTextSelection: vi.fn(),
    selectAll: vi.fn(),
    deleteSelection: vi.fn(),
    deleteRange: vi.fn(),
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleUnderline: vi.fn(),
    toggleStrike: vi.fn(),
    toggleCode: vi.fn(),
    toggleHeading: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleBlockquote: vi.fn(),
    toggleCodeBlock: vi.fn(),
    toggleHighlight: vi.fn(),
    setTextAlign: vi.fn(),
    setHardBreak: vi.fn(),
    setHorizontalRule: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    run: vi.fn(),
  };

  // Make all methods return the chain for chaining
  for (const key of Object.keys(chain) as (keyof MockChainCommands)[]) {
    if (key !== 'run') {
      chain[key].mockReturnValue(chain);
    }
  }

  // run() executes the chain and returns success
  chain.run.mockReturnValue(true);

  return chain;
}

/**
 * Create a default selection
 */
function createDefaultSelection(): MockSelection {
  return {
    from: 0,
    to: 0,
    empty: true,
    $from: { pos: 0 },
    $to: { pos: 0 },
  };
}

export interface CreateMockEditorOptions {
  content?: TipTapDocument;
  editable?: boolean;
  element?: HTMLElement;
}

/**
 * Create a fully mocked TipTap editor instance
 */
export function createMockEditor(options: CreateMockEditorOptions = {}): MockEditor {
  const { content = createEmptyDocument(), editable = true, element = document.createElement('div') } = options;

  const eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const state: MockEditorState = {
    doc: content,
    selection: createDefaultSelection(),
    storedMarks: null,
  };

  const chainCommands = createMockChainCommands();

  const editor: MockEditor = {
    // State
    state,
    view: {
      dom: element,
      focus: vi.fn(),
      hasFocus: vi.fn().mockReturnValue(false),
    },
    options: {
      element,
      content,
      editable,
    },
    storage: {},
    extensionManager: {
      extensions: [],
    },

    // Content methods
    getHTML: vi.fn().mockReturnValue(''),
    getJSON: vi.fn().mockImplementation(() => state.doc),
    getText: vi.fn().mockImplementation(() => getPlainTextFromDocument(state.doc)),
    getCharacterCount: vi.fn().mockImplementation(() => getPlainTextFromDocument(state.doc).length),
    isEmpty: content.content.length === 0,

    // Commands
    commands: chainCommands,
    chain: vi.fn().mockReturnValue(chainCommands),
    can: vi.fn().mockReturnValue({
      chain: vi.fn().mockReturnValue({
        ...chainCommands,
        run: vi.fn().mockReturnValue(true),
      }),
    }),
    isActive: vi.fn().mockReturnValue(false),

    // Lifecycle
    isEditable: editable,
    isDestroyed: false,
    isFocused: false,
    destroy: vi.fn(),
    setEditable: vi.fn((value: boolean) => {
      editor.isEditable = value;
      editor.options.editable = value;
    }),

    // Events
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
      return editor;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      eventHandlers.get(event)?.delete(handler);
      return editor;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      eventHandlers.get(event)?.forEach((handler) => handler(...args));
      return editor;
    }),

    // Internal helpers
    _setContent: (newContent: TipTapDocument) => {
      state.doc = newContent;
      editor.options.content = newContent;
      editor.isEmpty = newContent.content.length === 0;
      editor.getJSON.mockReturnValue(newContent);
      editor.getText.mockReturnValue(getPlainTextFromDocument(newContent));
      editor.getCharacterCount.mockReturnValue(getPlainTextFromDocument(newContent).length);
    },
    _setSelection: (from: number, to: number) => {
      state.selection = {
        from,
        to,
        empty: from === to,
        $from: { pos: from },
        $to: { pos: to },
      };
    },
    _eventHandlers: eventHandlers,
  };

  // Wire up setContent command to actually update state
  chainCommands.setContent.mockImplementation((newContent: TipTapDocument) => {
    editor._setContent(newContent);
    return chainCommands;
  });

  chainCommands.clearContent.mockImplementation(() => {
    editor._setContent(createEmptyDocument());
    return chainCommands;
  });

  return editor;
}

/**
 * Simulate editor update event
 */
export function simulateEditorUpdate(editor: MockEditor, content?: TipTapDocument): void {
  if (content) {
    editor._setContent(content);
  }
  editor.emit('update', { editor, transaction: { doc: editor.state.doc } });
}

/**
 * Simulate editor focus event
 */
export function simulateEditorFocus(editor: MockEditor): void {
  editor.isFocused = true;
  editor.view.hasFocus.mockReturnValue(true);
  editor.emit('focus', { editor });
}

/**
 * Simulate editor blur event
 */
export function simulateEditorBlur(editor: MockEditor): void {
  editor.isFocused = false;
  editor.view.hasFocus.mockReturnValue(false);
  editor.emit('blur', { editor });
}

/**
 * Simulate selection change event
 */
export function simulateSelectionChange(editor: MockEditor, from: number, to: number): void {
  editor._setSelection(from, to);
  editor.emit('selectionUpdate', { editor, transaction: { selection: editor.state.selection } });
}
