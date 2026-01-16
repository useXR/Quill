'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from './extensions';
import { Toolbar } from './Toolbar';
import { WordCount } from './WordCount';
import { SelectionToolbar } from './SelectionToolbar';
import { useWordCount } from '@/hooks/useWordCount';
import { useEditorSelection } from '@/hooks/useEditorSelection';
import { useDocumentEditorSafe } from '@/contexts/DocumentEditorContext';
import { EDITOR } from '@/lib/constants';

export interface WordCountData {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  percentage: number | null;
  charPercentage: number | null;
  isNearLimit: boolean;
  isOverLimit: boolean;
  isCharNearLimit: boolean;
  isCharOverLimit: boolean;
}

export interface EditorProps {
  content?: string | object;
  placeholder?: string;
  characterLimit?: number;
  wordLimit?: number;
  warningThreshold?: number;
  onChange?: (html: string, json: object) => void;
  onWordCountChange?: (data: WordCountData) => void;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
  showWordCount?: boolean;
  /** Enable AI features (selection toolbar) */
  enableAI?: boolean;
  /** Project ID for AI context (required if enableAI is true) */
  projectId?: string;
  /** Document ID for AI context (required if enableAI is true) */
  documentId?: string;
  /** Document title for export filename */
  documentTitle?: string;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  wordLimit,
  warningThreshold = EDITOR.DEFAULT_WORD_WARNING_THRESHOLD,
  onChange,
  onWordCountChange,
  editable = true,
  className = '',
  showToolbar = true,
  showWordCount = true,
  enableAI = false,
  projectId,
  documentId,
  documentTitle,
}: EditorProps) {
  const {
    wordCount,
    charCount,
    charCountNoSpaces,
    percentage,
    charPercentage,
    isNearLimit,
    isOverLimit,
    isCharNearLimit,
    isCharOverLimit,
    updateCount,
  } = useWordCount({
    wordLimit,
    charLimit: characterLimit,
    warningThreshold,
  });

  const editor = useEditor({
    extensions: createExtensions({ placeholder, characterLimit }),
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      onChange?.(html, json);
      updateCount(html);
    },
    editorProps: {
      attributes: {
        class: `prose prose-lg max-w-none focus:outline-none min-h-[300px] p-6 lg:p-8 ${className}`,
        style: 'font-family: var(--font-prose); color: var(--color-ink-primary);',
        role: 'textbox',
        'aria-label': 'Document editor',
        'aria-multiline': 'true',
      },
    },
  });

  // Wire up editor to context for AI chat integration
  const documentEditorContext = useDocumentEditorSafe();
  useEffect(() => {
    if (documentEditorContext && editor) {
      documentEditorContext.setEditor(editor);
    }
    return () => {
      if (documentEditorContext) {
        documentEditorContext.setEditor(null);
      }
    };
  }, [editor, documentEditorContext]);

  useEffect(() => {
    // Only update word count from initial content if it's a string (HTML)
    // If content is an object (TipTap JSON), the editor's onUpdate will handle it
    if (content && typeof content === 'string') {
      updateCount(content);
    }
  }, [content, updateCount]);

  // When editor is ready with JSON content, update the word count
  useEffect(() => {
    if (editor && content && typeof content === 'object') {
      // Give the editor time to render the content
      const timer = setTimeout(() => {
        updateCount(editor.getHTML());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editor, content, updateCount]);

  useEffect(() => {
    onWordCountChange?.({
      wordCount,
      charCount,
      charCountNoSpaces,
      percentage,
      charPercentage,
      isNearLimit,
      isOverLimit,
      isCharNearLimit,
      isCharOverLimit,
    });
  }, [
    wordCount,
    charCount,
    charCountNoSpaces,
    percentage,
    charPercentage,
    isNearLimit,
    isOverLimit,
    isCharNearLimit,
    isCharOverLimit,
    onWordCountChange,
  ]);

  // Get selection state for AI toolbar
  const selection = useEditorSelection(editor);

  if (!editor) return null;

  return (
    <div
      data-testid="document-editor"
      className="border border-[var(--color-ink-faint)] rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-warm-md)] overflow-hidden"
    >
      {showToolbar && <Toolbar editor={editor} documentId={documentId} documentTitle={documentTitle} />}
      <div className="bg-[var(--color-editor-bg)] relative">
        <EditorContent editor={editor} />
        {enableAI && projectId && documentId && (
          <SelectionToolbar editor={editor} selection={selection} projectId={projectId} documentId={documentId} />
        )}
      </div>
      {showWordCount && (
        <div className="px-4 py-2 border-t border-[var(--color-ink-faint)] bg-[var(--color-bg-secondary)]">
          <WordCount
            wordCount={wordCount}
            charCount={charCount}
            percentage={percentage}
            charPercentage={charPercentage}
            isNearLimit={isNearLimit}
            isOverLimit={isOverLimit}
            isCharNearLimit={isCharNearLimit}
            isCharOverLimit={isCharOverLimit}
            wordLimit={wordLimit}
            charLimit={characterLimit}
          />
        </div>
      )}
    </div>
  );
}

export { useEditor };
export type { Editor as TiptapEditor } from '@tiptap/react';
