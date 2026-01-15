import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock
const { mockGetUser, mockSaveChatMessage, mockStreamClaude, mockSanitizePrompt, mockCreateAuditLog, mockRateLimitFn } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockSaveChatMessage: vi.fn(),
    mockStreamClaude: vi.fn(),
    mockSanitizePrompt: vi.fn(),
    mockCreateAuditLog: vi.fn(),
    mockRateLimitFn: vi.fn(),
  }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/api/chat', () => ({
  saveChatMessage: mockSaveChatMessage,
}));

vi.mock('@/lib/ai/streaming', () => ({
  streamClaude: mockStreamClaude,
}));

vi.mock('@/lib/ai/sanitize', () => ({
  sanitizePrompt: mockSanitizePrompt,
}));

vi.mock('@/lib/api/audit', () => ({
  createAuditLog: mockCreateAuditLog,
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
import { POST } from '../route';

describe('Streaming Chat API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRateLimitFn.mockResolvedValue({ success: true, remaining: 19 });
    mockSaveChatMessage.mockResolvedValue({ id: 'msg-1' });
    mockSanitizePrompt.mockImplementation((prompt: string) => prompt);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockStreamClaude.mockImplementation((_prompt, onChunk, onComplete) => {
      onChunk('Hello');
      onComplete();
      return () => {};
    });
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ content: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 for missing documentId', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    mockRateLimitFn.mockResolvedValueOnce({ success: false, remaining: 0, retryAfter: 30 });

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('should return 400 for sanitization error', async () => {
    mockSanitizePrompt.mockImplementationOnce(() => {
      throw new Error('Prompt cannot start with CLI flags');
    });

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: '--help inject',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('SANITIZATION_ERROR');
  });

  it('should return SSE stream for valid request', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should save user message before streaming', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    await POST(request);

    expect(mockSaveChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'user',
        content: 'Hello',
      })
    );
  });

  it('should create audit log for AI chat', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        mode: 'discussion',
      }),
    });
    await POST(request);

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      'ai:chat',
      expect.objectContaining({
        userId: 'user-1',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        mode: 'discussion',
      })
    );
  });

  it('should include X-Operation-Id header', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.headers.get('X-Operation-Id')).toBeTruthy();
  });
});
