import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { VaultPageClient } from '../VaultPageClient';
import { createMockVaultItem } from '@/lib/vault/__tests__/fixtures';
import type { VaultItem } from '@/lib/vault/types';

// Mock child components
vi.mock('@/components/vault/VaultUpload', () => ({
  VaultUpload: vi.fn(({ onUpload }) => (
    <div data-testid="vault-upload">
      <button onClick={onUpload}>Upload</button>
    </div>
  )),
}));

vi.mock('@/components/vault/VaultItemList', () => ({
  VaultItemList: vi.fn(({ items, onDelete, onRetry }) => (
    <div data-testid="vault-item-list">
      {items.map((item: VaultItem) => (
        <div key={item.id} data-testid={`item-${item.id}`}>
          <span>{item.filename}</span>
          <button onClick={() => onDelete(item.id)}>Delete {item.id}</button>
          {item.extraction_status === 'failed' && onRetry && (
            <button onClick={() => onRetry(item.id)}>Retry {item.id}</button>
          )}
        </div>
      ))}
    </div>
  )),
}));

vi.mock('@/components/vault/VaultSearch', () => ({
  VaultSearch: vi.fn(() => <div data-testid="vault-search">Search Component</div>),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('VaultPageClient', () => {
  const projectId = 'test-project-id';
  const mockItems: VaultItem[] = [
    createMockVaultItem({
      id: 'item-1',
      filename: 'research-paper.pdf',
      type: 'pdf',
      extraction_status: 'success',
      chunk_count: 5,
    }),
    createMockVaultItem({
      id: 'item-2',
      filename: 'notes.docx',
      type: 'docx',
      extraction_status: 'pending',
      chunk_count: 0,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all vault components', () => {
    render(<VaultPageClient projectId={projectId} initialItems={mockItems} />);

    expect(screen.getByText('Knowledge Vault')).toBeInTheDocument();
    expect(screen.getByTestId('vault-upload')).toBeInTheDocument();
    expect(screen.getByTestId('vault-search')).toBeInTheDocument();
    expect(screen.getByTestId('vault-item-list')).toBeInTheDocument();
  });

  it('displays initial items', () => {
    render(<VaultPageClient projectId={projectId} initialItems={mockItems} />);

    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.docx')).toBeInTheDocument();
  });

  it('refreshes items after upload', async () => {
    const refreshedItems: VaultItem[] = [
      ...mockItems,
      createMockVaultItem({
        id: 'item-3',
        filename: 'new-file.txt',
        type: 'txt',
        extraction_status: 'pending',
      }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: refreshedItems }),
    });

    const { user } = render(<VaultPageClient projectId={projectId} initialItems={mockItems} />);

    const uploadButton = screen.getByText('Upload');
    await user.click(uploadButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`/api/vault?projectId=${projectId}`);
    });

    await waitFor(() => {
      expect(screen.getByText('new-file.txt')).toBeInTheDocument();
    });
  });

  it('performs optimistic delete', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { user } = render(<VaultPageClient projectId={projectId} initialItems={mockItems} />);

    // Item should be visible initially
    expect(screen.getByTestId('item-item-1')).toBeInTheDocument();

    // Click delete
    const deleteButton = screen.getByText('Delete item-1');
    await user.click(deleteButton);

    // Item should be removed immediately (optimistic)
    expect(screen.queryByTestId('item-item-1')).not.toBeInTheDocument();

    // API should be called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/vault/item-1', {
        method: 'DELETE',
      });
    });
  });

  it('rolls back delete on failure', async () => {
    // Use a deferred promise to control timing of the API response
    let rejectFetch: () => void;
    const fetchPromise = new Promise<Response>((_, reject) => {
      rejectFetch = () => reject(new Error('Delete failed'));
    });

    mockFetch.mockReturnValueOnce(fetchPromise);

    const { user } = render(<VaultPageClient projectId={projectId} initialItems={mockItems} />);

    // Item should be visible initially
    expect(screen.getByTestId('item-item-1')).toBeInTheDocument();

    // Click delete - this starts the async operation
    await user.click(screen.getByText('Delete item-1'));

    // Item should be removed immediately (optimistic update)
    await waitFor(() => {
      expect(screen.queryByTestId('item-item-1')).not.toBeInTheDocument();
    });

    // Now trigger the API failure
    rejectFetch!();

    // After API failure, item should reappear (rollback)
    await waitFor(() => {
      expect(screen.getByTestId('item-item-1')).toBeInTheDocument();
    });

    // Error message should be shown
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
  });

  it('triggers re-extraction on retry', async () => {
    const failedItem = createMockVaultItem({
      id: 'failed-item',
      filename: 'failed.pdf',
      type: 'pdf',
      extraction_status: 'failed',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    // Mock the refresh call that happens after retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [{ ...failedItem, extraction_status: 'pending' }],
        }),
    });

    const { user } = render(<VaultPageClient projectId={projectId} initialItems={[failedItem]} />);

    // Click retry
    const retryButton = screen.getByText('Retry failed-item');
    await user.click(retryButton);

    // API should be called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/vault/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vaultItemId: 'failed-item' }),
      });
    });
  });
});
