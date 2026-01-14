import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { VaultSearch } from '../VaultSearch';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('VaultSearch', () => {
  const defaultProps = {
    projectId: 'test-project-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders search input and button', () => {
    render(<VaultSearch {...defaultProps} />);

    expect(screen.getByPlaceholderText(/search your vault/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('disables search button when query is empty', () => {
    render(<VaultSearch {...defaultProps} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();
  });

  it('calls API on search submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    const { user } = render(<VaultSearch {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search your vault/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'test query');
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vault/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            projectId: 'test-project-id',
            query: 'test query',
          }),
        })
      );
    });
  });

  it('displays search results', async () => {
    const mockResults = [
      {
        content: 'This is a sample chunk of text from the document.',
        similarity: 0.85,
        vaultItemId: 'item-1',
        filename: 'research-paper.pdf',
        chunkIndex: 0,
      },
      {
        content: 'Another relevant chunk from a different file.',
        similarity: 0.72,
        vaultItemId: 'item-2',
        filename: 'notes.docx',
        chunkIndex: 1,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: mockResults }),
    });

    const { user } = render(<VaultSearch {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search your vault/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'sample query');
    await user.click(searchButton);

    await waitFor(() => {
      // Check first result
      expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText(/This is a sample chunk/)).toBeInTheDocument();

      // Check second result
      expect(screen.getByText('notes.docx')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();
      expect(screen.getByText(/Another relevant chunk/)).toBeInTheDocument();
    });
  });

  it('shows no results message when empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    const { user } = render(<VaultSearch {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search your vault/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'nonexistent query');
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });
});
