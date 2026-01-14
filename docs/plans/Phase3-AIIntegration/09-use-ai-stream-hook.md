# Task 3.9: useAIStream Hook

> **Phase 3** | [← AI State Store](./08-ai-state-store.md) | [Next: SSE API Route →](./10-sse-api-route.md)

---

## Context

**This task creates the React hook for consuming SSE streams from the AI API.** This client-side hook manages fetch requests, stream parsing, and state updates for AI streaming operations.

### Prerequisites

- **Task 3.1** completed (AI Type Definitions) - provides `ClaudeError` type

### What This Task Creates

- `src/hooks/useAIStream.ts` - React hook for SSE consumption
- `src/hooks/__tests__/useAIStream.test.tsx` - Hook tests

### Tasks That Depend on This

- **Task 3.13** (Selection Toolbar) - uses this hook for AI operations

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.7** (Streaming Module)
- **Task 3.8** (AI State Store)
- **Task 3.11** (Context Builder)

---

## Files to Create/Modify

- `src/hooks/useAIStream.ts` (create)
- `src/hooks/__tests__/useAIStream.test.tsx` (create)

---

## Steps

### Step 1: Write the failing test

```typescript
// src/hooks/__tests__/useAIStream.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIStream } from '../useAIStream';

// Mock fetch
global.fetch = vi.fn();

describe('useAIStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with idle state', () => {
    const { result } = renderHook(() => useAIStream());

    expect(result.current.content).toBe('');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should update content during streaming', async () => {
    const mockResponse = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"content":"Hello"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'X-Stream-Id': 'test-id' }),
      body: mockResponse,
    } as Response);

    const onChunk = vi.fn();
    const { result } = renderHook(() => useAIStream({ onChunk }));

    await act(async () => {
      await result.current.startStream('test prompt');
    });

    await waitFor(() => {
      expect(result.current.content).toBe('Hello');
    });
  });

  it('should handle cancel', async () => {
    const { result } = renderHook(() => useAIStream());

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it('should handle network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();
    const { result } = renderHook(() => useAIStream({ onError }));

    await act(async () => {
      await result.current.startStream('test');
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.code).toBe('UNKNOWN');
    expect(onError).toHaveBeenCalled();
  });

  it('should handle HTTP error responses', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response);

    const { result } = renderHook(() => useAIStream());

    await act(async () => {
      await result.current.startStream('test');
    });

    expect(result.current.error?.message).toBe('Server error');
  });

  it('should not call onError for user-initiated abort', async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
        })
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useAIStream({ onError }));

    act(() => {
      result.current.startStream('test');
    });

    act(() => {
      result.current.cancel();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it('should handle malformed SSE data gracefully', async () => {
    const mockResponse = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('not-valid-sse\n'));
        controller.enqueue(new TextEncoder().encode('data: {invalid json}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"content":"Valid"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: mockResponse,
    } as Response);

    const { result } = renderHook(() => useAIStream());

    await act(async () => {
      await result.current.startStream('test');
    });

    await waitFor(() => {
      expect(result.current.content).toBe('Valid');
    });

    expect(result.current.error).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/hooks/__tests__/useAIStream.test.tsx
```

**Expected:** FAIL with "Cannot find module '../useAIStream'"

### Step 3: Write minimal implementation

```typescript
// src/hooks/useAIStream.ts
'use client';

import { useState, useRef, useCallback } from 'react';
import type { ClaudeError } from '@/lib/ai/types';

interface StreamState {
  content: string;
  isStreaming: boolean;
  error: ClaudeError | null;
  streamId: string | null;
}

interface UseAIStreamOptions {
  onChunk?: (content: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: ClaudeError) => void;
}

export function useAIStream(options: UseAIStreamOptions = {}) {
  const [state, setState] = useState<StreamState>({
    content: '',
    isStreaming: false,
    error: null,
    streamId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');

  const startStream = useCallback(
    async (prompt: string, documentId?: string, projectId?: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      contentRef.current = '';

      setState({
        content: '',
        isStreaming: true,
        error: null,
        streamId: null,
      });

      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, documentId, projectId }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Stream request failed');
        }

        const streamId = response.headers.get('X-Stream-Id');
        setState((prev) => ({ ...prev, streamId }));

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n').filter((line) => line.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              setState((prev) => ({ ...prev, isStreaming: false }));
              options.onComplete?.(contentRef.current);
              return;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: parsed.error,
                }));
                options.onError?.(parsed.error);
                return;
              }

              if (parsed.content && parsed.id !== 'heartbeat') {
                contentRef.current += parsed.content;
                setState((prev) => ({
                  ...prev,
                  content: contentRef.current,
                }));
                options.onChunk?.(parsed.content);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        const error: ClaudeError = {
          code: 'UNKNOWN',
          message: (err as Error).message,
          retryable: true,
        };

        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error,
        }));
        options.onError?.(error);
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    contentRef.current = '';
    setState({
      content: '',
      isStreaming: false,
      error: null,
      streamId: null,
    });
  }, [cancel]);

  return {
    ...state,
    startStream,
    cancel,
    reset,
  };
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/hooks/__tests__/useAIStream.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/hooks/useAIStream.ts src/hooks/__tests__/useAIStream.test.tsx
git commit -m "feat(hooks): add useAIStream hook for SSE consumption"
```

---

## Verification Checklist

- [ ] `src/hooks/useAIStream.ts` exists
- [ ] `src/hooks/__tests__/useAIStream.test.tsx` exists
- [ ] Tests pass: `npm test src/hooks/__tests__/useAIStream.test.tsx`
- [ ] `useAIStream` hook is exported
- [ ] Hook returns: content, isStreaming, error, streamId, startStream, cancel, reset
- [ ] Abort handling doesn't trigger onError
- [ ] Malformed SSE data is skipped gracefully
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.10: SSE API Route](./10-sse-api-route.md)**.
