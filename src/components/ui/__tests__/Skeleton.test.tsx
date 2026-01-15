import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, DocumentListSkeleton, EditorSkeleton, ProjectListSkeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('should render with aria-hidden for accessibility', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('should apply custom width and height', () => {
    const { container } = render(<Skeleton width="100px" height="50px" />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
  });

  it('should merge custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveClass('custom-class');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('should include motion-reduce class', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveClass('motion-reduce:animate-none');
  });

  it('should spread additional props', () => {
    const { container } = render(<Skeleton data-testid="test-skeleton" />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveAttribute('data-testid', 'test-skeleton');
  });
});

describe('DocumentListSkeleton', () => {
  it('should render with role="status" for accessibility', () => {
    render(<DocumentListSkeleton />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have screen reader text', () => {
    render(<DocumentListSkeleton />);

    expect(screen.getByText('Loading documents...')).toBeInTheDocument();
    expect(screen.getByText('Loading documents...')).toHaveClass('sr-only');
  });

  it('should render default count of 3 items', () => {
    render(<DocumentListSkeleton />);
    const container = screen.getByTestId('document-list-skeleton');

    // Each item has a wrapper div with gap-3
    const items = container.querySelectorAll('.space-y-3 > div');
    expect(items).toHaveLength(3);
  });

  it('should render custom count of items', () => {
    render(<DocumentListSkeleton count={5} />);
    const container = screen.getByTestId('document-list-skeleton');

    const items = container.querySelectorAll('.space-y-3 > div');
    expect(items).toHaveLength(5);
  });

  it('should have data-testid attribute', () => {
    render(<DocumentListSkeleton />);

    expect(screen.getByTestId('document-list-skeleton')).toBeInTheDocument();
  });
});

describe('EditorSkeleton', () => {
  it('should render with role="status" for accessibility', () => {
    render(<EditorSkeleton />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have screen reader text', () => {
    render(<EditorSkeleton />);

    expect(screen.getByText('Loading editor...')).toBeInTheDocument();
    expect(screen.getByText('Loading editor...')).toHaveClass('sr-only');
  });

  it('should have data-testid attribute', () => {
    render(<EditorSkeleton />);

    expect(screen.getByTestId('editor-skeleton')).toBeInTheDocument();
  });

  it('should contain multiple skeleton lines', () => {
    render(<EditorSkeleton />);
    const container = screen.getByTestId('editor-skeleton');

    // Should have multiple skeleton elements for content
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});

describe('ProjectListSkeleton', () => {
  it('should render with role="status" for accessibility', () => {
    render(<ProjectListSkeleton />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have screen reader text', () => {
    render(<ProjectListSkeleton />);

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
    expect(screen.getByText('Loading projects...')).toHaveClass('sr-only');
  });

  it('should render default count of 3 items', () => {
    render(<ProjectListSkeleton />);
    const container = screen.getByTestId('project-list-skeleton');

    // Grid container with project cards
    const gridItems = container.querySelectorAll('.grid > div');
    expect(gridItems).toHaveLength(3);
  });

  it('should render custom count of items', () => {
    render(<ProjectListSkeleton count={6} />);
    const container = screen.getByTestId('project-list-skeleton');

    const gridItems = container.querySelectorAll('.grid > div');
    expect(gridItems).toHaveLength(6);
  });

  it('should have data-testid attribute', () => {
    render(<ProjectListSkeleton />);

    expect(screen.getByTestId('project-list-skeleton')).toBeInTheDocument();
  });
});
