import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';
import { DiffChange } from '@/contexts/DiffContext';

describe('DiffViewer', () => {
  const mockChanges: DiffChange[] = [
    { type: 'unchanged', value: 'Line 1 unchanged\n', lineNumber: 1 },
    { type: 'remove', value: 'Old line 2\n', lineNumber: 2 },
    { type: 'add', value: 'New line 2\n', lineNumber: 2 },
    { type: 'unchanged', value: 'Line 3 unchanged\n', lineNumber: 3 },
  ];

  it('should render diff viewer container', () => {
    render(<DiffViewer changes={mockChanges} />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('should display all changes', () => {
    render(<DiffViewer changes={mockChanges} />);
    expect(screen.getByText(/Line 1 unchanged/)).toBeInTheDocument();
    expect(screen.getByText(/Old line 2/)).toBeInTheDocument();
    expect(screen.getByText(/New line 2/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3 unchanged/)).toBeInTheDocument();
  });

  it('should apply correct styling to added lines', () => {
    render(<DiffViewer changes={mockChanges} />);
    const addedLine = screen.getByTestId('diff-line-add');
    expect(addedLine).toHaveClass('bg-success-light');
  });

  it('should apply correct styling to removed lines', () => {
    render(<DiffViewer changes={mockChanges} />);
    const removedLine = screen.getByTestId('diff-line-remove');
    expect(removedLine).toHaveClass('bg-error-light');
  });

  it('should apply neutral styling to unchanged lines', () => {
    render(<DiffViewer changes={mockChanges} />);
    const unchangedLines = screen.getAllByTestId('diff-line-unchanged');
    expect(unchangedLines[0]).toHaveClass('bg-transparent');
  });

  it('should show line numbers', () => {
    render(<DiffViewer changes={mockChanges} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    // Line 2 appears twice (for remove and add)
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show + prefix for added lines', () => {
    render(<DiffViewer changes={mockChanges} />);
    const addedLine = screen.getByTestId('diff-line-add');
    expect(addedLine).toHaveTextContent('+');
  });

  it('should show - prefix for removed lines', () => {
    render(<DiffViewer changes={mockChanges} />);
    const removedLine = screen.getByTestId('diff-line-remove');
    expect(removedLine).toHaveTextContent('-');
  });

  it('should render empty state when no changes', () => {
    render(<DiffViewer changes={[]} />);
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it('should use monospace font for code content', () => {
    render(<DiffViewer changes={mockChanges} />);
    const viewer = screen.getByTestId('diff-viewer');
    expect(viewer).toHaveClass('font-mono');
  });

  it('should highlight accepted indexes', () => {
    const acceptedIndexes = new Set([2]); // The add line
    render(<DiffViewer changes={mockChanges} acceptedIndexes={acceptedIndexes} />);
    const addedLine = screen.getByTestId('diff-line-add');
    expect(addedLine).toHaveClass('ring-2');
    expect(addedLine).toHaveClass('ring-success');
  });

  it('should highlight rejected indexes', () => {
    const rejectedIndexes = new Set([1]); // The remove line
    render(<DiffViewer changes={mockChanges} rejectedIndexes={rejectedIndexes} />);
    const removedLine = screen.getByTestId('diff-line-remove');
    expect(removedLine).toHaveClass('ring-2');
    expect(removedLine).toHaveClass('ring-error');
  });
});
