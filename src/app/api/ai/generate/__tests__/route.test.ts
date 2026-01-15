/**
 * Tests for the SSE streaming AI generation endpoint.
 *
 * These tests verify authentication, validation, and SSE stream behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock ClaudeStream
vi.mock('@/lib/ai', () => ({
  ClaudeStream: vi.fn().mockImplementation(() => ({
    stream: vi.fn().mockImplementation((_prompt, callbacks) => {
      callbacks.onChunk({ id: 'chunk-0', sequence: 0, content: 'Test', done: false });
      callbacks.onComplete();
      return Promise.resolve();
    }),
    cancel: vi.fn(),
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { createClient } from '@/lib/supabase/server';

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 400 if prompt missing', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null }),
      },
    } as any);

    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Prompt required');
  });

  it('should return 400 if prompt is empty string', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null }),
      },
    } as any);

    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Prompt required');
  });

  it('should return SSE stream with correct headers', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null }),
      },
    } as any);

    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const response = await POST(request);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Stream-Id')).toBeDefined();
  });
});
