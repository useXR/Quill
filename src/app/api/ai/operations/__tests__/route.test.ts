import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock
const { mockGetUser, mockGetRecentOperations } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetRecentOperations: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  getRecentOperations: mockGetRecentOperations,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import route after mocks are set up
import { GET } from '../route';

describe('AI Operations List Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockGetRecentOperations.mockResolvedValue([
      { id: 'op-1', status: 'accepted', operation_type: 'global' },
      { id: 'op-2', status: 'partial', operation_type: 'selection' },
    ]);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest(
      'http://localhost/api/ai/operations?documentId=550e8400-e29b-41d4-a716-446655440000'
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 when documentId missing', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations');
    const response = await GET(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return operations for valid request', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/operations?documentId=550e8400-e29b-41d4-a716-446655440000'
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('op-1');
  });

  it('should pass limit parameter to getRecentOperations', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/operations?documentId=550e8400-e29b-41d4-a716-446655440000&limit=5'
    );
    await GET(request);

    expect(mockGetRecentOperations).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', 5);
  });

  it('should use default limit of 10', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/operations?documentId=550e8400-e29b-41d4-a716-446655440000'
    );
    await GET(request);

    expect(mockGetRecentOperations).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', 10);
  });

  it('should return 500 on error', async () => {
    mockGetRecentOperations.mockRejectedValueOnce(new Error('Database error'));

    const request = new NextRequest(
      'http://localhost/api/ai/operations?documentId=550e8400-e29b-41d4-a716-446655440000'
    );
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});
