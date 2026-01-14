import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { VaultItem } from '@/lib/vault/types';

// Mock the server Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock the audit module
vi.mock('@/lib/api/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Type for mocked Supabase client with chainable methods
type MockSupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

function createMockSupabaseClient(overrides: Partial<MockSupabaseClient> = {}): MockSupabaseClient {
  const defaultMock: MockSupabaseClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
  return { ...defaultMock, ...overrides };
}

describe('Vault API', () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('createVaultItem', () => {
    it('creates item with correct data', async () => {
      const mockItem: VaultItem = {
        id: 'new-vault-item-id',
        user_id: 'test-user-id',
        project_id: 'project-1',
        type: 'pdf',
        filename: 'test-document.pdf',
        storage_path: 'test-user-id/project-1/test-document.pdf',
        extracted_text: null,
        extraction_status: 'pending',
        chunk_count: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        file_size: 1024,
        mime_type: 'application/pdf',
        source_url: null,
      };

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockItem,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createVaultItem } = await import('../vault');
      const result = await createVaultItem({
        projectId: 'project-1',
        filename: 'test-document.pdf',
        storagePath: 'test-user-id/project-1/test-document.pdf',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      });

      expect(result.id).toBe('new-vault-item-id');
      expect(result.filename).toBe('test-document.pdf');
      expect(result.extraction_status).toBe('pending');
      expect(fromMock).toHaveBeenCalledWith('vault_items');
    });

    it('throws when not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createVaultItem } = await import('../vault');

      await expect(
        createVaultItem({
          projectId: 'project-1',
          filename: 'test.pdf',
          storagePath: 'path/to/file.pdf',
          fileType: 'pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
        })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('getVaultItems', () => {
    it('returns items for a project', async () => {
      const mockItems: VaultItem[] = [
        {
          id: 'vault-item-1',
          user_id: 'test-user-id',
          project_id: 'project-1',
          type: 'pdf',
          filename: 'document1.pdf',
          storage_path: 'path/to/doc1.pdf',
          extracted_text: 'Text content',
          extraction_status: 'success',
          chunk_count: 5,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
          file_size: 1024,
          mime_type: 'application/pdf',
          source_url: null,
        },
        {
          id: 'vault-item-2',
          user_id: 'test-user-id',
          project_id: 'project-1',
          type: 'txt',
          filename: 'notes.txt',
          storage_path: 'path/to/notes.txt',
          extracted_text: 'Notes content',
          extraction_status: 'success',
          chunk_count: 2,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          deleted_at: null,
          file_size: 512,
          mime_type: 'text/plain',
          source_url: null,
        },
      ];

      const { createClient } = await import('@/lib/supabase/server');
      const isMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: isMock,
        order: vi.fn().mockResolvedValue({
          data: mockItems,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getVaultItems } = await import('../vault');
      const result = await getVaultItems('project-1');

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('document1.pdf');
      expect(result[1].filename).toBe('notes.txt');
    });

    it('filters out soft-deleted items', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const isMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: isMock,
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getVaultItems } = await import('../vault');
      await getVaultItems('project-1');

      // Verify that .is('deleted_at', null) was called to filter out soft-deleted items
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });
  });

  describe('softDeleteVaultItem', () => {
    it('sets deleted_at timestamp', async () => {
      const mockUpdatedItem: VaultItem = {
        id: 'vault-item-1',
        user_id: 'test-user-id',
        project_id: 'project-1',
        type: 'pdf',
        filename: 'document.pdf',
        storage_path: 'path/to/doc.pdf',
        extracted_text: 'Text',
        extraction_status: 'success',
        chunk_count: 5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: '2024-01-15T00:00:00Z',
        file_size: 1024,
        mime_type: 'application/pdf',
        source_url: null,
      };

      const { createClient } = await import('@/lib/supabase/server');
      const updateMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUpdatedItem,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { softDeleteVaultItem } = await import('../vault');
      const result = await softDeleteVaultItem('vault-item-1');

      expect(result.deleted_at).not.toBeNull();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
        })
      );
    });
  });

  describe('restoreVaultItem', () => {
    it('clears deleted_at timestamp', async () => {
      const mockRestoredItem: VaultItem = {
        id: 'vault-item-1',
        user_id: 'test-user-id',
        project_id: 'project-1',
        type: 'pdf',
        filename: 'document.pdf',
        storage_path: 'path/to/doc.pdf',
        extracted_text: 'Text',
        extraction_status: 'success',
        chunk_count: 5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        file_size: 1024,
        mime_type: 'application/pdf',
        source_url: null,
      };

      const { createClient } = await import('@/lib/supabase/server');
      const updateMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockRestoredItem,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { restoreVaultItem } = await import('../vault');
      const result = await restoreVaultItem('vault-item-1');

      expect(result.deleted_at).toBeNull();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: null,
        })
      );
    });
  });
});

describe('sanitizeFilename', () => {
  it('removes path traversal attempts', async () => {
    const { sanitizeFilename } = await import('@/lib/utils/filename');

    // Path traversal attempt: ../../../etc/passwd -> ______etc_passwd
    const result = sanitizeFilename('../../../etc/passwd');
    expect(result).toBe('______etc_passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });

  it('removes null bytes, special characters, and limits length', async () => {
    const { sanitizeFilename } = await import('@/lib/utils/filename');

    // Test null byte removal
    const withNullByte = sanitizeFilename('test\x00file.pdf');
    expect(withNullByte).not.toContain('\x00');
    expect(withNullByte).toBe('testfile.pdf');

    // Test special characters removal (<>:"|?*)
    const withSpecialChars = sanitizeFilename('file<name>:test|"doc"?.pdf');
    expect(withSpecialChars).not.toMatch(/[<>:"|?*]/);

    // Test length limit (255 chars, preserve extension)
    const longName = 'a'.repeat(300) + '.pdf';
    const truncated = sanitizeFilename(longName);
    expect(truncated.length).toBeLessThanOrEqual(255);
    expect(truncated).toMatch(/\.pdf$/);

    // Test empty result returns 'unnamed'
    const emptyResult = sanitizeFilename('..../////');
    expect(emptyResult).toBe('unnamed');
  });
});
