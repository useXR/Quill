# Task 2: TipTap Editor Setup

> **Phase 1** | [← Testing Infrastructure](./02-testing-infrastructure.md) | [Next: Editor Toolbar →](./04-editor-toolbar.md)

---

## Context

**This task creates the core rich text editor component.** TipTap provides the foundation for document editing throughout the application.

### Prerequisites

- **Task 1** completed (Testing infrastructure available)

### What This Task Creates

- `src/components/editor/extensions/index.ts` - TipTap extensions config
- `src/components/editor/__tests__/Editor.test.tsx` - Editor tests
- `src/components/editor/Editor.tsx` - Main editor component

### Tasks That Depend on This

- **Task 3** (Editor Toolbar) - Needs editor to attach toolbar to
- **Task 8** (Autosave Hook) - Uses editor for content changes
- **Task 9** (Word Count) - Integrates with editor

### Parallel Tasks

This task can be done in parallel with:

- **Task 4** (Auth Magic Link)
- **Task 5** (Auth Middleware)

---

## Files to Create/Modify

- `src/components/editor/extensions/index.ts` (create)
- `src/components/editor/__tests__/Editor.test.tsx` (create)
- `src/components/editor/Editor.tsx` (create)

---

## Steps

### Step 2.1: Install TipTap dependencies

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-text-align @tiptap/extension-image @tiptap/extension-highlight
```

**Expected:** Packages added to package.json

### Step 2.2: Write the failing test for Editor

Create `src/components/editor/__tests__/Editor.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '../Editor';

describe('Editor Component', () => {
  describe('Rendering', () => {
    it('should render the editor with role textbox', () => {
      render(<Editor />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should display placeholder when empty', () => {
      render(<Editor placeholder="Start writing..." />);
      expect(screen.getByText('Start writing...')).toBeInTheDocument();
    });

    it('should render with initial content', () => {
      render(<Editor content="<p>Hello world</p>" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should render in read-only mode when editable is false', () => {
      render(<Editor editable={false} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });
  });

  describe('Text Input', () => {
    it('should call onChange when text is entered', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Editor onChange={onChange} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('Hello');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('should handle null onChange gracefully', async () => {
      const user = userEvent.setup();
      render(<Editor onChange={undefined} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('test');

      expect(editor).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup editor on unmount', () => {
      const { unmount } = render(<Editor />);
      expect(() => unmount()).not.toThrow();
    });
  });
});
```

### Step 2.3: Run test to verify it fails

```bash
npm test src/components/editor/__tests__/Editor.test.tsx
```

**Expected:** FAIL - module '../Editor' not found

### Step 2.4: Create extensions configuration

Create `src/components/editor/extensions/index.ts`:

```typescript
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';

export interface ExtensionConfig {
  placeholder?: string;
  characterLimit?: number;
}

export function createExtensions(config: ExtensionConfig = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({
      placeholder: config.placeholder || 'Start writing your grant proposal...',
    }),
    CharacterCount.configure({
      limit: config.characterLimit,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-blue-600 underline' },
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    Highlight.configure({
      multicolor: true,
    }),
  ];
}
```

### Step 2.5: Implement Editor component

Create `src/components/editor/Editor.tsx`:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from './extensions';

export interface EditorProps {
  content?: string;
  placeholder?: string;
  characterLimit?: number;
  onChange?: (html: string, json: object) => void;
  editable?: boolean;
  className?: string;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  onChange,
  editable = true,
  className = '',
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
    <div className="border rounded-lg bg-white shadow-xs">
      <EditorContent editor={editor} />
    </div>
  );
}

export { useEditor };
export type { Editor as TiptapEditor } from '@tiptap/react';
```

### Step 2.6: Run test to verify it passes

```bash
npm test src/components/editor/__tests__/Editor.test.tsx
```

**Expected:** PASS

### Step 2.7: Commit

```bash
git add src/components/editor
git commit -m "feat: add TipTap editor with grant writing extensions"
```

---

## Verification Checklist

- [ ] TipTap packages installed
- [ ] Extensions configuration created
- [ ] Editor tests pass
- [ ] Editor component renders
- [ ] Placeholder displays correctly
- [ ] Read-only mode works
- [ ] onChange callback fires
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3: Editor Toolbar](./04-editor-toolbar.md)**.
