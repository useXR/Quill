import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils/render';
import { createRef } from 'react';
import { Select, SelectOption } from '../Select';

describe('Select', () => {
  const defaultOptions: SelectOption[] = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders select element with options', () => {
      render(<Select options={defaultOptions} name="test-select" />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });

    it('renders correct option labels', () => {
      render(<Select options={defaultOptions} name="test-select" />);

      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument();
    });

    it('renders correct option values', () => {
      render(<Select options={defaultOptions} name="test-select" />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveValue('option1');
      expect(options[1]).toHaveValue('option2');
      expect(options[2]).toHaveValue('option3');
    });
  });

  describe('Label', () => {
    it('renders label when provided', () => {
      render(<Select options={defaultOptions} name="test-select" label="Select an option" />);

      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('associates label with select via htmlFor', () => {
      render(<Select options={defaultOptions} name="test-select" label="Select an option" />);

      const label = screen.getByText('Select an option');
      const select = screen.getByRole('combobox');
      expect(label).toHaveAttribute('for', 'test-select');
      expect(select).toHaveAttribute('id', 'test-select');
    });

    it('uses id prop over name for label association', () => {
      render(<Select options={defaultOptions} name="test-select" id="custom-id" label="Select an option" />);

      const label = screen.getByText('Select an option');
      const select = screen.getByRole('combobox');
      expect(label).toHaveAttribute('for', 'custom-id');
      expect(select).toHaveAttribute('id', 'custom-id');
    });

    it('shows required indicator when required', () => {
      render(<Select options={defaultOptions} name="test-select" label="Required field" required />);

      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Placeholder', () => {
    it('renders placeholder option when provided', () => {
      render(<Select options={defaultOptions} name="test-select" placeholder="Choose one..." />);

      const placeholderOption = screen.getByRole('option', { name: 'Choose one...' });
      expect(placeholderOption).toBeInTheDocument();
      expect(placeholderOption).toBeDisabled();
      expect(placeholderOption).toHaveValue('');
    });

    it('shows placeholder as first option', () => {
      render(<Select options={defaultOptions} name="test-select" placeholder="Choose one..." />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4); // placeholder + 3 options
      expect(options[0]).toHaveTextContent('Choose one...');
    });
  });

  describe('Helper Text', () => {
    it('renders helper text when provided', () => {
      render(<Select options={defaultOptions} name="test-select" helperText="This is helper text" />);

      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('should have aria-describedby linking to helper text', () => {
      render(<Select id="status" label="Status" options={defaultOptions} helperText="Help text" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'status-helper');
    });
  });

  describe('Error State', () => {
    it('renders error message when provided', () => {
      render(<Select options={defaultOptions} name="test-select" error="This field is required" />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('sets aria-invalid when error is present', () => {
      render(<Select options={defaultOptions} name="test-select" error="This field is required" />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
    });

    it('should have aria-describedby linking to error', () => {
      render(<Select id="status" label="Status" options={defaultOptions} error="Error message" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'status-error');
    });

    it('error message has role alert', () => {
      render(<Select options={defaultOptions} name="test-select" error="This field is required" />);

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('This field is required');
    });

    it('hides helper text when error is shown', () => {
      render(
        <Select
          options={defaultOptions}
          name="test-select"
          helperText="This is helper text"
          error="This field is required"
        />
      );

      expect(screen.queryByText('This is helper text')).not.toBeInTheDocument();
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error border styling', () => {
      render(<Select options={defaultOptions} name="test-select" error="This field is required" />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('border-[var(--color-error)]');
    });
  });

  describe('Disabled Options', () => {
    it('renders disabled options correctly', () => {
      const optionsWithDisabled: SelectOption[] = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2 (disabled)', disabled: true },
        { value: 'option3', label: 'Option 3' },
      ];

      render(<Select options={optionsWithDisabled} name="test-select" />);

      const disabledOption = screen.getByRole('option', { name: 'Option 2 (disabled)' });
      expect(disabledOption).toBeDisabled();
    });
  });

  describe('Disabled State', () => {
    it('disables the select when disabled prop is true', () => {
      render(<Select options={defaultOptions} name="test-select" disabled />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Select options={defaultOptions} name="test-select" disabled />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('disabled:opacity-50');
      expect(select).toHaveClass('disabled:cursor-not-allowed');
    });
  });

  describe('Left Icon', () => {
    it('renders left icon when provided', () => {
      const icon = <span data-testid="left-icon">Icon</span>;
      render(<Select options={defaultOptions} name="test-select" leftIcon={icon} />);

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('applies left padding when icon is present', () => {
      const icon = <span data-testid="left-icon">Icon</span>;
      render(<Select options={defaultOptions} name="test-select" leftIcon={icon} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('pl-10');
    });
  });

  describe('Custom Styling', () => {
    it('applies additional className', () => {
      render(<Select options={defaultOptions} name="test-select" className="custom-class" />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('custom-class');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to select element', () => {
      const ref = createRef<HTMLSelectElement>();
      render(<Select options={defaultOptions} name="test-select" ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    });
  });

  describe('User Interaction', () => {
    it('calls onChange when selection changes', async () => {
      const handleChange = vi.fn();
      const { user } = render(<Select options={defaultOptions} name="test-select" onChange={handleChange} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'option2');

      expect(handleChange).toHaveBeenCalled();
    });

    it('updates selected value on change', async () => {
      const { user } = render(<Select options={defaultOptions} name="test-select" defaultValue="option1" />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('option1');

      await user.selectOptions(select, 'option2');
      expect(select).toHaveValue('option2');
    });
  });

  describe('Controlled Component', () => {
    it('respects value prop for controlled mode', () => {
      render(<Select options={defaultOptions} name="test-select" value="option2" onChange={() => {}} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('option2');
    });
  });

  describe('Dropdown Arrow', () => {
    it('renders custom dropdown arrow', () => {
      render(<Select options={defaultOptions} name="test-select" />);

      const arrow = document.querySelector('svg[aria-hidden="true"]');
      expect(arrow).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty options array', () => {
      render(<Select options={[]} name="test-select" />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('handles single option', () => {
      const singleOption = [{ value: 'only', label: 'Only Option' }];
      render(<Select options={singleOption} name="test-select" />);

      expect(screen.getByRole('option', { name: 'Only Option' })).toBeInTheDocument();
    });

    it('handles options with special characters', () => {
      const specialOptions = [{ value: 'special', label: 'Option with <special> & "characters"' }];
      render(<Select options={specialOptions} name="test-select" />);

      expect(screen.getByRole('option', { name: 'Option with <special> & "characters"' })).toBeInTheDocument();
    });
  });
});
