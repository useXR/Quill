import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils/render';
import { VaultItemList } from '../VaultItemList';
import { createMockVaultItem } from '@/lib/vault/__tests__/fixtures';
import type { VaultItem } from '@/lib/vault/types';

const mockItems: VaultItem[] = [
  createMockVaultItem({
    id: '1',
    filename: 'research-paper.pdf',
    type: 'pdf',
    extraction_status: 'success',
    chunk_count: 5,
  }),
  createMockVaultItem({
    id: '2',
    filename: 'notes.docx',
    type: 'docx',
    extraction_status: 'pending',
    chunk_count: 0,
  }),
];

describe('VaultItemList', () => {
  it('renders list of vault items', () => {
    render(<VaultItemList items={mockItems} onDelete={() => {}} />);

    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.docx')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<VaultItemList items={[]} onDelete={() => {}} />);

    expect(screen.getByText(/no files uploaded/i)).toBeInTheDocument();
  });

  it('passes onDelete to each item', () => {
    const mockDelete = vi.fn();
    render(<VaultItemList items={mockItems} onDelete={mockDelete} />);

    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });
});
