import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIHistoryPanel } from '../AIHistoryPanel';

describe('AIHistoryPanel', () => {
  const mockOperations = [
    {
      id: 'op-1',
      operation_type: 'global_edit',
      input_summary: 'Made text more formal',
      created_at: '2025-01-14T10:00:00Z',
      status: 'accepted',
    },
    {
      id: 'op-2',
      operation_type: 'global_edit',
      input_summary: 'Fixed grammar issues',
      created_at: '2025-01-14T09:00:00Z',
      status: 'accepted',
    },
    {
      id: 'op-3',
      operation_type: 'discussion',
      input_summary: 'Asked about structure',
      created_at: '2025-01-14T08:00:00Z',
      status: 'completed',
    },
  ];

  const baseProps = {
    operations: mockOperations,
    onRestore: vi.fn(),
    onClose: vi.fn(),
    isOpen: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render panel when open', () => {
    render(<AIHistoryPanel {...baseProps} />);
    expect(screen.getByTestId('ai-history-panel')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<AIHistoryPanel {...baseProps} isOpen={false} />);
    expect(screen.queryByTestId('ai-history-panel')).not.toBeInTheDocument();
  });

  it('should show panel header', () => {
    render(<AIHistoryPanel {...baseProps} />);
    expect(screen.getByText('AI Operation History')).toBeInTheDocument();
  });

  it('should display all operations', () => {
    render(<AIHistoryPanel {...baseProps} />);
    expect(screen.getByText('Made text more formal')).toBeInTheDocument();
    expect(screen.getByText('Fixed grammar issues')).toBeInTheDocument();
    expect(screen.getByText('Asked about structure')).toBeInTheDocument();
  });

  it('should show operation type badge', () => {
    render(<AIHistoryPanel {...baseProps} />);
    expect(screen.getAllByText('Global Edit')).toHaveLength(2);
    expect(screen.getByText('Discussion')).toBeInTheDocument();
  });

  it('should call onRestore with operation id when restore clicked', () => {
    render(<AIHistoryPanel {...baseProps} />);
    const restoreButtons = screen.getAllByTestId('restore-operation');
    fireEvent.click(restoreButtons[0]);
    expect(baseProps.onRestore).toHaveBeenCalledWith('op-1');
  });

  it('should call onClose when close button clicked', () => {
    render(<AIHistoryPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('history-close'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    render(<AIHistoryPanel {...baseProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should show empty state when no operations', () => {
    render(<AIHistoryPanel {...baseProps} operations={[]} />);
    expect(screen.getByText(/no ai operations/i)).toBeInTheDocument();
  });

  it('should format timestamps', () => {
    render(<AIHistoryPanel {...baseProps} />);
    // Just verify timestamps are rendered (format depends on locale)
    const operations = screen.getAllByTestId('history-operation');
    expect(operations[0].textContent).toContain('2025');
  });

  it('should show status indicator for each operation', () => {
    render(<AIHistoryPanel {...baseProps} />);
    // Find accepted status indicators
    expect(screen.getAllByTestId('status-accepted')).toHaveLength(2);
    expect(screen.getByTestId('status-completed')).toBeInTheDocument();
  });

  it('should only show restore button for operations with snapshots', () => {
    const operationsWithMixedSnapshots = [
      { ...mockOperations[0], hasSnapshot: true },
      { ...mockOperations[1], hasSnapshot: true },
      { ...mockOperations[2], hasSnapshot: false },
    ];
    render(<AIHistoryPanel {...baseProps} operations={operationsWithMixedSnapshots} />);
    const restoreButtons = screen.getAllByTestId('restore-operation');
    // Should only have 2 restore buttons (for operations with snapshots)
    expect(restoreButtons).toHaveLength(2);
  });

  it('should have accessible close button', () => {
    render(<AIHistoryPanel {...baseProps} />);
    const closeButton = screen.getByTestId('history-close');
    expect(closeButton).toHaveAttribute('aria-label', 'Close history panel');
  });

  it('should show scrollable list for many operations', () => {
    const manyOperations = Array.from({ length: 20 }, (_, i) => ({
      id: `op-${i}`,
      operation_type: 'global_edit',
      input_summary: `Operation ${i}`,
      created_at: new Date().toISOString(),
      status: 'accepted',
      hasSnapshot: true,
    }));
    render(<AIHistoryPanel {...baseProps} operations={manyOperations} />);
    const list = screen.getByTestId('history-list');
    expect(list).toHaveClass('overflow-y-auto');
  });
});
