import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Mock the server Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
  return { ...defaultMock, ...overrides };
}

describe('Documents API', () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockClient = createMockSupabaseClient();
  });

  describe('getDocuments', () => {
    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getDocuments } = await import('../documents');

      await expect(getDocuments('project-1')).rejects.toThrow('Unauthorized');
    });

    it('should return documents for a project ordered by sort_order', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          project_id: 'project-1',
          title: 'First Document',
          content: null,
          content_text: null,
          sort_order: 1,
          version: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'doc-2',
          project_id: 'project-1',
          title: 'Second Document',
          content: null,
          content_text: null,
          sort_order: 2,
          version: 1,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockDocuments,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getDocuments } = await import('../documents');
      const result = await getDocuments('project-1');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('First Document');
      expect(result[1].title).toBe('Second Document');
    });

    it('should return empty array when no documents exist', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getDocuments } = await import('../documents');
      const result = await getDocuments('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('getDocument', () => {
    it('should return a document by id', async () => {
      const mockDocument = {
        id: 'doc-1',
        project_id: 'project-1',
        title: 'Test Document',
        content: { type: 'doc', content: [] },
        content_text: 'Some text',
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getDocument } = await import('../documents');
      const result = await getDocument('doc-1');

      expect(result.id).toBe('doc-1');
      expect(result.title).toBe('Test Document');
    });

    it('should throw NOT_FOUND when document does not exist', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getDocument } = await import('../documents');

      await expect(getDocument('non-existent')).rejects.toThrow('Document not found');
    });
  });

  describe('createDocument', () => {
    it('should create a document with auto-incremented sort_order', async () => {
      const mockDocument = {
        id: 'new-doc-id',
        project_id: 'project-1',
        title: 'New Document',
        content: null,
        content_text: null,
        sort_order: 3,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');

      // Mock for getting max sort_order
      const selectMaxMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { sort_order: 2 },
          error: null,
        }),
      });

      // Mock for insert
      const insertMock = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      });

      let callCount = 0;
      mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return selectMaxMock();
        }
        return insertMock();
      });

      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createDocument } = await import('../documents');
      const result = await createDocument({ project_id: 'project-1', title: 'New Document' });

      expect(result.title).toBe('New Document');
      expect(result.id).toBe('new-doc-id');
    });

    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createDocument } = await import('../documents');

      await expect(createDocument({ project_id: 'project-1', title: 'Test' })).rejects.toThrow('Unauthorized');
    });
  });

  describe('updateDocument', () => {
    it('should update a document successfully', async () => {
      const mockDocument = {
        id: 'doc-1',
        project_id: 'project-1',
        title: 'Updated Document',
        content: { type: 'doc', content: [] },
        content_text: 'Updated text',
        sort_order: 1,
        version: 2,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateDocument } = await import('../documents');
      const result = await updateDocument('doc-1', { title: 'Updated Document' });

      expect(result.title).toBe('Updated Document');
    });

    it('should throw CONFLICT on version mismatch', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      // Mock for version check - returns current version 3, but client expects version 2
      const selectVersionMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { version: 3 },
          error: null,
        }),
      });

      mockClient.from = selectVersionMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateDocument } = await import('../documents');

      await expect(updateDocument('doc-1', { title: 'Updated', expectedVersion: 2 })).rejects.toThrow(
        'Version conflict detected'
      );
    });

    it('should increment version when expectedVersion is provided and matches', async () => {
      const mockDocument = {
        id: 'doc-1',
        project_id: 'project-1',
        title: 'Updated Document',
        content: null,
        content_text: null,
        sort_order: 1,
        version: 3,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');

      // First call: version check
      const selectVersionMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { version: 2 },
          error: null,
        }),
      });

      // Second call: update
      const updateMock = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      });

      let callCount = 0;
      mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return selectVersionMock();
        }
        return updateMock();
      });

      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateDocument } = await import('../documents');
      const result = await updateDocument('doc-1', { title: 'Updated Document', expectedVersion: 2 });

      expect(result.version).toBe(3);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document successfully', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { deleteDocument } = await import('../documents');

      await expect(deleteDocument('doc-1')).resolves.not.toThrow();
    });

    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { deleteDocument } = await import('../documents');

      await expect(deleteDocument('doc-1')).rejects.toThrow('Unauthorized');
    });
  });
});
