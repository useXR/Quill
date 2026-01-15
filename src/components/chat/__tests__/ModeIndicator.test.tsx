import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeIndicator } from '../ModeIndicator';

describe('ModeIndicator', () => {
  it('should render discussion mode with correct label', () => {
    render(<ModeIndicator mode="discussion" />);
    expect(screen.getByText('Discussion')).toBeInTheDocument();
  });

  it('should render global_edit mode with correct label', () => {
    render(<ModeIndicator mode="global_edit" />);
    expect(screen.getByText('Global Edit')).toBeInTheDocument();
  });

  it('should render research mode with correct label', () => {
    render(<ModeIndicator mode="research" />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('should show confidence when not high', () => {
    render(<ModeIndicator mode="discussion" confidence="medium" />);
    expect(screen.getByText('(medium)')).toBeInTheDocument();
  });

  it('should have correct data-mode attribute', () => {
    render(<ModeIndicator mode="global_edit" />);
    expect(screen.getByTestId('chat-mode-indicator')).toHaveAttribute('data-mode', 'global_edit');
  });
});
