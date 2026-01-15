import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Mock Supabase
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

function createMockSupabaseClient(): MockSupabaseClient {
  return {
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
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

describe('AI Operations helpers', () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  describe('createAIOperation', () => {
    it('should create operation with pending status', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockOperation = {
        id: 'op-1',
        document_id: 'doc-1',
        user_id: 'test-user-id',
        operation_type: 'global',
        input_summary: 'Test edit',
        snapshot_before: { content: 'Original' },
        output_content: null,
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      };

      const insertMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        insert: insertMock,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockOperation,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createAIOperation } = await import('../ai-operations');
      const result = await createAIOperation({
        documentId: 'doc-1',
        operationType: 'global',
        inputSummary: 'Test edit',
        snapshotBefore: { content: 'Original' },
      });

      expect(result.id).toBe('op-1');
      expect(result.status).toBe('pending');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 'doc-1',
          operation_type: 'global',
          input_summary: 'Test edit',
          status: 'pending',
        })
      );
    });

    it('should throw error when user is not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createAIOperation } = await import('../ai-operations');

      await expect(
        createAIOperation({
          documentId: 'doc-1',
          operationType: 'global',
          inputSummary: 'Test',
          snapshotBefore: { content: 'test' },
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw error on database failure', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createAIOperation } = await import('../ai-operations');

      await expect(
        createAIOperation({
          documentId: 'doc-1',
          operationType: 'global',
          inputSummary: 'Test',
          snapshotBefore: { content: 'test' },
        })
      ).rejects.toThrow();
    });
  });

  describe('updateAIOperationStatus', () => {
    it('should update operation status', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockOperation = {
        id: 'op-1',
        document_id: 'doc-1',
        user_id: 'test-user-id',
        operation_type: 'global',
        input_summary: 'Test edit',
        snapshot_before: { content: 'Original' },
        output_content: 'Updated content',
        status: 'accepted',
        created_at: '2024-01-01T00:00:00Z',
      };

      const updateMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockOperation,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateAIOperationStatus } = await import('../ai-operations');
      const result = await updateAIOperationStatus('op-1', 'accepted', 'Updated content');

      expect(result.status).toBe('accepted');
      expect(result.output_content).toBe('Updated content');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          output_content: 'Updated content',
        })
      );
    });

    it('should update status without output content', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockOperation = {
        id: 'op-1',
        document_id: 'doc-1',
        user_id: 'test-user-id',
        operation_type: 'global',
        input_summary: 'Test edit',
        snapshot_before: { content: 'Original' },
        output_content: null,
        status: 'rejected',
        created_at: '2024-01-01T00:00:00Z',
      };

      const updateMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockOperation,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateAIOperationStatus } = await import('../ai-operations');
      const result = await updateAIOperationStatus('op-1', 'rejected');

      expect(result.status).toBe('rejected');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
        })
      );
    });

    it('should throw error on database failure', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateAIOperationStatus } = await import('../ai-operations');

      await expect(updateAIOperationStatus('op-1', 'accepted')).rejects.toThrow();
    });
  });

  describe('getRecentOperations', () => {
    it('should fetch recent accepted/partial operations', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockOperations = [
        {
          id: 'op-1',
          document_id: 'doc-1',
          user_id: 'test-user-id',
          operation_type: 'global',
          input_summary: 'Test edit',
          snapshot_before: { content: 'Original' },
          output_content: 'Updated',
          status: 'accepted',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const inMock = vi.fn().mockReturnThis();
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: inMock,
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockOperations,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getRecentOperations } = await import('../ai-operations');
      const result = await getRecentOperations('doc-1', 10);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('accepted');
      expect(inMock).toHaveBeenCalledWith('status', ['accepted', 'partial']);
    });

    it('should use default limit of 10', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const limitMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: limitMock,
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getRecentOperations } = await import('../ai-operations');
      await getRecentOperations('doc-1');

      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('should return empty array on database failure', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getRecentOperations } = await import('../ai-operations');

      await expect(getRecentOperations('doc-1')).rejects.toThrow();
    });
  });

  describe('getOperationById', () => {
    it('should return operation when found', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockOperation = {
        id: 'op-1',
        document_id: 'doc-1',
        user_id: 'test-user-id',
        operation_type: 'global',
        input_summary: 'Test edit',
        snapshot_before: { content: 'Original' },
        output_content: 'Updated',
        status: 'accepted',
        created_at: '2024-01-01T00:00:00Z',
      };

      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockOperation,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getOperationById } = await import('../ai-operations');
      const result = await getOperationById('op-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('op-1');
    });

    it('should return null when not found', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getOperationById } = await import('../ai-operations');
      const result = await getOperationById('non-existent');

      expect(result).toBeNull();
    });
  });
});
