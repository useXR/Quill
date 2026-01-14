'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from './extensions';
import { Toolbar } from './Toolbar';
import { WordCount } from './WordCount';
import { useWordCount } from '@/hooks/useWordCount';
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
  content?: string;
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
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      onChange?.(html, json);
      updateCount(html);
    },
    editorProps: {
      attributes: {
        class: `prose prose-lg max-w-none focus:outline-none min-h-[200px] p-4 ${className}`,
        role: 'textbox',
        'aria-label': 'Document editor',
        'aria-multiline': 'true',
      },
    },
  });

  // Update word count on initial content
  useEffect(() => {
    if (content) {
      updateCount(content);
    }
  }, [content, updateCount]);

  // Notify parent of word count changes
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

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {showToolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {showWordCount && (
        <div className="px-4 py-2 border-t">
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
