import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Type for mocked Supabase client with chainable methods
type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>;
};

function createMockSupabaseClient(): MockSupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      returns: vi.fn().mockReturnThis(),
    }),
  };
}

describe('Chat API helpers', () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  describe('getChatHistory', () => {
    it('should fetch paginated chat history', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockMessages = [
        {
          id: '1',
          project_id: 'project-1',
          document_id: 'doc-1',
          role: 'user',
          content: 'Hello',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      // Create a chainable mock where all methods return `this` and returns() resolves with data
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: mockMessages,
          error: null,
        }),
      };
      // Make all methods return the chainMock itself for chaining
      chainMock.select.mockReturnValue(chainMock);
      chainMock.eq.mockReturnValue(chainMock);
      chainMock.order.mockReturnValue(chainMock);
      chainMock.limit.mockReturnValue(chainMock);
      chainMock.lt.mockReturnValue(chainMock);

      const fromMock = vi.fn().mockReturnValue(chainMock);
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getChatHistory } = await import('../chat');
      const result = await getChatHistory('project-1', 'doc-1', { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].content).toBe('Hello');
      expect(result.hasMore).toBe(false);
    });

    it('should return hasMore true when more results exist', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      // Return 3 items when limit is 2 (we fetch limit + 1 to check for more)
      const mockMessages = [
        {
          id: '1',
          project_id: 'project-1',
          document_id: null,
          role: 'user',
          content: 'First',
          created_at: '2024-01-03T00:00:00Z',
        },
        {
          id: '2',
          project_id: 'project-1',
          document_id: null,
          role: 'assistant',
          content: 'Second',
          created_at: '2024-01-02T00:00:00Z',
        },
        {
          id: '3',
          project_id: 'project-1',
          document_id: null,
          role: 'user',
          content: 'Third',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: mockMessages,
          error: null,
        }),
      };
      chainMock.select.mockReturnValue(chainMock);
      chainMock.eq.mockReturnValue(chainMock);
      chainMock.order.mockReturnValue(chainMock);
      chainMock.limit.mockReturnValue(chainMock);
      chainMock.lt.mockReturnValue(chainMock);

      const fromMock = vi.fn().mockReturnValue(chainMock);
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getChatHistory } = await import('../chat');
      const result = await getChatHistory('project-1', undefined, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('2024-01-02T00:00:00Z');
    });

    it('should apply cursor filter when provided', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const ltMock = vi.fn();
      const returnsMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lt: ltMock,
        returns: returnsMock,
      };
      chainMock.select.mockReturnValue(chainMock);
      chainMock.eq.mockReturnValue(chainMock);
      chainMock.order.mockReturnValue(chainMock);
      chainMock.limit.mockReturnValue(chainMock);
      ltMock.mockReturnValue(chainMock);

      const fromMock = vi.fn().mockReturnValue(chainMock);
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getChatHistory } = await import('../chat');
      await getChatHistory('project-1', undefined, { cursor: '2024-01-01T00:00:00Z' });

      expect(ltMock).toHaveBeenCalledWith('created_at', '2024-01-01T00:00:00Z');
    });

    it('should throw error on database failure', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      chainMock.select.mockReturnValue(chainMock);
      chainMock.eq.mockReturnValue(chainMock);
      chainMock.order.mockReturnValue(chainMock);
      chainMock.limit.mockReturnValue(chainMock);
      chainMock.lt.mockReturnValue(chainMock);

      const fromMock = vi.fn().mockReturnValue(chainMock);
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getChatHistory } = await import('../chat');

      await expect(getChatHistory('project-1')).rejects.toThrow();
    });
  });

  describe('saveChatMessage', () => {
    it('should save message and return it', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockMessage = {
        id: '1',
        project_id: 'project-1',
        document_id: 'doc-1',
        role: 'user',
        content: 'Hello',
        created_at: '2024-01-01T00:00:00Z',
      };

      const fromMock = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockMessage,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { saveChatMessage } = await import('../chat');
      const result = await saveChatMessage({
        projectId: 'project-1',
        documentId: 'doc-1',
        role: 'user',
        content: 'Hello',
      });

      expect(result.content).toBe('Hello');
      expect(result.role).toBe('user');
      expect(result.id).toBe('1');
    });

    it('should save message without documentId', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const insertMock = vi.fn().mockReturnThis();
      const mockMessage = {
        id: '1',
        project_id: 'project-1',
        document_id: null,
        role: 'assistant',
        content: 'Response',
        created_at: '2024-01-01T00:00:00Z',
      };

      const fromMock = vi.fn().mockReturnValue({
        insert: insertMock,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockMessage,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { saveChatMessage } = await import('../chat');
      const result = await saveChatMessage({
        projectId: 'project-1',
        role: 'assistant',
        content: 'Response',
      });

      expect(result.content).toBe('Response');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'project-1',
          document_id: null,
          role: 'assistant',
          content: 'Response',
        })
      );
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

      const { saveChatMessage } = await import('../chat');

      await expect(
        saveChatMessage({
          projectId: 'project-1',
          role: 'user',
          content: 'Hello',
        })
      ).rejects.toThrow();
    });
  });

  describe('clearChatHistory', () => {
    it('should delete all messages for a project', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      const fromMock = vi.fn().mockReturnValue({
        delete: deleteMock,
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { clearChatHistory } = await import('../chat');
      await clearChatHistory('project-1');

      expect(fromMock).toHaveBeenCalledWith('chat_history');
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('project_id', 'project-1');
    });

    it('should delete messages for specific document when documentId provided', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const secondEqMock = vi.fn().mockResolvedValue({ error: null });
      const firstEqMock = vi.fn().mockReturnValue({
        eq: secondEqMock,
      });
      const deleteMock = vi.fn().mockReturnValue({
        eq: firstEqMock,
      });

      const fromMock = vi.fn().mockReturnValue({
        delete: deleteMock,
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { clearChatHistory } = await import('../chat');
      await clearChatHistory('project-1', 'doc-1');

      expect(firstEqMock).toHaveBeenCalledWith('project_id', 'project-1');
      expect(secondEqMock).toHaveBeenCalledWith('document_id', 'doc-1');
    });

    it('should throw error on database failure', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Database error' },
          }),
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { clearChatHistory } = await import('../chat');

      await expect(clearChatHistory('project-1')).rejects.toThrow();
    });
  });
});
