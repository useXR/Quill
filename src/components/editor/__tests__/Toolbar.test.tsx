import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';
import { createMockEditor, type MockEditor } from '@/test-utils';

describe('Toolbar', () => {
  let mockEditor: MockEditor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor = createMockEditor();
  });

  describe('Rendering', () => {
    it('should render null when editor is null', () => {
      const { container } = render(<Toolbar editor={null} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('should render toolbar with proper role and aria-label', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveAttribute('aria-label', 'Text formatting');
    });

    it('should render all formatting buttons', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /highlight/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /heading 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /heading 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bullet list/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /numbered list/i })).toBeInTheDocument();
    });

    it('should render all alignment buttons', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      expect(screen.getByRole('button', { name: /align left/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /align center/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /align right/i })).toBeInTheDocument();
    });

    it('should render history buttons', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
    });

    it('should render blockquote button', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);
      expect(screen.getByRole('button', { name: /blockquote/i })).toBeInTheDocument();
    });

    it('should render code block button', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);
      expect(screen.getByRole('button', { name: /code block/i })).toBeInTheDocument();
    });

    it('should render horizontal rule button', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);
      expect(screen.getByRole('button', { name: /horizontal rule/i })).toBeInTheDocument();
    });

    it('should have ARIA labels on all buttons', () => {
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Button Clicks', () => {
    it('should execute toggleBold command when bold button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const boldButton = screen.getByRole('button', { name: /bold/i });
      await user.click(boldButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.focus).toHaveBeenCalled();
      expect(mockEditor.commands.toggleBold).toHaveBeenCalled();
      expect(mockEditor.commands.run).toHaveBeenCalled();
    });

    it('should execute toggleItalic command when italic button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const italicButton = screen.getByRole('button', { name: /italic/i });
      await user.click(italicButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleItalic).toHaveBeenCalled();
    });

    it('should execute toggleHighlight command when highlight button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const highlightButton = screen.getByRole('button', { name: /highlight/i });
      await user.click(highlightButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleHighlight).toHaveBeenCalled();
    });

    it('should execute toggleHeading command with level 1 when heading 1 button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const h1Button = screen.getByRole('button', { name: /heading 1/i });
      await user.click(h1Button);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleHeading).toHaveBeenCalledWith({ level: 1 });
    });

    it('should execute toggleHeading command with level 2 when heading 2 button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const h2Button = screen.getByRole('button', { name: /heading 2/i });
      await user.click(h2Button);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    });

    it('should execute toggleBulletList command when bullet list button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const bulletListButton = screen.getByRole('button', { name: /bullet list/i });
      await user.click(bulletListButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleBulletList).toHaveBeenCalled();
    });

    it('should execute toggleOrderedList command when numbered list button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const orderedListButton = screen.getByRole('button', { name: /numbered list/i });
      await user.click(orderedListButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleOrderedList).toHaveBeenCalled();
    });

    it('should execute setTextAlign with left when align left button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const alignLeftButton = screen.getByRole('button', { name: /align left/i });
      await user.click(alignLeftButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.setTextAlign).toHaveBeenCalledWith('left');
    });

    it('should execute setTextAlign with center when align center button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const alignCenterButton = screen.getByRole('button', { name: /align center/i });
      await user.click(alignCenterButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.setTextAlign).toHaveBeenCalledWith('center');
    });

    it('should execute setTextAlign with right when align right button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const alignRightButton = screen.getByRole('button', { name: /align right/i });
      await user.click(alignRightButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.setTextAlign).toHaveBeenCalledWith('right');
    });

    it('should execute undo command when undo button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.undo).toHaveBeenCalled();
    });

    it('should execute redo command when redo button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const redoButton = screen.getByRole('button', { name: /redo/i });
      await user.click(redoButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.redo).toHaveBeenCalled();
    });

    it('should execute toggleBlockquote command when blockquote button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const blockquoteButton = screen.getByRole('button', { name: /blockquote/i });
      await user.click(blockquoteButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleBlockquote).toHaveBeenCalled();
    });

    it('should execute toggleCodeBlock command when code block button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const codeBlockButton = screen.getByRole('button', { name: /code block/i });
      await user.click(codeBlockButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.toggleCodeBlock).toHaveBeenCalled();
    });

    it('should execute setHorizontalRule command when horizontal rule button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const hrButton = screen.getByRole('button', { name: /horizontal rule/i });
      await user.click(hrButton);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockEditor.commands.setHorizontalRule).toHaveBeenCalled();
    });
  });

  describe('Active State Highlighting', () => {
    it('should apply active styling (bg-[var(--color-quill-light)]) when bold is active', () => {
      mockEditor.isActive.mockImplementation((name: string) => name === 'bold');
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const boldButton = screen.getByRole('button', { name: /bold/i });
      expect(boldButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling (bg-[var(--color-quill-light)]) when italic is active', () => {
      mockEditor.isActive.mockImplementation((name: string) => name === 'italic');
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const italicButton = screen.getByRole('button', { name: /italic/i });
      expect(italicButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when heading 1 is active', () => {
      mockEditor.isActive.mockImplementation((name: string, attrs?: Record<string, unknown>) => {
        return name === 'heading' && attrs?.level === 1;
      });
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const h1Button = screen.getByRole('button', { name: /heading 1/i });
      expect(h1Button).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when heading 2 is active', () => {
      mockEditor.isActive.mockImplementation((name: string, attrs?: Record<string, unknown>) => {
        return name === 'heading' && attrs?.level === 2;
      });
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const h2Button = screen.getByRole('button', { name: /heading 2/i });
      expect(h2Button).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when bullet list is active', () => {
      mockEditor.isActive.mockImplementation((name: string) => name === 'bulletList');
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const bulletListButton = screen.getByRole('button', { name: /bullet list/i });
      expect(bulletListButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when ordered list is active', () => {
      mockEditor.isActive.mockImplementation((name: string) => name === 'orderedList');
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const orderedListButton = screen.getByRole('button', { name: /numbered list/i });
      expect(orderedListButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when text align left is active', () => {
      mockEditor.isActive.mockImplementation((nameOrAttrs: string | Record<string, unknown>) => {
        if (typeof nameOrAttrs === 'object') {
          return nameOrAttrs.textAlign === 'left';
        }
        return false;
      });
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const alignLeftButton = screen.getByRole('button', { name: /align left/i });
      expect(alignLeftButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should not apply active styling to inactive buttons', () => {
      mockEditor.isActive.mockReturnValue(false);
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const boldButton = screen.getByRole('button', { name: /bold/i });
      expect(boldButton).not.toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when blockquote is active', () => {
      mockEditor.isActive.mockImplementation((name: string) => name === 'blockquote');
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const blockquoteButton = screen.getByRole('button', { name: /blockquote/i });
      expect(blockquoteButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should apply active styling when code block is active', () => {
      mockEditor.isActive.mockImplementation((name: string) => name === 'codeBlock');
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const codeBlockButton = screen.getByRole('button', { name: /code block/i });
      expect(codeBlockButton).toHaveClass('bg-[var(--color-quill-light)]');
    });

    it('should never apply active styling to horizontal rule button', () => {
      // Even if isActive returns true for everything, HR should never be active
      mockEditor.isActive.mockReturnValue(true);
      render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      const hrButton = screen.getByRole('button', { name: /horizontal rule/i });
      expect(hrButton).toHaveAttribute('aria-pressed', 'false');
      expect(hrButton).not.toHaveClass('bg-[var(--color-quill-light)]');
    });
  });

  describe('Button Grouping', () => {
    it('should have visual separators between button groups', () => {
      const { container } = render(<Toolbar editor={mockEditor as unknown as import('@tiptap/react').Editor} />);

      // Look for divider elements
      const dividers = container.querySelectorAll('[role="separator"]');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });
});
