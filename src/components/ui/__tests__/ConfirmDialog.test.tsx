import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure?',
  };

  it('should not render when open is false', () => {
    render(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('should render when open is true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should call onClose when Cancel clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should call onConfirm when Confirm clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(baseProps.onConfirm).toHaveBeenCalled();
  });

  it('should call onClose when backdrop clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByTestId('confirm-backdrop'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose when Escape key pressed', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
