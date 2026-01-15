import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffPanel } from '../DiffPanel';
import { DiffChange } from '@/contexts/DiffContext';

describe('DiffPanel', () => {
  const mockChanges: DiffChange[] = [
    { type: 'remove', value: 'Old text', lineNumber: 1 },
    { type: 'add', value: 'New text', lineNumber: 1 },
  ];

  const baseProps = {
    changes: mockChanges,
    acceptedIndexes: new Set<number>(),
    rejectedIndexes: new Set<number>(),
    onAcceptChange: vi.fn(),
    onRejectChange: vi.fn(),
    onAcceptAll: vi.fn(),
    onRejectAll: vi.fn(),
    onApply: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render diff panel with changes', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
    expect(screen.getByText('Review Changes')).toBeInTheDocument();
  });

  it('should call onAcceptAll when Accept All clicked', () => {
    render(<DiffPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('diff-accept-all'));
    expect(baseProps.onAcceptAll).toHaveBeenCalled();
  });

  it('should call onRejectAll when Reject All clicked', () => {
    render(<DiffPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('diff-reject-all'));
    expect(baseProps.onRejectAll).toHaveBeenCalled();
  });

  it('should show stats', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.getByText(/1 addition/i)).toBeInTheDocument();
    expect(screen.getByText(/1 deletion/i)).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    render(<DiffPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('diff-close'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should call onAcceptChange with correct index when accept button clicked', () => {
    render(<DiffPanel {...baseProps} />);
    const acceptButtons = screen.getAllByTestId('accept-change');
    fireEvent.click(acceptButtons[0]);
    expect(baseProps.onAcceptChange).toHaveBeenCalledWith(0);
  });

  it('should call onRejectChange with correct index when reject button clicked', () => {
    render(<DiffPanel {...baseProps} />);
    const rejectButtons = screen.getAllByTestId('reject-change');
    fireEvent.click(rejectButtons[0]);
    expect(baseProps.onRejectChange).toHaveBeenCalledWith(0);
  });

  it('should show accepted state for accepted changes', () => {
    const acceptedIndexes = new Set([0]);
    render(<DiffPanel {...baseProps} acceptedIndexes={acceptedIndexes} />);
    const changeCards = screen.getAllByTestId('diff-change');
    expect(changeCards[0]).toHaveClass('border-success/30');
  });

  it('should show rejected state for rejected changes', () => {
    const rejectedIndexes = new Set([0]);
    render(<DiffPanel {...baseProps} rejectedIndexes={rejectedIndexes} />);
    const changeCards = screen.getAllByTestId('diff-change');
    expect(changeCards[0]).toHaveClass('border-error/30');
  });

  it('should show Apply button when all changes are decided', () => {
    const acceptedIndexes = new Set([0, 1]);
    render(<DiffPanel {...baseProps} acceptedIndexes={acceptedIndexes} />);
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
  });

  it('should not show Apply button when some changes are undecided', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
  });

  it('should call onApply when Apply button clicked', () => {
    const acceptedIndexes = new Set([0, 1]);
    render(<DiffPanel {...baseProps} acceptedIndexes={acceptedIndexes} />);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(baseProps.onApply).toHaveBeenCalled();
  });

  it('should show progress counter', () => {
    const acceptedIndexes = new Set([0]);
    render(<DiffPanel {...baseProps} acceptedIndexes={acceptedIndexes} />);
    expect(screen.getByTestId('diff-progress')).toHaveTextContent('1 / 2 changes reviewed');
  });

  it('should not render unchanged changes', () => {
    const changesWithUnchanged: DiffChange[] = [
      ...mockChanges,
      { type: 'unchanged', value: 'Unchanged text', lineNumber: 3 },
    ];
    render(<DiffPanel {...baseProps} changes={changesWithUnchanged} />);
    const changeCards = screen.getAllByTestId('diff-change');
    expect(changeCards).toHaveLength(2); // Only add and remove, not unchanged
  });

  it('should show correct badge for added changes', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.getByText('+ Added')).toBeInTheDocument();
  });

  it('should show correct badge for removed changes', () => {
    render(<DiffPanel {...baseProps} />);
    expect(screen.getByText('- Removed')).toBeInTheDocument();
  });

  it('should close panel when Escape key is pressed', () => {
    render(<DiffPanel {...baseProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should have accessible labels on accept/reject buttons', () => {
    render(<DiffPanel {...baseProps} />);
    const acceptButtons = screen.getAllByLabelText('Accept this change');
    const rejectButtons = screen.getAllByLabelText('Reject this change');
    expect(acceptButtons.length).toBeGreaterThan(0);
    expect(rejectButtons.length).toBeGreaterThan(0);
  });
});
