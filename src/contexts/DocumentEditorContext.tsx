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
  setEditor: (editor: Editor | null) => void;
  documentId: string;
  projectId: string;
  diffState: DiffState;
  showDiff: (data: Omit<DiffState, 'isVisible'>) => void;
  hideDiff: () => void;
  applyContent: (content: string) => void;
  getContent: () => string;
}

const DocumentEditorContext = createContext<DocumentEditorContextValue | null>(null);

export function DocumentEditorProvider({
  children,
  documentId,
  projectId,
}: {
  children: ReactNode;
  documentId: string;
  projectId: string;
}) {
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
    setDiffState((prev) => ({ ...prev, isVisible: false }));
    editorRef.current?.setEditable(true);
  }, []);

  const setEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const applyContent = useCallback((content: string) => {
    if (!editorRef.current) return;

    // Use markdown parser if available, otherwise fall back to plain text handling
    if (editorRef.current.markdown) {
      const parsedContent = editorRef.current.markdown.parse(content);
      editorRef.current.commands.setContent(parsedContent);
      return;
    }

    // Fallback: Convert plain text to TipTap-compatible structure
    // Each paragraph is separated by double newlines, single newlines are soft breaks
    const paragraphs = content.split(/\n\n+/);
    const doc = {
      type: 'doc',
      content: paragraphs.map((para) => ({
        type: 'paragraph',
        content: para
          .split('\n')
          .flatMap((line, idx, arr) => {
            const nodes: Array<{ type: string; text?: string }> = [];
            if (line) {
              nodes.push({ type: 'text', text: line });
            }
            // Add hard break for single newlines within a paragraph (not at the end)
            if (idx < arr.length - 1) {
              nodes.push({ type: 'hardBreak' });
            }
            return nodes;
          })
          .filter((n) => n.type === 'hardBreak' || n.text),
      })),
    };

    editorRef.current.commands.setContent(doc);
  }, []);

  const getContent = useCallback(() => editorRef.current?.getHTML() ?? '', []);

  return (
    <DocumentEditorContext
      value={{ editorRef, setEditor, documentId, projectId, diffState, showDiff, hideDiff, applyContent, getContent }}
    >
      {children}
    </DocumentEditorContext>
  );
}

export function useDocumentEditor() {
  const context = useContext(DocumentEditorContext);
  if (!context) throw new Error('useDocumentEditor must be used within DocumentEditorProvider');
  return context;
}

/**
 * Safe version of useDocumentEditor that returns null when not in provider.
 * Useful for hooks that want optional integration with the editor context.
 */
export function useDocumentEditorSafe() {
  return useContext(DocumentEditorContext);
}
