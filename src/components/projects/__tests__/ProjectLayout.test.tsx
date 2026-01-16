import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectLayout } from '../ProjectLayout';

// Mock the LayoutContext
const mockSetProjectData = vi.fn();
vi.mock('@/contexts/LayoutContext', () => ({
  useLayoutContext: () => ({
    projectData: null,
    setProjectData: mockSetProjectData,
  }),
}));

describe('ProjectLayout', () => {
  beforeEach(() => {
    mockSetProjectData.mockClear();
  });

  it('sets projectData on mount', () => {
    render(
      <ProjectLayout
        projectId="123"
        projectTitle="Test Project"
        documents={[{ id: 'd1', title: 'Doc 1', sort_order: 0 }]}
        vaultItemCount={5}
      >
        <div>Content</div>
      </ProjectLayout>
    );

    expect(mockSetProjectData).toHaveBeenCalledWith({
      id: '123',
      title: 'Test Project',
      documents: [{ id: 'd1', title: 'Doc 1', sort_order: 0 }],
      vaultItemCount: 5,
    });
  });

  it('clears projectData on unmount using functional updater', () => {
    const { unmount } = render(
      <ProjectLayout projectId="123" projectTitle="Test Project" documents={[]} vaultItemCount={0}>
        <div>Content</div>
      </ProjectLayout>
    );

    mockSetProjectData.mockClear();
    unmount();

    // Should be called with a function (functional updater)
    expect(mockSetProjectData).toHaveBeenCalledTimes(1);
    const updaterFn = mockSetProjectData.mock.calls[0][0];
    expect(typeof updaterFn).toBe('function');

    // Function should clear only if projectId matches
    expect(updaterFn({ id: '123', title: 'Test', documents: [], vaultItemCount: 0 })).toBeNull();
    expect(updaterFn({ id: '456', title: 'Other', documents: [], vaultItemCount: 0 })).toEqual({
      id: '456',
      title: 'Other',
      documents: [],
      vaultItemCount: 0,
    });
  });

  it('renders children without additional wrapper', () => {
    render(
      <ProjectLayout projectId="123" projectTitle="Test Project" documents={[]} vaultItemCount={0}>
        <div data-testid="child">Content</div>
      </ProjectLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
