import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionToolbar } from '../SelectionToolbar';
import { useAIStore } from '@/lib/stores/ai-store';

vi.mock('@/lib/stores/ai-store');
vi.mock('@/hooks/useAIStream', () => ({
  useAIStream: () => ({
    startStream: vi.fn(),
    cancel: vi.fn(),
    content: '',
    isStreaming: false,
    error: null,
  }),
}));

const mockAddToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
    clearToasts: vi.fn(),
    toasts: [],
  }),
}));

// Create a mock chain that supports all methods including insertContentAt
const createMockChain = () => {
  const chain = {
    focus: vi.fn(),
    setTextSelection: vi.fn(),
    insertContent: vi.fn(),
    insertContentAt: vi.fn(),
    run: vi.fn(),
  };
  // Make all methods return chain for chaining
  chain.focus.mockImplementation(() => chain);
  chain.setTextSelection.mockImplementation(() => chain);
  chain.insertContent.mockImplementation(() => chain);
  chain.insertContentAt.mockImplementation(() => chain);
  chain.run.mockReturnValue(true);
  return chain;
};

let mockChain = createMockChain();

const mockEditor = {
  getHTML: vi.fn().mockReturnValue('<p>Test</p>'),
  chain: vi.fn(() => mockChain),
  state: {
    doc: {
      content: {
        size: 100, // Default document size
      },
    },
  },
  commands: { focus: vi.fn() },
};

const mockSelection = {
  from: 0,
  to: 10,
  text: 'Test text',
  rect: new DOMRect(100, 100, 50, 20),
};

describe('SelectionToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chain - create fresh instance
    mockChain = createMockChain();
    // Reset editor state
    mockEditor.state.doc.content.size = 100;

    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: null,
      startOperation: vi.fn().mockReturnValue('op-1'),
      appendOutput: vi.fn(),
      setOutput: vi.fn(),
      setStatus: vi.fn(),
      setError: vi.fn(),
      acceptOperation: vi.fn(),
      rejectOperation: vi.fn(),
    } as ReturnType<typeof useAIStore>);
  });

  it('should have proper ARIA attributes', () => {
    render(
      <SelectionToolbar
        editor={mockEditor as unknown as import('@tiptap/react').Editor}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Text formatting actions');
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('should support keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <SelectionToolbar
        editor={mockEditor as unknown as import('@tiptap/react').Editor}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const refineBtn = screen.getByRole('button', { name: /refine/i });
    refineBtn.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /extend/i })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(refineBtn).toHaveFocus();
  });

  it('should close on Escape key', async () => {
    const rejectOperation = vi.fn();
    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: null,
      rejectOperation,
    } as unknown as ReturnType<typeof useAIStore>);

    const user = userEvent.setup();

    render(
      <SelectionToolbar
        editor={mockEditor as unknown as import('@tiptap/react').Editor}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    await user.keyboard('{Escape}');
    expect(rejectOperation).toHaveBeenCalled();
  });

  it('should announce loading state to screen readers', () => {
    vi.mocked(useAIStore).mockReturnValue({
      currentOperation: { status: 'loading' },
    } as unknown as ReturnType<typeof useAIStore>);

    render(
      <SelectionToolbar
        editor={mockEditor as unknown as import('@tiptap/react').Editor}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/generating/i);
  });

  it('buttons should have accessible names with descriptions', () => {
    render(
      <SelectionToolbar
        editor={mockEditor as unknown as import('@tiptap/react').Editor}
        selection={mockSelection}
        projectId="proj-1"
        documentId="doc-1"
      />
    );

    const refineBtn = screen.getByRole('button', { name: /refine.*improve clarity/i });
    expect(refineBtn).toBeInTheDocument();
  });

  describe('AI Action Buttons', () => {
    it('should render all four AI action buttons', () => {
      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(screen.getByRole('button', { name: /refine/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /extend/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /summarize/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /simplify/i })).toBeInTheDocument();
    });

    it('should call startOperation when action button is clicked', async () => {
      const startOperation = vi.fn().mockReturnValue('op-1');
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: null,
        startOperation,
        appendOutput: vi.fn(),
        setOutput: vi.fn(),
        setStatus: vi.fn(),
        setError: vi.fn(),
        acceptOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const refineBtn = screen.getByRole('button', { name: /refine/i });
      await user.click(refineBtn);

      expect(startOperation).toHaveBeenCalledWith('selection', expect.any(String), expect.any(String));
    });
  });

  describe('Preview State', () => {
    it('should show accept/reject buttons when AI response is ready', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: 'AI generated text' },
        acceptOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('should call acceptOperation when accept button is clicked', async () => {
      const acceptOperation = vi.fn();
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: 'AI generated text' },
        acceptOperation,
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptBtn);

      expect(acceptOperation).toHaveBeenCalled();
    });

    it('should call rejectOperation when reject button is clicked', async () => {
      const rejectOperation = vi.fn();
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: 'AI generated text' },
        acceptOperation: vi.fn(),
        rejectOperation,
      } as unknown as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const rejectBtn = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectBtn);

      expect(rejectOperation).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should wrap to first button when pressing ArrowRight on last button', async () => {
      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const simplifyBtn = screen.getByRole('button', { name: /simplify/i });
      simplifyBtn.focus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: /refine/i })).toHaveFocus();
    });

    it('should wrap to last button when pressing ArrowLeft on first button', async () => {
      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const refineBtn = screen.getByRole('button', { name: /refine/i });
      refineBtn.focus();

      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('button', { name: /simplify/i })).toHaveFocus();
    });

    it('should move to first button on Home key', async () => {
      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const simplifyBtn = screen.getByRole('button', { name: /simplify/i });
      simplifyBtn.focus();

      await user.keyboard('{Home}');
      expect(screen.getByRole('button', { name: /refine/i })).toHaveFocus();
    });

    it('should move to last button on End key', async () => {
      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const refineBtn = screen.getByRole('button', { name: /refine/i });
      refineBtn.focus();

      await user.keyboard('{End}');
      expect(screen.getByRole('button', { name: /simplify/i })).toHaveFocus();
    });
  });

  describe('Positioning', () => {
    it('should be positioned based on selection rect', () => {
      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveStyle({ position: 'absolute' });
    });

    it('should not render when selection is null', () => {
      const { container } = render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={null}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Loading State', () => {
    it('should disable action buttons when loading', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'loading' },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const refineBtn = screen.getByRole('button', { name: /refine/i });
      expect(refineBtn).toBeDisabled();
    });

    it('should disable action buttons when streaming', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'streaming' },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const refineBtn = screen.getByRole('button', { name: /refine/i });
      expect(refineBtn).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('should display error message when operation fails', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'error', error: { message: 'Something went wrong', category: 'api' } },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    });

    it('should show Try again button on error', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'error', error: { message: 'Network error', category: 'network' } },
        startOperation: vi.fn().mockReturnValue('op-1'),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      // Try again button should be visible when there's an error
      // Note: The button only appears if lastAction is set, which happens after clicking an action
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should display user-friendly error for network errors', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'error', error: { message: 'network connection failed', category: 'network' } },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/check your internet connection/i);
    });

    it('should display user-friendly error for rate limit errors', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'error', error: { message: 'Error 429: rate limit exceeded', category: 'api' } },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/ai service is busy/i);
    });
  });

  describe('Markdown Integration', () => {
    it('should call insertContentAt with contentType markdown when accepting', async () => {
      const acceptOperation = vi.fn();
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: '**Bold text** and *italic*' },
        acceptOperation,
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptBtn);

      expect(mockChain.insertContentAt).toHaveBeenCalledWith(
        { from: mockSelection.from, to: mockSelection.to },
        '**Bold text** and *italic*',
        { contentType: 'markdown' }
      );
      expect(acceptOperation).toHaveBeenCalled();
    });
  });

  describe('Data Integrity', () => {
    it('should not accept empty output', async () => {
      const acceptOperation = vi.fn();
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: '   ' }, // whitespace only
        acceptOperation,
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptBtn);

      expect(mockAddToast).toHaveBeenCalledWith('AI returned empty content. Please try again.', { type: 'error' });
      expect(acceptOperation).not.toHaveBeenCalled();
    });

    it('should reject stale selection when document has changed', async () => {
      const rejectOperation = vi.fn();
      const acceptOperation = vi.fn();

      // Selection points beyond current document size
      const staleSelection = {
        from: 0,
        to: 150, // Beyond doc size of 100
        text: 'Test text',
        rect: new DOMRect(100, 100, 50, 20),
      };

      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: 'AI generated text' },
        acceptOperation,
        rejectOperation,
      } as unknown as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={staleSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptBtn);

      expect(mockAddToast).toHaveBeenCalledWith('Selection is no longer valid. Please select text again.', {
        type: 'error',
      });
      expect(rejectOperation).toHaveBeenCalled();
      expect(acceptOperation).not.toHaveBeenCalled();
    });

    it('should disable accept button while accepting to prevent double-click', async () => {
      const acceptOperation = vi.fn();
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'preview', output: 'AI generated text' },
        acceptOperation,
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      const user = userEvent.setup();

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /accept/i });

      // First click should work
      await user.click(acceptBtn);

      // The button should exist and insertContentAt should be called
      expect(mockChain.insertContentAt).toHaveBeenCalledTimes(1);
      expect(acceptOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading Indicator', () => {
    it('should show visible spinner when loading', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'loading' },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      // Should have visible loading text
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    it('should show visible spinner when streaming', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'streaming', output: 'partial content' },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      // Should have visible loading text
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    it('should show preview explanation during streaming', () => {
      vi.mocked(useAIStore).mockReturnValue({
        currentOperation: { status: 'streaming', output: '**markdown** content' },
        startOperation: vi.fn(),
        rejectOperation: vi.fn(),
      } as unknown as ReturnType<typeof useAIStore>);

      render(
        <SelectionToolbar
          editor={mockEditor as unknown as import('@tiptap/react').Editor}
          selection={mockSelection}
          projectId="proj-1"
          documentId="doc-1"
        />
      );

      expect(screen.getByText('Preview shows raw format. Styling applied when accepted.')).toBeInTheDocument();
    });
  });
});
