import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode, useEffect } from 'react';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { useStreamingChat } from '../useStreamingChat';

/**
 * Helper to create a mock SSE response with ReadableStream.
 */
function createMockSSEResponse(chunks: string[], options: { status?: number } = {}) {
  const { status = 200 } = options;

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
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
 * Wrapper component that provides ChatContext with optional initial state.
 */
function createWrapper(initialDocumentId?: string, initialProjectId?: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ChatProvider>
        {initialDocumentId && initialProjectId ? (
          <InitialState documentId={initialDocumentId} projectId={initialProjectId}>
            {children}
          </InitialState>
        ) : (
          children
        )}
      </ChatProvider>
    );
  };
}

/**
 * Helper component to set initial document context using useEffect.
 */
function InitialState({
  children,
  documentId,
  projectId,
}: {
  children: ReactNode;
  documentId: string;
  projectId: string;
}) {
  const { dispatch } = useChat();

  useEffect(() => {
    dispatch({ type: 'SET_DOCUMENT', documentId, projectId });
  }, [dispatch, documentId, projectId]);

  return <>{children}</>;
}

describe('useStreamingChat', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should return sendMessage, cancelStream, retryLastMessage, isLoading, and isStreaming', () => {
      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.cancelStream).toBe('function');
      expect(typeof result.current.retryLastMessage).toBe('function');
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.isStreaming).toBe('boolean');
    });

    it('should start with isLoading and isStreaming as false', () => {
      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should not call fetch when no document is selected', async () => {
      global.fetch = vi.fn();

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper(), // No document or project set
      });

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Since no document is set, fetch should not be called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should call fetch with correct parameters when sending', async () => {
      const chunks = ['data: {"type":"content","content":"Hello back"}\n\n', 'data: {"type":"done"}\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/chat',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('Hello'),
          })
        );
      });
    });

    it('should detect global_edit mode from message content', async () => {
      const chunks = ['data: {"type":"content","content":"Editing..."}\n\n', 'data: {"type":"done"}\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      await act(async () => {
        await result.current.sendMessage('Change all headings to title case');
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/chat',
          expect.objectContaining({
            body: expect.stringContaining('global_edit'),
          })
        );
      });
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        text: async () => 'Internal Server Error',
      } as Response);

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      await act(async () => {
        await result.current.sendMessage('Test error');
      });

      // Should not throw, error should be handled internally
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('cancelStream', () => {
    it('should set isLoading to false when called', async () => {
      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      act(() => {
        result.current.cancelStream();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('retryLastMessage', () => {
    it('should resend the last user message', async () => {
      const chunks = ['data: {"type":"content","content":"Response"}\n\n', 'data: {"type":"done"}\n\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      // Send initial message
      await act(async () => {
        await result.current.sendMessage('Original message');
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Retry
      await act(async () => {
        await result.current.retryLastMessage();
      });

      await waitFor(() => {
        // Should be called twice (original + retry)
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should do nothing if no previous messages', async () => {
      global.fetch = vi.fn();

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      await act(async () => {
        await result.current.retryLastMessage();
      });

      // Should not call fetch since there are no messages to retry
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle stream error events', async () => {
      const chunks = [
        'data: {"type":"content","content":"Start"}\n\n',
        'data: {"type":"error","message":"Something went wrong"}\n\n',
      ];
      global.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(chunks));

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      await act(async () => {
        await result.current.sendMessage('Test error event');
      });

      // Should handle error and stop loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      await act(async () => {
        await result.current.sendMessage('Test network error');
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should abort stream on unmount', async () => {
      let abortCalled = false;

      global.fetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        options?.signal?.addEventListener('abort', () => {
          abortCalled = true;
        });

        // Return a response that never completes
        return new Promise(() => {});
      });

      const { result, unmount } = renderHook(() => useStreamingChat(), {
        wrapper: createWrapper('doc-1', 'proj-1'),
      });

      // Start sending (will hang because fetch never resolves)
      act(() => {
        result.current.sendMessage('Test cleanup');
      });

      // Give it a moment to start the fetch
      await new Promise((r) => setTimeout(r, 10));

      unmount();

      // After unmount, abort should be called
      expect(abortCalled).toBe(true);
    });
  });
});
