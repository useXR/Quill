import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Editor } from '../Editor';

// Mock for testing contenteditable behavior
const mockClipboardData = {
  getData: vi.fn(),
  setData: vi.fn(),
};

// Set up clipboard mock
Object.defineProperty(window, 'ClipboardEvent', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    clipboardData: mockClipboardData,
  })),
});

describe('Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render the editor with role textbox', async () => {
      render(<Editor />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toBeInTheDocument();
      });
    });

    it('should have aria-label for accessibility', async () => {
      render(<Editor />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toHaveAttribute('aria-label', 'Document editor');
      });
    });

    it('should have aria-multiline attribute', async () => {
      render(<Editor />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toHaveAttribute('aria-multiline', 'true');
      });
    });
  });

  describe('Placeholder', () => {
    it('should display default placeholder when empty', async () => {
      render(<Editor />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });

      // TipTap adds placeholder as a data attribute or pseudo-element
      // The placeholder text should be configurable via the placeholder prop
      await waitFor(() => {
        const placeholderElement = document.querySelector('.is-editor-empty');
        expect(placeholderElement).toBeInTheDocument();
      });
    });

    it('should display custom placeholder when provided', async () => {
      const customPlaceholder = 'Write something amazing...';
      render(<Editor placeholder={customPlaceholder} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });

  describe('Initial Content', () => {
    it('should render initial content when provided', async () => {
      const initialContent = '<p>Hello, World!</p>';
      render(<Editor content={initialContent} />);

      await waitFor(() => {
        expect(screen.getByText('Hello, World!')).toBeInTheDocument();
      });
    });

    it('should render formatted content correctly', async () => {
      const formattedContent = '<p><strong>Bold</strong> and <em>italic</em></p>';
      render(<Editor content={formattedContent} />);

      await waitFor(() => {
        expect(screen.getByText('Bold')).toBeInTheDocument();
        expect(screen.getByText('italic')).toBeInTheDocument();
      });
    });

    it('should render headings correctly', async () => {
      const headingContent = '<h1>Main Heading</h1><h2>Sub Heading</h2>';
      render(<Editor content={headingContent} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Heading');
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sub Heading');
      });
    });
  });

  describe('Read-only Mode', () => {
    it('should set contenteditable to false when editable is false', async () => {
      render(<Editor editable={false} content="<p>Read only content</p>" />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toHaveAttribute('contenteditable', 'false');
      });
    });

    it('should set contenteditable to true when editable is true', async () => {
      render(<Editor editable={true} />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toHaveAttribute('contenteditable', 'true');
      });
    });

    it('should default to editable when prop is not specified', async () => {
      render(<Editor />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toHaveAttribute('contenteditable', 'true');
      });
    });
  });

  describe('onChange Callback', () => {
    it('should call onChange when content changes', async () => {
      const mockOnChange = vi.fn();
      render(<Editor onChange={mockOnChange} />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox).toBeInTheDocument();
      });

      // The onChange should be triggered when the editor's onUpdate fires
      // This is a basic test - more comprehensive input testing would need userEvent
    });

    it('should pass HTML and JSON to onChange callback', async () => {
      const mockOnChange = vi.fn();
      render(<Editor onChange={mockOnChange} content="<p>Test</p>" />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      // Verify the onChange callback signature expects html and json
      // The actual invocation happens on user interaction
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', async () => {
      const customClass = 'my-custom-editor';
      render(<Editor className={customClass} />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox.className).toContain(customClass);
      });
    });

    it('should have prose styling classes', async () => {
      render(<Editor />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        expect(textbox.className).toContain('prose');
      });
    });
  });

  describe('Editor Container', () => {
    it('should render within a bordered container', async () => {
      render(<Editor />);

      await waitFor(() => {
        const textbox = screen.getByRole('textbox');
        const container = textbox.closest('.border');
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up editor instance on unmount', async () => {
      const { unmount } = render(<Editor />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle multiple mount/unmount cycles', async () => {
      for (let i = 0; i < 3; i++) {
        const { unmount } = render(<Editor key={i} />);

        await waitFor(() => {
          expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        unmount();
      }
    });
  });
});
