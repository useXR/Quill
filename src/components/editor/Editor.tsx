'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from './extensions';
import { Toolbar } from './Toolbar';

export interface EditorProps {
  content?: string;
  placeholder?: string;
  characterLimit?: number;
  onChange?: (html: string, json: object) => void;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  onChange,
  editable = true,
  className = '',
  showToolbar = true,
}: EditorProps) {
  const editor = useEditor({
    extensions: createExtensions({ placeholder, characterLimit }),
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML(), editor.getJSON());
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

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {showToolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

export { useEditor };
export type { Editor as TiptapEditor } from '@tiptap/react';
