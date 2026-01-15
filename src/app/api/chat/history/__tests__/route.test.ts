import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock
const { mockGetUser, mockGetChatHistory, mockClearChatHistory, mockRateLimitFn } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetChatHistory: vi.fn(),
  mockClearChatHistory: vi.fn(),
  mockRateLimitFn: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/api/chat', () => ({
  getChatHistory: mockGetChatHistory,
  clearChatHistory: mockClearChatHistory,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => mockRateLimitFn),
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
import { GET, DELETE } from '../route';

describe('Chat History API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRateLimitFn.mockResolvedValue({ success: true, remaining: 99 });
    mockGetChatHistory.mockResolvedValue({ data: [], hasMore: false, nextCursor: null });
    mockClearChatHistory.mockResolvedValue(undefined);
  });

  describe('GET /api/chat/history', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const request = new NextRequest(
        'http://localhost/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await GET(request);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid projectId', async () => {
      const request = new NextRequest('http://localhost/api/chat/history?projectId=invalid');
      const response = await GET(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when projectId is missing', async () => {
      const request = new NextRequest('http://localhost/api/chat/history');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('should return chat history for valid request', async () => {
      const request = new NextRequest(
        'http://localhost/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('hasMore');
    });

    it('should pass documentId filter to getChatHistory', async () => {
      const request = new NextRequest(
        'http://localhost/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000&documentId=660e8400-e29b-41d4-a716-446655440001'
      );
      await GET(request);

      expect(mockGetChatHistory).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
        expect.any(Object)
      );
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimitFn.mockResolvedValueOnce({ success: false, remaining: 0, retryAfter: 30 });

      const request = new NextRequest(
        'http://localhost/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await GET(request);
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.retryAfter).toBe(30);
    });
  });

  describe('DELETE /api/chat/history', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const request = new NextRequest('http://localhost/api/chat/history', {
        method: 'DELETE',
        body: JSON.stringify({ projectId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 when projectId is missing', async () => {
      const request = new NextRequest('http://localhost/api/chat/history', {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      const response = await DELETE(request);
      expect(response.status).toBe(400);
    });

    it('should clear chat history for valid request', async () => {
      const request = new NextRequest('http://localhost/api/chat/history', {
        method: 'DELETE',
        body: JSON.stringify({ projectId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const response = await DELETE(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(mockClearChatHistory).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', undefined);
    });

    it('should clear chat history for specific document', async () => {
      const request = new NextRequest('http://localhost/api/chat/history', {
        method: 'DELETE',
        body: JSON.stringify({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          documentId: '660e8400-e29b-41d4-a716-446655440001',
        }),
      });
      const response = await DELETE(request);
      expect(response.status).toBe(200);

      expect(mockClearChatHistory).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001'
      );
    });
  });
});
