import type { VaultItem, VaultChunk } from '../types';

export const mockVaultItem: VaultItem = {
  id: 'vault-item-1',
  user_id: 'user-1',
  project_id: 'project-1',
  type: 'pdf',
  filename: 'research-paper.pdf',
  storage_path: 'user-1/project-1/research-paper.pdf',
  extracted_text: 'Sample extracted text from PDF document.',
  extraction_status: 'success',
  chunk_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  file_size: 1024000,
  mime_type: 'application/pdf',
  source_url: null,
};

export const mockVaultChunk: VaultChunk = {
  id: 'chunk-1',
  vault_item_id: 'vault-item-1',
  content: 'This is the first chunk of text from the document.',
  embedding: null, // Usually a 1536-dimension vector
  chunk_index: 0,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockVaultItems: VaultItem[] = [
  mockVaultItem,
  { ...mockVaultItem, id: 'vault-item-2', filename: 'notes.txt', type: 'txt' },
  { ...mockVaultItem, id: 'vault-item-3', filename: 'report.docx', type: 'docx', extraction_status: 'pending' },
];

export function createMockVaultItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return { ...mockVaultItem, ...overrides };
}
