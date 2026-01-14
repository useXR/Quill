import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditProjectForm } from '../EditProjectForm';

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('EditProjectForm', () => {
  const mockProject = {
    id: 'project-123',
    title: 'Existing Project',
    description: 'Existing description',
    status: 'draft' as const,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });
  });

  describe('Rendering', () => {
    it('should render form with project data pre-filled', () => {
      render(<EditProjectForm project={mockProject} />);

      expect(screen.getByLabelText(/project title/i)).toHaveValue('Existing Project');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Existing description');
      expect(screen.getByLabelText(/status/i)).toHaveValue('draft');
    });

    it('should render save and cancel buttons', () => {
      render(<EditProjectForm project={mockProject} />);

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render status select with all options', () => {
      render(<EditProjectForm project={mockProject} />);

      const statusSelect = screen.getByLabelText(/status/i);
      expect(statusSelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: /draft/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /submitted/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /funded/i })).toBeInTheDocument();
    });

    it('should handle null description gracefully', () => {
      const projectWithNullDesc = { ...mockProject, description: null };
      render(<EditProjectForm project={projectWithNullDesc} />);

      expect(screen.getByLabelText(/description/i)).toHaveValue('');
    });
  });

  describe('Form Submission', () => {
    it('should call PATCH API with updated data on submit', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `/api/projects/${mockProject.id}`,
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('Updated Title'),
          })
        );
      });
    });

    it('should include description in PATCH request', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const descInput = screen.getByLabelText(/description/i);
      await user.clear(descInput);
      await user.type(descInput, 'Updated description');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `/api/projects/${mockProject.id}`,
          expect.objectContaining({
            body: expect.stringContaining('Updated description'),
          })
        );
      });
    });

    it('should redirect to project page on successful save', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/projects/${mockProject.id}`);
      });
    });

    it('should show loading state while saving', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve(mockProject) }), 100)
          )
      );

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Button should show loading state (isLoading prop)
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });

    it('should show error message on API failure', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to update project' }),
      });

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to update/i);
      });
    });

    it('should handle network errors gracefully', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
      });
    });

    it('should handle non-JSON error responses', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to update/i);
      });
    });
  });

  describe('Validation', () => {
    it('should show error when title is empty', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/title is required/i);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should show error when title exceeds 255 characters', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      // Use fireEvent.change to bypass maxLength attribute for testing validation logic
      fireEvent.change(titleInput, { target: { value: 'A'.repeat(256) } });
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/255 characters/i);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should show error when description exceeds 1000 characters', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const descInput = screen.getByLabelText(/description/i);
      // Use fireEvent.change to bypass maxLength attribute for testing validation logic
      fireEvent.change(descInput, { target: { value: 'B'.repeat(1001) } });
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/1000 characters/i);
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cancel', () => {
    it('should call router.back() when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Character Count', () => {
    it('should show character count for title', () => {
      render(<EditProjectForm project={mockProject} />);

      // "Existing Project" = 16 characters
      expect(screen.getByText(/16\/255/)).toBeInTheDocument();
    });

    it('should show character count for description', () => {
      render(<EditProjectForm project={mockProject} />);

      // "Existing description" = 20 characters
      expect(screen.getByText(/20\/1000/)).toBeInTheDocument();
    });

    it('should update character count when typing', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Test');

      expect(screen.getByText(/4\/255/)).toBeInTheDocument();
    });
  });
});
