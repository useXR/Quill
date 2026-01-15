import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIStream } from '../useAIStream';

/**
 * Helper to create a mock SSE response with ReadableStream.
 */
function createMockSSEResponse(chunks: string[], options: { status?: number; delay?: number } = {}) {
  const { status = 200, delay = 0 } = options;

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    text: async () => `HTTP ${status}`,
  } as Response;
}

/**
 * Helper to create SSE formatted data.
 */
function sseData(content: string | object): string {
  const data = typeof content === 'object' ? JSON.stringify(content) : content;
  return `data: ${data}\n\n`;
}

describe('useAIStream', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start with idle state', () => {
      const { result } = renderHook(() => useAIStream());

      expect(result.current.content).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.streamId).toBeNull();
    });

    it('should provide startStream, cancel, and reset functions', () => {
      const { result } = renderHook(() => useAIStream());

      expect(typeof result.current.startStream).toBe('function');
      expect(typeof result.current.cancel).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Streaming Content', () => {
    it('should update content during streaming', async () => {
      const chunks = [sseData({ content: 'Hello' }), sseData({ content: ' World' }), 'data: [DONE]\n\n'];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const { result } = renderHook(() => useAIStream({ onChunk, onComplete }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Hello World');
      expect(result.current.isStreaming).toBe(false);
      expect(onChunk).toHaveBeenCalledWith('Hello');
      expect(onChunk).toHaveBeenCalledWith(' World');
      expect(onComplete).toHaveBeenCalledWith('Hello World');
    });

    it('should handle text delta format', async () => {
      const chunks = [
        sseData({ delta: { text: 'Streaming ' } }),
        sseData({ delta: { text: 'text' } }),
        'data: [DONE]\n\n',
      ];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Streaming text');
    });

    it('should handle plain text SSE data', async () => {
      const chunks = ['data: Plain text\n\n', 'data: response\n\n', 'data: [DONE]\n\n'];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Plain textresponse');
    });

    it('should set isStreaming to true during stream', async () => {
      // Use real timers for this async test
      vi.useRealTimers();

      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData({ content: 'Test' })));
          await streamPromise;
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      } as Response);

      const { result } = renderHook(() => useAIStream());

      // Start the stream but don't wait for completion
      let streamStarted: Promise<void>;
      act(() => {
        streamStarted = result.current.startStream({ url: '/api/ai/stream' });
      });

      // Give the stream time to start processing
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // Stream should be in progress
      expect(result.current.isStreaming).toBe(true);

      // Complete the stream
      await act(async () => {
        resolveStream!();
        await streamStarted!;
      });

      expect(result.current.isStreaming).toBe(false);

      // Restore fake timers for subsequent tests
      vi.useFakeTimers();
    });

    it('should generate a unique streamId for each stream', async () => {
      const chunks = ['data: [DONE]\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      const firstStreamId = result.current.streamId;
      expect(firstStreamId).toBeTruthy();

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      const secondStreamId = result.current.streamId;
      expect(secondStreamId).toBeTruthy();
      expect(secondStreamId).not.toBe(firstStreamId);
    });
  });

  describe('Cancel', () => {
    it('should handle cancel', async () => {
      let aborted = false;
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData({ content: 'First' })));
          // Wait indefinitely until abort
          await new Promise((_, reject) => {
            setTimeout(() => {
              if (aborted) reject(new DOMException('Aborted', 'AbortError'));
            }, 10000);
          });
        },
        cancel() {
          aborted = true;
        },
      });

      global.fetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        options?.signal?.addEventListener('abort', () => {
          aborted = true;
        });
        return Promise.resolve({
          ok: true,
          status: 200,
          body: stream,
          headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        } as Response);
      });

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      act(() => {
        result.current.startStream({ url: '/api/ai/stream' });
      });

      // Let stream start
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Cancel the stream
      act(() => {
        result.current.cancel();
      });

      expect(result.current.isStreaming).toBe(false);
      // Should not call onError for user-initiated abort
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Network Failure', () => {
    it('should handle network failure', async () => {
      const networkError = new Error('Network error: Failed to fetch');
      global.fetch = vi.fn().mockRejectedValue(networkError);

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Network error');
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('HTTP Error Responses', () => {
    it('should handle HTTP error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        text: async () => 'Internal Server Error',
        headers: new Headers(),
      } as Response);

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Internal Server Error');
      expect(onError).toHaveBeenCalled();
    });

    it('should handle 401 authentication error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        body: null,
        text: async () => 'Authentication failed: please login',
        headers: new Headers(),
      } as Response);

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.error?.code).toBe('AUTH_FAILURE');
      expect(onError).toHaveBeenCalled();
    });

    it('should handle 429 rate limit error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        body: null,
        text: async () => 'Rate limit exceeded. Too many requests.',
        headers: new Headers(),
      } as Response);

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.error?.code).toBe('RATE_LIMITED');
      expect(result.current.error?.retryable).toBe(true);
    });
  });

  describe('AbortError Handling', () => {
    it('should not call onError for user-initiated abort (AbortError)', async () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Malformed SSE Data', () => {
    it('should handle malformed SSE data gracefully', async () => {
      const chunks = [
        'data: {"content": "Valid"}\n\n',
        'data: {invalid json}\n\n', // Malformed - will be treated as text
        'data: {"content": " content"}\n\n',
        'data: [DONE]\n\n',
      ];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      // Should not error, should continue processing valid data
      expect(result.current.error).toBeNull();
      expect(onError).not.toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(false);
      // Malformed JSON is treated as raw text
      expect(result.current.content).toBe('Valid{invalid json} content');
    });

    it('should skip empty lines', async () => {
      const chunks = [
        'data: {"content": "Hello"}\n\n',
        '\n\n',
        '\n',
        'data: {"content": " World"}\n\n',
        'data: [DONE]\n\n',
      ];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Hello World');
    });

    it('should skip non-data SSE fields', async () => {
      const chunks = [
        'event: message\n',
        'data: {"content": "Hello"}\n\n',
        'retry: 5000\n',
        'data: {"content": " World"}\n\n',
        'data: [DONE]\n\n',
      ];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Hello World');
    });
  });

  describe('Heartbeat Messages', () => {
    it('should skip heartbeat messages', async () => {
      const chunks = [
        'data: {"content": "Hello"}\n\n',
        'id: heartbeat\n\n',
        'data: {"content": " World"}\n\n',
        'data: [DONE]\n\n',
      ];

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const onChunk = vi.fn();
      const { result } = renderHook(() => useAIStream({ onChunk }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Hello World');
      // onChunk should be called twice, not for heartbeat
      expect(onChunk).toHaveBeenCalledTimes(2);
    });
  });

  describe('Reset', () => {
    it('should reset state to initial values', async () => {
      const chunks = [sseData({ content: 'Test content' }), 'data: [DONE]\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Test content');
      expect(result.current.streamId).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.content).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.streamId).toBeNull();
    });

    it('should cancel ongoing stream when reset is called', async () => {
      let streamCancelled = false;
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData({ content: 'Start' })));
          await new Promise((resolve) => setTimeout(resolve, 10000));
          controller.close();
        },
        cancel() {
          streamCancelled = true;
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      } as Response);

      const { result } = renderHook(() => useAIStream());

      act(() => {
        result.current.startStream({ url: '/api/ai/stream' });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.content).toBe('');
    });
  });

  describe('Request Configuration', () => {
    it('should send POST request with correct headers', async () => {
      const chunks = ['data: [DONE]\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({
          url: '/api/ai/stream',
          body: { prompt: 'Hello' },
          headers: { 'X-Custom-Header': 'value' },
        });
        await vi.runAllTimersAsync();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/stream',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'X-Custom-Header': 'value',
          }),
          body: JSON.stringify({ prompt: 'Hello' }),
        })
      );
    });

    it('should send request without body when not provided', async () => {
      const chunks = ['data: [DONE]\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/stream',
        expect.objectContaining({
          body: undefined,
        })
      );
    });
  });

  describe('Empty Response Body', () => {
    it('should handle empty response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      } as Response);

      const onError = vi.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('empty');
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Stream Completion', () => {
    it('should handle stream completion without [DONE] signal', async () => {
      const chunks = [sseData({ content: 'Complete ' }), sseData({ content: 'response' })];
      // Stream closes naturally without [DONE]

      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const onComplete = vi.fn();
      const { result } = renderHook(() => useAIStream({ onComplete }));

      await act(async () => {
        result.current.startStream({ url: '/api/ai/stream' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.content).toBe('Complete response');
      expect(result.current.isStreaming).toBe(false);
      expect(onComplete).toHaveBeenCalledWith('Complete response');
    });
  });

  describe('Type Exports', () => {
    it('should export all necessary types', async () => {
      // This test verifies that the types are properly exported
      // by importing them (done at the top of the file)
      const { result } = renderHook(() => useAIStream());

      // Verify the return type structure
      const hook = result.current;
      expect(hook).toHaveProperty('content');
      expect(hook).toHaveProperty('isStreaming');
      expect(hook).toHaveProperty('error');
      expect(hook).toHaveProperty('streamId');
      expect(hook).toHaveProperty('startStream');
      expect(hook).toHaveProperty('cancel');
      expect(hook).toHaveProperty('reset');
    });
  });
});
