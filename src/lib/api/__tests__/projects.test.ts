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

describe('Projects API', () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  describe('getProjects', () => {
    it('should return empty array when no projects exist', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getProjects } = await import('../projects');
      const result = await getProjects();

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('should return projects with pagination', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          title: 'Project 1',
          description: 'Description 1',
          status: 'draft',
          user_id: 'test-user-id',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'project-2',
          title: 'Project 2',
          description: 'Description 2',
          status: 'funded',
          user_id: 'test-user-id',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockProjects,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getProjects } = await import('../projects');
      const result = await getProjects({ limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Project 1');
    });

    it('should throw error when user is not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getProjects } = await import('../projects');

      await expect(getProjects()).rejects.toThrow('Unauthorized');
    });
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const mockProject = {
        id: 'new-project-id',
        title: 'New Project',
        description: 'New Description',
        status: 'draft',
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProject,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createProject } = await import('../projects');
      const result = await createProject({ title: 'New Project', description: 'New Description' });

      expect(result.title).toBe('New Project');
      expect(result.id).toBe('new-project-id');
    });

    it('should throw error when user is not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { createProject } = await import('../projects');

      await expect(createProject({ title: 'Test' })).rejects.toThrow('Unauthorized');
    });
  });

  describe('getProject', () => {
    it('should return a project by id', async () => {
      const mockProject = {
        id: 'project-1',
        title: 'Project 1',
        description: 'Description 1',
        status: 'draft',
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProject,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { getProject } = await import('../projects');
      const result = await getProject('project-1');

      expect(result.id).toBe('project-1');
      expect(result.title).toBe('Project 1');
    });

    it('should throw not found error when project does not exist', async () => {
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

      const { getProject } = await import('../projects');

      await expect(getProject('non-existent')).rejects.toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      const mockProject = {
        id: 'project-1',
        title: 'Updated Project',
        description: 'Description 1',
        status: 'submitted',
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProject,
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { updateProject } = await import('../projects');
      const result = await updateProject('project-1', { title: 'Updated Project', status: 'submitted' });

      expect(result.title).toBe('Updated Project');
      expect(result.status).toBe('submitted');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const fromMock = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });
      mockClient.from = fromMock;
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);

      const { deleteProject } = await import('../projects');

      await expect(deleteProject('project-1')).resolves.not.toThrow();
    });
  });
});
