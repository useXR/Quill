# Task 3: Editor Toolbar

> **Phase 1** | [← TipTap Editor](./03-tiptap-editor.md) | [Next: Auth Magic Link →](./05-auth-magic-link.md)

---

## Context

**This task adds a formatting toolbar to the editor.** Provides buttons for bold, italic, headings, lists, alignment, and undo/redo.

### Prerequisites

- **Task 2** completed (TipTap editor component)

### What This Task Creates

- `src/components/editor/__tests__/Toolbar.test.tsx` - Toolbar tests
- `src/components/editor/Toolbar.tsx` - Toolbar component
- Updated `src/components/editor/Editor.tsx` - With toolbar integration

### Tasks That Depend on This

- **Task 8** (Autosave Hook) - Uses complete editor with toolbar
- **Task 9** (Word Count) - Integrates with full editor

---

## Files to Create/Modify

- `src/components/editor/__tests__/Toolbar.test.tsx` (create)
- `src/components/editor/Toolbar.tsx` (create)
- `src/components/editor/Editor.tsx` (modify)

---

## Steps

### Step 3.1: Install icons

```bash
npm install lucide-react
```

**Expected:** Package added to package.json

### Step 3.2: Write the failing test for Toolbar

Create `src/components/editor/__tests__/Toolbar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';
import { createMockEditor } from '@/test-utils';

describe('Toolbar Component', () => {
  let mockEditor: ReturnType<typeof createMockEditor>;

  beforeEach(() => {
    mockEditor = createMockEditor();
  });

  describe('Rendering', () => {
    it('should render all formatting buttons', () => {
      render(<Toolbar editor={mockEditor as any} />);

      expect(screen.getByLabelText('Bold')).toBeInTheDocument();
      expect(screen.getByLabelText('Italic')).toBeInTheDocument();
      expect(screen.getByLabelText('Heading 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Heading 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Bullet List')).toBeInTheDocument();
      expect(screen.getByLabelText('Numbered List')).toBeInTheDocument();
      expect(screen.getByLabelText('Align Left')).toBeInTheDocument();
      expect(screen.getByLabelText('Align Center')).toBeInTheDocument();
      expect(screen.getByLabelText('Align Right')).toBeInTheDocument();
    });

    it('should render null when editor is null', () => {
      const { container } = render(<Toolbar editor={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Button Actions', () => {
    it('should execute bold command on click', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as any} />);

      await user.click(screen.getByLabelText('Bold'));

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it('should execute heading command on click', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as any} />);

      await user.click(screen.getByLabelText('Heading 1'));

      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe('Active State', () => {
    it('should highlight active formatting button', () => {
      mockEditor.isActive = vi.fn((format) => format === 'bold');
      render(<Toolbar editor={mockEditor as any} />);

      const boldButton = screen.getByLabelText('Bold');
      expect(boldButton).toHaveClass('bg-gray-200');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on all buttons', () => {
      render(<Toolbar editor={mockEditor as any} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });
});
```

### Step 3.3: Run test to verify it fails

```bash
npm test src/components/editor/__tests__/Toolbar.test.tsx
```

**Expected:** FAIL - module '../Toolbar' not found

### Step 3.4: Implement Toolbar component

Create `src/components/editor/Toolbar.tsx`:

```typescript
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

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const buttons: ToolbarButton[] = [
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
    {
      icon: AlignLeft,
      label: 'Align Left',
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
      group: 'align',
    },
    {
      icon: AlignCenter,
      label: 'Align Center',
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      group: 'align',
    },
    {
      icon: AlignRight,
      label: 'Align Right',
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      group: 'align',
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
    return (
      <button
        key={button.label}
        type="button"
        onClick={button.action}
        aria-label={button.label}
        aria-pressed={button.isActive()}
        title={button.label}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${
          button.isActive() ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  const groups = ['format', 'heading', 'list', 'align'];

  return (
    <div
      className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap"
      role="toolbar"
      aria-label="Editor formatting toolbar"
    >
      {groups.map((group, index) => (
        <div key={group} className="flex items-center">
          {buttons.filter((b) => b.group === group).map(renderButton)}
          {index < groups.length - 1 && (
            <div className="w-px h-6 bg-gray-300 mx-2" />
          )}
        </div>
      ))}
      <div className="w-px h-6 bg-gray-300 mx-2" />
      <div className="flex items-center">
        {historyButtons.map(renderButton)}
      </div>
    </div>
  );
}
```

### Step 3.5: Run test to verify it passes

```bash
npm test src/components/editor/__tests__/Toolbar.test.tsx
```

**Expected:** PASS

### Step 3.6: Update Editor to include Toolbar

Modify `src/components/editor/Editor.tsx` to add toolbar support:

```typescript
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
```

### Step 3.7: Run all editor tests

```bash
npm test src/components/editor
```

**Expected:** PASS (all tests)

### Step 3.8: Commit

```bash
git add src/components/editor
git commit -m "feat: add editor toolbar with formatting, alignment, and history"
```

---

## Verification Checklist

- [ ] Lucide React icons installed
- [ ] Toolbar tests pass
- [ ] Toolbar renders all buttons
- [ ] Button clicks trigger editor commands
- [ ] Active state highlights correctly
- [ ] Editor includes toolbar by default
- [ ] All editor tests pass
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 4: Auth Magic Link](./05-auth-magic-link.md)**.
