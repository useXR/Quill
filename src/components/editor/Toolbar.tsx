'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo,
  Redo,
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButton {
  icon: React.ElementType;
  label: string;
  action: () => boolean;
  isActive: () => boolean;
  group: string;
}

function Divider() {
  return <div role="separator" className="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const formatButtons: ToolbarButton[] = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      group: 'format',
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      group: 'format',
    },
    {
      icon: Highlighter,
      label: 'Highlight',
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      group: 'format',
    },
  ];

  const headingButtons: ToolbarButton[] = [
    {
      icon: Heading1,
      label: 'Heading 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
      group: 'heading',
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
      group: 'heading',
    },
  ];

  const listButtons: ToolbarButton[] = [
    {
      icon: List,
      label: 'Bullet List',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
      group: 'list',
    },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
      group: 'list',
    },
  ];

  const alignmentButtons: ToolbarButton[] = [
    {
      icon: AlignLeft,
      label: 'Align Left',
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
      group: 'alignment',
    },
    {
      icon: AlignCenter,
      label: 'Align Center',
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      group: 'alignment',
    },
    {
      icon: AlignRight,
      label: 'Align Right',
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      group: 'alignment',
    },
  ];

  const historyButtons: ToolbarButton[] = [
    {
      icon: Undo,
      label: 'Undo',
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
      group: 'history',
    },
    {
      icon: Redo,
      label: 'Redo',
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
      group: 'history',
    },
  ];

  const renderButton = (button: ToolbarButton) => {
    const Icon = button.icon;
    const isActive = button.isActive();

    return (
      <button
        key={button.label}
        type="button"
        onClick={button.action}
        aria-label={button.label}
        aria-pressed={isActive}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${
          isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
        }`}
      >
        <Icon className="w-5 h-5" />
      </button>
    );
  };

  return (
    <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-1 p-2 border-b bg-gray-50">
      {/* Format buttons */}
      <div className="flex items-center gap-0.5">{formatButtons.map(renderButton)}</div>

      <Divider />

      {/* Heading buttons */}
      <div className="flex items-center gap-0.5">{headingButtons.map(renderButton)}</div>

      <Divider />

      {/* List buttons */}
      <div className="flex items-center gap-0.5">{listButtons.map(renderButton)}</div>

      <Divider />

      {/* Alignment buttons */}
      <div className="flex items-center gap-0.5">{alignmentButtons.map(renderButton)}</div>

      <Divider />

      {/* History buttons */}
      <div className="flex items-center gap-0.5">{historyButtons.map(renderButton)}</div>
    </div>
  );
}
