import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock
const {
  mockGetUser,
  mockCreateAIOperation,
  mockStreamClaude,
  mockGenerateDiff,
  mockSanitizePrompt,
  mockSanitizeContext,
  mockCreateAuditLog,
  mockRateLimitFn,
  mockSupabaseUpdate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateAIOperation: vi.fn(),
  mockStreamClaude: vi.fn(),
  mockGenerateDiff: vi.fn(),
  mockSanitizePrompt: vi.fn(),
  mockSanitizeContext: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockRateLimitFn: vi.fn(),
  mockSupabaseUpdate: vi.fn(() => ({ eq: vi.fn() })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ update: mockSupabaseUpdate })),
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  createAIOperation: mockCreateAIOperation,
}));

vi.mock('@/lib/ai/streaming', () => ({
  streamClaude: mockStreamClaude,
}));

vi.mock('@/lib/ai/diff-generator', () => ({
  generateDiff: mockGenerateDiff,
}));

vi.mock('@/lib/ai/sanitize', () => ({
  sanitizePrompt: mockSanitizePrompt,
  sanitizeContext: mockSanitizeContext,
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

describe('Global Edit API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRateLimitFn.mockResolvedValue({ success: true, remaining: 9 });
    mockCreateAIOperation.mockResolvedValue({ id: 'op-1', status: 'pending' });
    mockSanitizePrompt.mockImplementation((prompt: string) => prompt);
    mockSanitizeContext.mockImplementation((context: string) => context);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockGenerateDiff.mockReturnValue([{ type: 'add', value: 'Modified', lineNumber: 1 }]);
    mockStreamClaude.mockImplementation((_prompt, onChunk, onComplete) => {
      onChunk('Modified content');
      onComplete();
      return () => {};
    });
    mockSupabaseUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Test',
        currentContent: 'Content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing instruction', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        currentContent: 'Content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 for missing currentContent', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    mockRateLimitFn.mockResolvedValueOnce({ success: false, remaining: 0, retryAfter: 60 });

    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
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

    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: '--help',
        currentContent: 'Original content',
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
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should create AI operation before streaming', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    await POST(request);

    expect(mockCreateAIOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        operationType: 'global',
        inputSummary: 'Make formal',
      })
    );
  });

  it('should create audit log for global edit', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    await POST(request);

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      'ai:global-edit',
      expect.objectContaining({
        userId: 'user-1',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      })
    );
  });

  it('should include X-Operation-Id header', async () => {
    const request = new NextRequest('http://localhost/api/ai/global-edit', {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make formal',
        currentContent: 'Original content',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    });
    const response = await POST(request);
    expect(response.headers.get('X-Operation-Id')).toBeTruthy();
  });
});
