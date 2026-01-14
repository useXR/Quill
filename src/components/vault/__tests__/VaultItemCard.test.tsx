import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils/render';
import { createMockVaultItem } from '@/lib/vault/__tests__/fixtures';
import { VaultItemCard } from '../VaultItemCard';

describe('VaultItemCard', () => {
  const mockOnDelete = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filename', () => {
    const item = createMockVaultItem({ filename: 'my-research-paper.pdf' });
    render(<VaultItemCard item={item} onDelete={mockOnDelete} />);

    expect(screen.getByText('my-research-paper.pdf')).toBeInTheDocument();
  });

  it('shows extraction status', () => {
    const item = createMockVaultItem({ extraction_status: 'pending' });
    render(<VaultItemCard item={item} onDelete={mockOnDelete} />);

    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('shows chunk count for processed items', () => {
    const item = createMockVaultItem({
      extraction_status: 'success',
      chunk_count: 12,
    });
    render(<VaultItemCard item={item} onDelete={mockOnDelete} />);

    expect(screen.getByText(/12 chunks/i)).toBeInTheDocument();
  });

  it('shows file type icon for PDF', () => {
    const item = createMockVaultItem({ type: 'pdf' });
    render(<VaultItemCard item={item} onDelete={mockOnDelete} />);

    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', async () => {
    const item = createMockVaultItem({ id: 'item-123' });
    const { user } = render(<VaultItemCard item={item} onDelete={mockOnDelete} />);

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('item-123');
  });

  it('shows retry button when status is failed', async () => {
    const item = createMockVaultItem({
      id: 'item-456',
      extraction_status: 'failed',
    });
    const { user } = render(<VaultItemCard item={item} onDelete={mockOnDelete} onRetry={mockOnRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(mockOnRetry).toHaveBeenCalledWith('item-456');
  });

  it('shows spinner for processing states', () => {
    const item = createMockVaultItem({ extraction_status: 'extracting' });
    render(<VaultItemCard item={item} onDelete={mockOnDelete} />);

    expect(screen.getByTestId('status-spinner')).toBeInTheDocument();
  });
});
