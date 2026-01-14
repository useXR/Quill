import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils/render';
import { ProjectLayout } from '../ProjectLayout';

// Mock ProjectSidebar to isolate layout testing
vi.mock('../ProjectSidebar', () => ({
  ProjectSidebar: vi.fn(({ projectTitle }) => <nav data-testid="project-sidebar">{projectTitle}</nav>),
}));

const defaultProps = {
  projectId: 'project-1',
  projectTitle: 'My Research Paper',
  documents: [],
  vaultItemCount: 5,
};

describe('ProjectLayout', () => {
  it('renders sidebar and main content area', () => {
    render(
      <ProjectLayout {...defaultProps}>
        <div data-testid="page-content">Page content</div>
      </ProjectLayout>
    );

    expect(screen.getByTestId('project-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('passes correct props to sidebar', async () => {
    const { ProjectSidebar } = await import('../ProjectSidebar');
    const mockedSidebar = vi.mocked(ProjectSidebar);

    render(
      <ProjectLayout {...defaultProps}>
        <div>Content</div>
      </ProjectLayout>
    );

    expect(mockedSidebar).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        projectTitle: 'My Research Paper',
        vaultItemCount: 5,
      }),
      undefined
    );
  });

  it('renders with correct layout structure', () => {
    render(
      <ProjectLayout {...defaultProps}>
        <div>Content</div>
      </ProjectLayout>
    );

    // Main container should use flexbox
    const container = screen.getByTestId('project-layout');
    expect(container).toHaveClass('flex');
  });

  it('main content area fills remaining width', () => {
    render(
      <ProjectLayout {...defaultProps}>
        <div>Content</div>
      </ProjectLayout>
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1');
  });
});
