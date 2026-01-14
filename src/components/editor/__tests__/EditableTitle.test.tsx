import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableTitle } from '../EditableTitle';

describe('EditableTitle Component', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe('Display Mode', () => {
    it('should render title as heading', () => {
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      expect(screen.getByRole('heading', { name: 'My Document' })).toBeInTheDocument();
    });

    it('should show edit button on hover/focus', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const container = screen.getByTestId('editable-title');
      await user.hover(container);

      expect(screen.getByRole('button', { name: /edit title/i })).toBeInTheDocument();
    });

    it('should enter edit mode on heading click', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('My Document');
    });

    it('should enter edit mode on edit button click', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const container = screen.getByTestId('editable-title');
      await user.hover(container);
      await user.click(screen.getByRole('button', { name: /edit title/i }));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should enter edit mode on Enter key when heading focused', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      heading.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should enter edit mode on Space key when heading focused', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      heading.focus();
      await user.keyboard(' ');

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should focus input when entering edit mode', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('should select all text when entering edit mode', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe('My Document'.length);
    });

    it('should save on Enter key', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'New Title{Enter}');

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('New Title');
      });
    });

    it('should save on blur', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Blurred Title');
      await user.tab(); // Blur the input

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Blurred Title');
      });
    });

    it('should cancel on Escape key', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Cancelled');
      await user.keyboard('{Escape}');

      // Should revert and exit edit mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'My Document' })).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show saving indicator', async () => {
      mockOnSave.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Saving Title{Enter}');

      // Should show saving state
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });
    });

    it('should show error message on save failure', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Failed Title{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });

      // Should stay in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should exit edit mode and return to display mode after successful save', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'New Title{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });

      // Should be back in display mode showing the heading
      expect(screen.getByRole('heading')).toBeInTheDocument();
      // Note: Focus restoration to heading is verified in E2E tests
      // as happy-dom doesn't properly handle async focus management
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for input', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Document title');
    });

    it('should announce saving state to screen readers with role="status"', async () => {
      mockOnSave.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.type(screen.getByRole('textbox'), 'x{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('should announce errors with role="alert"', async () => {
      mockOnSave.mockRejectedValue(new Error('Save failed'));

      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.type(screen.getByRole('textbox'), 'x{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('should have heading with tabIndex for keyboard access', () => {
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      expect(heading).toHaveAttribute('tabIndex', '0');
    });

    it('should have aria-describedby on heading', () => {
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      const heading = screen.getByRole('heading');
      expect(heading).toHaveAttribute('aria-describedby', 'edit-title-hint');
      // Note: The hint text is visually hidden (sr-only) but still in DOM
      expect(document.getElementById('edit-title-hint')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should not allow empty title', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.keyboard('{Enter}');

      // Should revert to original and not save
      expect(mockOnSave).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'My Document' })).toBeInTheDocument();
    });

    it('should trim whitespace', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} />);

      await user.click(screen.getByRole('heading'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), '  Trimmed  {Enter}');

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Trimmed');
      });
    });

    it('should enforce max length', async () => {
      const user = userEvent.setup();
      render(<EditableTitle title="My Document" onSave={mockOnSave} maxLength={20} />);

      await user.click(screen.getByRole('heading'));

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '20');
    });
  });
});
