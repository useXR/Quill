import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { SearchResult } from '@/lib/vault/types';

// Mock the server Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock the embeddings module
vi.mock('@/lib/extraction/embeddings', () => ({
  getEmbedding: vi.fn(),
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

// Helper to create chainable query builder mock
function createQueryBuilderMock(resolveValue: { data: unknown; error: unknown }) {
  const mock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
  };
  // Make the final method in chain resolve the value
  mock.eq.mockImplementation(() => ({
    ...mock,
    limit: vi.fn().mockResolvedValue(resolveValue),
    then: (resolve: (value: typeof resolveValue) => void) => Promise.resolve(resolveValue).then(resolve),
  }));
  return mock;
}

// Type for mocked Supabase client with chainable methods
type MockSupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
};

// Helper to create chainable query builder mock
function createChainableMock(resolvedValue: { data: unknown; error: unknown }) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    // Terminal method - returns the actual promise
    then: (resolve: (value: typeof resolvedValue) => void) => resolve(resolvedValue),
  };
  // Override eq to also be terminal when it's the last call
  chainable.eq = vi.fn().mockReturnValue({
    ...chainable,
    then: (resolve: (value: typeof resolvedValue) => void) => resolve(resolvedValue),
  });
  chainable.select = vi.fn().mockReturnValue({
    ...chainable,
    eq: vi.fn().mockReturnValue({
      ...chainable,
      then: (resolve: (value: typeof resolvedValue) => void) => resolve(resolvedValue),
      limit: vi.fn().mockResolvedValue(resolvedValue),
    }),
  });
  return chainable;
}

function createMockSupabaseClient(overrides: Partial<MockSupabaseClient> = {}): MockSupabaseClient {
  const defaultMock: MockSupabaseClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnValue(createChainableMock({ data: [], error: null })),
  };
  return { ...defaultMock, ...overrides };
}

describe('searchVault', () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns search results with correct structure', async () => {
    // Mock RPC response with snake_case (as returned by PostgreSQL)
    const mockRpcResponse = [
      {
        content: 'This is a test chunk about machine learning.',
        similarity: 0.85,
        vault_item_id: 'vault-item-1',
        filename: 'research-paper.pdf',
        chunk_index: 0,
        heading_context: 'Chapter 1 > Introduction',
      },
      {
        content: 'Another chunk about deep learning techniques.',
        similarity: 0.78,
        vault_item_id: 'vault-item-1',
        filename: 'research-paper.pdf',
        chunk_index: 1,
        heading_context: null,
      },
    ];

    const mockEmbedding = Array(1536).fill(0.1);

    const { createClient } = await import('@/lib/supabase/server');
    const { getEmbedding } = await import('@/lib/extraction/embeddings');

    mockClient.rpc = vi.fn().mockResolvedValue({
      data: mockRpcResponse,
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);
    vi.mocked(getEmbedding).mockResolvedValue(mockEmbedding);

    const { searchVault } = await import('../search');
    const results = await searchVault('project-123', 'machine learning');

    // Verify the function was called with correct parameters
    expect(getEmbedding).toHaveBeenCalledWith('machine learning');
    expect(mockClient.rpc).toHaveBeenCalledWith('search_vault_chunks', {
      query_embedding: JSON.stringify(mockEmbedding),
      match_threshold: 0.5, // Default threshold
      match_count: 10, // Default limit
      p_project_id: 'project-123',
      p_user_id: 'test-user-id',
    });

    // Verify results are transformed to camelCase
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual<SearchResult>({
      content: 'This is a test chunk about machine learning.',
      similarity: 0.85,
      vaultItemId: 'vault-item-1',
      filename: 'research-paper.pdf',
      chunkIndex: 0,
      headingContext: 'Chapter 1 > Introduction',
    });
    expect(results[1]).toEqual<SearchResult>({
      content: 'Another chunk about deep learning techniques.',
      similarity: 0.78,
      vaultItemId: 'vault-item-1',
      filename: 'research-paper.pdf',
      chunkIndex: 1,
      headingContext: null,
    });
  });

  it('returns empty array for no matches', async () => {
    const mockEmbedding = Array(1536).fill(0.1);

    const { createClient } = await import('@/lib/supabase/server');
    const { getEmbedding } = await import('@/lib/extraction/embeddings');

    mockClient.rpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as SupabaseClient<Database>);
    vi.mocked(getEmbedding).mockResolvedValue(mockEmbedding);

    const { searchVault } = await import('../search');
    const results = await searchVault('project-123', 'nonexistent topic xyz');

    expect(results).toEqual([]);
    expect(results).toHaveLength(0);
  });
});
