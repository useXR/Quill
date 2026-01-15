import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIUndoButton } from '../AIUndoButton';

describe('AIUndoButton', () => {
  const mockOperations = [
    {
      id: 'op-1',
      input_summary: 'Made text more formal',
      created_at: '2025-01-14T10:00:00Z',
    },
    {
      id: 'op-2',
      input_summary: 'Fixed grammar issues',
      created_at: '2025-01-14T09:00:00Z',
    },
  ];

  const baseProps = {
    canUndo: true,
    undoCount: 2,
    lastOperation: mockOperations[0],
    onUndo: vi.fn(),
    operations: mockOperations,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the undo button', () => {
    render(<AIUndoButton {...baseProps} />);
    expect(screen.getByTestId('ai-undo-button')).toBeInTheDocument();
    expect(screen.getByText('Undo AI')).toBeInTheDocument();
  });

  it('should show the undo count badge', () => {
    render(<AIUndoButton {...baseProps} />);
    expect(screen.getByTestId('undo-count')).toHaveTextContent('2');
  });

  it('should not show count badge when undoCount is 0', () => {
    render(<AIUndoButton {...baseProps} undoCount={0} />);
    expect(screen.queryByTestId('undo-count')).not.toBeInTheDocument();
  });

  it('should call onUndo when undo button clicked', () => {
    render(<AIUndoButton {...baseProps} />);
    fireEvent.click(screen.getByTestId('ai-undo-button'));
    expect(baseProps.onUndo).toHaveBeenCalledWith();
  });

  it('should be disabled when canUndo is false', () => {
    render(<AIUndoButton {...baseProps} canUndo={false} />);
    expect(screen.getByTestId('ai-undo-button')).toBeDisabled();
  });

  it('should toggle history panel when dropdown button clicked', () => {
    render(<AIUndoButton {...baseProps} />);
    const toggleButton = screen.getByTestId('ai-history-toggle');

    fireEvent.click(toggleButton);
    expect(screen.getByTestId('ai-history-panel')).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByTestId('ai-history-panel')).not.toBeInTheDocument();
  });

  it('should show history panel with operations list', () => {
    render(<AIUndoButton {...baseProps} />);
    fireEvent.click(screen.getByTestId('ai-history-toggle'));

    const snapshots = screen.getAllByTestId('ai-snapshot');
    expect(snapshots).toHaveLength(2);
    expect(screen.getByText('Made text more formal')).toBeInTheDocument();
    expect(screen.getByText('Fixed grammar issues')).toBeInTheDocument();
  });

  it('should call onUndo with operationId when restore button clicked', () => {
    render(<AIUndoButton {...baseProps} />);
    fireEvent.click(screen.getByTestId('ai-history-toggle'));

    const restoreButtons = screen.getAllByTestId('restore-snapshot');
    fireEvent.click(restoreButtons[1]);

    expect(baseProps.onUndo).toHaveBeenCalledWith('op-2');
  });

  it('should close history panel after restore', () => {
    render(<AIUndoButton {...baseProps} />);
    fireEvent.click(screen.getByTestId('ai-history-toggle'));

    const restoreButtons = screen.getAllByTestId('restore-snapshot');
    fireEvent.click(restoreButtons[0]);

    expect(screen.queryByTestId('ai-history-panel')).not.toBeInTheDocument();
  });

  it('should show title with last operation summary', () => {
    render(<AIUndoButton {...baseProps} />);
    const button = screen.getByTestId('ai-undo-button');
    expect(button).toHaveAttribute('title', 'Undo: Made text more formal');
  });

  it('should show appropriate title when no operations', () => {
    render(<AIUndoButton {...baseProps} canUndo={false} lastOperation={undefined} operations={[]} />);
    const button = screen.getByTestId('ai-undo-button');
    expect(button).toHaveAttribute('title', 'No AI operations to undo');
  });

  it('should disable history toggle when canUndo is false', () => {
    render(<AIUndoButton {...baseProps} canUndo={false} operations={[]} />);
    expect(screen.getByTestId('ai-history-toggle')).toBeDisabled();
  });

  it('should display formatted timestamps in history', () => {
    render(<AIUndoButton {...baseProps} />);
    fireEvent.click(screen.getByTestId('ai-history-toggle'));

    // Just verify timestamps are present (format depends on locale)
    const snapshots = screen.getAllByTestId('ai-snapshot');
    expect(snapshots[0].textContent).toContain('2025');
  });

  it('should have accessible aria-label on history toggle', () => {
    render(<AIUndoButton {...baseProps} />);
    expect(screen.getByTestId('ai-history-toggle')).toHaveAttribute('aria-label', 'Show AI operation history');
  });
});
