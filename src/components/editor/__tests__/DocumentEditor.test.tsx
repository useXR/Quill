import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentEditor } from '../DocumentEditor';

// Mock the Editor component to avoid TipTap complexity in unit tests
vi.mock('../Editor', () => ({
  Editor: ({ placeholder }: { placeholder?: string }) => <div data-testid="mock-editor">{placeholder || 'Editor'}</div>,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DocumentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Title Editing', () => {
    it('should display document title', () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: { type: 'doc', content: [] },
        version: 1,
        project_id: 'proj-123',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DocumentEditor documentId="doc-123" initialDocument={mockDocument} />);

      expect(screen.getByRole('heading', { name: 'Test Document' })).toBeInTheDocument();
    });

    it('should allow editing title inline', async () => {
      const user = userEvent.setup();
      const mockDocument = {
        id: 'doc-123',
        title: 'Original Title',
        content: { type: 'doc', content: [] },
        version: 1,
        project_id: 'proj-123',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DocumentEditor documentId="doc-123" initialDocument={mockDocument} />);

      await user.click(screen.getByRole('heading', { name: 'Original Title' }));

      expect(screen.getByRole('textbox', { name: /document title/i })).toBeInTheDocument();
    });

    it('should show Untitled Document for empty title', () => {
      const mockDocument = {
        id: 'doc-123',
        title: '',
        content: { type: 'doc', content: [] },
        version: 1,
        project_id: 'proj-123',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DocumentEditor documentId="doc-123" initialDocument={mockDocument} />);

      expect(screen.getByRole('heading', { name: 'Untitled Document' })).toBeInTheDocument();
    });
  });
});
