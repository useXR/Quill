import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@/test-utils/render';
import userEvent from '@testing-library/user-event';
import { ProjectSidebar } from '../ProjectSidebar';

// Note: Use custom render from @/test-utils which includes providers
// See docs/best-practices/testing-best-practices.md for details

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/projects/project-1'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

const mockDocuments = [
  { id: 'doc-1', title: 'Introduction', sort_order: 0 },
  { id: 'doc-2', title: 'Literature Review', sort_order: 1 },
  { id: 'doc-3', title: 'Methods', sort_order: 2 },
];

const defaultProps = {
  projectId: 'project-1',
  projectTitle: 'My Research Paper',
  documents: mockDocuments,
  vaultItemCount: 12,
};

describe('ProjectSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders back link to all projects', () => {
    render(<ProjectSidebar {...defaultProps} />);

    const backLink = screen.getByRole('link', { name: /all projects/i });
    expect(backLink).toHaveAttribute('href', '/projects');
  });

  it('renders Documents section with document list', () => {
    render(<ProjectSidebar {...defaultProps} />);

    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Literature Review')).toBeInTheDocument();
    expect(screen.getByText('Methods')).toBeInTheDocument();
  });

  it('renders Vault section with item count', () => {
    render(<ProjectSidebar {...defaultProps} />);

    const vaultLink = screen.getByRole('link', { name: /vault/i });
    expect(vaultLink).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('highlights active section based on current path', async () => {
    const { usePathname } = await import('next/navigation');
    vi.mocked(usePathname).mockReturnValue('/projects/project-1/vault');

    render(<ProjectSidebar {...defaultProps} />);

    const vaultLink = screen.getByRole('link', { name: /vault/i });
    expect(vaultLink).toHaveAttribute('aria-current', 'page');
  });

  it('links documents to correct editor URLs', () => {
    render(<ProjectSidebar {...defaultProps} />);

    const docLink = screen.getByRole('link', { name: /introduction/i });
    expect(docLink).toHaveAttribute('href', '/projects/project-1/documents/doc-1');
  });

  it('shows empty state when no documents', () => {
    render(<ProjectSidebar {...defaultProps} documents={[]} />);

    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
  });

  it('hides vault count badge when count is zero', () => {
    render(<ProjectSidebar {...defaultProps} vaultItemCount={0} />);

    // The "Vault" link should still be visible
    expect(screen.getByRole('link', { name: /vault/i })).toBeInTheDocument();
    // But no count badge
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<ProjectSidebar {...defaultProps} />);

    const nav = screen.getByRole('navigation', { name: /project navigation/i });
    expect(nav).toBeInTheDocument();

    // Document list should be properly labeled
    const docList = screen.getByRole('list', { name: /documents/i });
    expect(docList).toBeInTheDocument();
  });

  it('renders documents in sort_order sequence', () => {
    const unorderedDocs = [
      { id: 'doc-3', title: 'Third', sort_order: 2 },
      { id: 'doc-1', title: 'First', sort_order: 0 },
      { id: 'doc-2', title: 'Second', sort_order: 1 },
    ];
    render(<ProjectSidebar {...defaultProps} documents={unorderedDocs} />);

    const docList = screen.getByRole('list', { name: /documents/i });
    const links = within(docList).getAllByRole('link');

    // Verify order matches sort_order, not insertion order
    expect(links[0]).toHaveTextContent('First');
    expect(links[1]).toHaveTextContent('Second');
    expect(links[2]).toHaveTextContent('Third');
  });
});
