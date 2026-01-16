import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

// Mock usePathname
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock LayoutContext
const mockUseLayoutContext = vi.fn();
vi.mock('@/contexts/LayoutContext', () => ({
  useLayoutContext: () => mockUseLayoutContext(),
}));

// Mock SidebarSkeleton
vi.mock('../SidebarSkeleton', () => ({
  SidebarSkeleton: ({ isCollapsed }: { isCollapsed?: boolean }) => (
    <aside data-testid="sidebar-skeleton" data-collapsed={isCollapsed}>
      Loading...
    </aside>
  ),
}));

describe('Sidebar - App Level View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: app-level view (no project data)
    mockUsePathname.mockReturnValue('/projects');
    mockUseLayoutContext.mockReturnValue({
      projectData: null,
      setProjectData: vi.fn(),
    });
  });

  it('renders app-level navigation when projectData is null', () => {
    render(<Sidebar />);

    // App-level only shows Projects (Vault and Citations are project-scoped)
    expect(screen.getByTestId('nav-item-projects')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-item-vault')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-item-citations')).not.toBeInTheDocument();
  });

  it('has correct aria-label for app-level view', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Main navigation');
  });

  it('does not show skeleton when on app-level route', () => {
    render(<Sidebar />);

    expect(screen.queryByTestId('sidebar-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });
});

describe('Sidebar - Skeleton Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton when on project route but projectData is null', () => {
    mockUsePathname.mockReturnValue('/projects/123');
    mockUseLayoutContext.mockReturnValue({
      projectData: null,
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByTestId('sidebar-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
  });

  it('shows skeleton when on nested project route but projectData is null', () => {
    mockUsePathname.mockReturnValue('/projects/abc-123/documents/doc-1');
    mockUseLayoutContext.mockReturnValue({
      projectData: null,
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByTestId('sidebar-skeleton')).toBeInTheDocument();
  });

  it('passes isCollapsed prop to SidebarSkeleton', () => {
    mockUsePathname.mockReturnValue('/projects/123');
    mockUseLayoutContext.mockReturnValue({
      projectData: null,
      setProjectData: vi.fn(),
    });

    render(<Sidebar isCollapsed={true} />);

    const skeleton = screen.getByTestId('sidebar-skeleton');
    expect(skeleton).toHaveAttribute('data-collapsed', 'true');
  });
});

describe('Sidebar - Project Level View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/projects/proj-1');
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: 'proj-1',
        title: 'My Research Project',
        documents: [
          { id: 'doc-1', title: 'Chapter 1', sort_order: 0 },
          { id: 'doc-2', title: 'Chapter 2', sort_order: 1 },
        ],
        vaultItemCount: 5,
      },
      setProjectData: vi.fn(),
    });
  });

  it('renders sidebar (not skeleton) when projectData is present', () => {
    render(<Sidebar />);

    // Should render the sidebar, not the skeleton
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-skeleton')).not.toBeInTheDocument();
  });

  it('has correct aria-label for project-level view', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Project: My Research Project navigation');
  });

  it('renders back link to projects', () => {
    render(<Sidebar />);

    const backLink = screen.getByRole('link', { name: /all projects/i });
    expect(backLink).toHaveAttribute('href', '/projects');
  });

  it('renders project title', () => {
    render(<Sidebar />);

    expect(screen.getByText('My Research Project')).toBeInTheDocument();
  });

  it('renders documents section with list', () => {
    render(<Sidebar />);

    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
  });

  it('renders vault link with count badge', () => {
    render(<Sidebar />);

    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders citations link', () => {
    render(<Sidebar />);

    expect(screen.getByText('Citations')).toBeInTheDocument();
  });

  it('renders documents in sorted order by sort_order', () => {
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: 'proj-1',
        title: 'My Research Project',
        documents: [
          { id: 'doc-3', title: 'Chapter 3', sort_order: 2 },
          { id: 'doc-1', title: 'Chapter 1', sort_order: 0 },
          { id: 'doc-2', title: 'Chapter 2', sort_order: 1 },
        ],
        vaultItemCount: 5,
      },
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    const docLinks = screen.getAllByRole('link').filter((link) => {
      const href = link.getAttribute('href');
      return href?.includes('/documents/');
    });

    expect(docLinks).toHaveLength(3);
    expect(docLinks[0]).toHaveTextContent('Chapter 1');
    expect(docLinks[1]).toHaveTextContent('Chapter 2');
    expect(docLinks[2]).toHaveTextContent('Chapter 3');
  });

  it('shows "No documents yet" when documents array is empty', () => {
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: 'proj-1',
        title: 'My Research Project',
        documents: [],
        vaultItemCount: 0,
      },
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByText('No documents yet')).toBeInTheDocument();
  });

  it('does not show vault count badge when count is 0', () => {
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: 'proj-1',
        title: 'My Research Project',
        documents: [],
        vaultItemCount: 0,
      },
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('marks Documents link as active when on project root', () => {
    mockUsePathname.mockReturnValue('/projects/proj-1');

    render(<Sidebar />);

    const documentsLink = screen.getByRole('link', { name: /documents/i });
    expect(documentsLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks Documents link as active when on a document page', () => {
    mockUsePathname.mockReturnValue('/projects/proj-1/documents/doc-1');

    render(<Sidebar />);

    const documentsLink = screen.getByRole('link', { name: /documents/i });
    expect(documentsLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks Vault link as active when on vault page', () => {
    mockUsePathname.mockReturnValue('/projects/proj-1/vault');

    render(<Sidebar />);

    const vaultLink = screen.getByRole('link', { name: /vault/i });
    expect(vaultLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks Citations link as active when on citations page', () => {
    mockUsePathname.mockReturnValue('/projects/proj-1/citations');

    render(<Sidebar />);

    const citationsLink = screen.getByRole('link', { name: /citations/i });
    expect(citationsLink).toHaveAttribute('aria-current', 'page');
  });
});
