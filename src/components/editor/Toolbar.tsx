'use client';

import { useState } from 'react';
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
  Download,
  FileText,
  FileType,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface ToolbarProps {
  editor: Editor | null;
  documentId?: string;
  documentTitle?: string;
}

interface ToolbarButton {
  icon: React.ElementType;
  label: string;
  action: () => boolean;
  isActive: () => boolean;
  group: string;
}

function Divider() {
  return <div role="separator" className="w-px h-5 bg-[var(--color-ink-faint)] mx-1" aria-hidden="true" />;
}

export function Toolbar({ editor, documentId, documentTitle }: ToolbarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { addToast } = useToast();

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!documentId) {
      addToast('Cannot export: document not saved', { type: 'error' });
      return;
    }

    setIsExporting(true);
    setExportMenuOpen(false);

    try {
      const response = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Export failed`);
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle || 'document'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast(`Exported to ${format.toUpperCase()}`, { type: 'success' });
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Export failed', { type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

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
        className={`
          p-2 rounded-[var(--radius-md)]
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:ring-offset-1
          ${
            isActive
              ? 'bg-[var(--color-quill-light)] text-[var(--color-quill)]'
              : 'text-[var(--color-ink-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink-primary)]'
          }
        `}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-ink-faint)] bg-[var(--color-bg-secondary)]"
    >
      <div className="flex items-center gap-0.5">{formatButtons.map(renderButton)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">{headingButtons.map(renderButton)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">{listButtons.map(renderButton)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">{alignmentButtons.map(renderButton)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">{historyButtons.map(renderButton)}</div>

      {/* Spacer to push export to the right */}
      <div className="flex-1" />

      {/* Export Dropdown */}
      {documentId && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={isExporting}
            aria-haspopup="true"
            aria-expanded={exportMenuOpen}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]
              text-sm font-medium
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-[var(--color-quill)] focus:ring-offset-1
              ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}
              text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink-primary)]
            `}
          >
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>

          {exportMenuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 mt-1 w-48 bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-lg border border-[var(--color-ink-faint)] z-20 py-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport('docx')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-[var(--color-ink-primary)] hover:bg-[var(--color-surface-hover)]"
                >
                  <FileText className="w-4 h-4" />
                  Export as Word (.docx)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport('pdf')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-[var(--color-ink-primary)] hover:bg-[var(--color-surface-hover)]"
                >
                  <FileType className="w-4 h-4" />
                  Export as PDF
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
