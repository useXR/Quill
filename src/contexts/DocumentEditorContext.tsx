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

  const applyContent = useCallback((content: string) => {
    editorRef.current?.commands.setContent(content);
  }, []);

  const getContent = useCallback(() => editorRef.current?.getHTML() ?? '', []);

  return (
    <DocumentEditorContext
      value={{ editorRef, documentId, projectId, diffState, showDiff, hideDiff, applyContent, getContent }}
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
