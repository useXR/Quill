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

    expect(screen.getByTestId('nav-item-projects')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-vault')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-citations')).toBeInTheDocument();
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

describe('Sidebar - Project Level View (placeholder)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar (not skeleton) when projectData is present', () => {
    mockUsePathname.mockReturnValue('/projects/123');
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: '123',
        title: 'Test Project',
        documents: [],
        vaultItemCount: 0,
      },
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    // Should render the sidebar, not the skeleton
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-skeleton')).not.toBeInTheDocument();
  });

  it('has correct aria-label for project-level view', () => {
    mockUsePathname.mockReturnValue('/projects/123');
    mockUseLayoutContext.mockReturnValue({
      projectData: {
        id: '123',
        title: 'My Research Paper',
        documents: [],
        vaultItemCount: 0,
      },
      setProjectData: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Project: My Research Paper navigation');
  });
});
