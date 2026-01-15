'use client';

import { useState, useRef, useCallback } from 'react';
import type { ClaudeError } from '@/lib/ai/types';
import { categorizeError } from '@/lib/ai/errors';

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

interface StartStreamOptions {
  url: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface UseAIStreamReturn extends StreamState {
  startStream: (options: StartStreamOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const initialState: StreamState = {
  content: '',
  isStreaming: false,
  error: null,
  streamId: null,
};

/**
 * React hook for consuming Server-Sent Events (SSE) streams from the AI API.
 *
 * Features:
 * - Manages streaming state (content, isStreaming, error, streamId)
 * - Parses 'data: ' lines from SSE stream
 * - Handles heartbeat messages (id: 'heartbeat')
 * - Supports cancellation via AbortController
 * - Handles 'data: [DONE]' as stream completion signal
 * - Gracefully handles malformed SSE data
 *
 * @param options - Optional callbacks for chunk, complete, and error events
 * @returns StreamState plus startStream, cancel, and reset functions
 */
export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const { onChunk, onComplete, onError } = options;

  const [state, setState] = useState<StreamState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef<string>('');

  /**
   * Reset the stream state to initial values.
   */
  const reset = useCallback(() => {
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    contentRef.current = '';
    setState(initialState);
  }, []);

  /**
   * Cancel the current stream.
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  /**
   * Parse an SSE line and extract the data content.
   * Returns null for non-data lines, heartbeats, or malformed data.
   */
  const parseSSELine = useCallback((line: string): { done: boolean; content?: string; id?: string } | null => {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      return null;
    }

    // Handle id field (e.g., heartbeat)
    if (trimmedLine.startsWith('id:')) {
      const id = trimmedLine.slice(3).trim();
      return { done: false, id };
    }

    // Handle data field
    if (trimmedLine.startsWith('data:')) {
      const data = trimmedLine.slice(5).trim();

      // Check for stream completion signal
      if (data === '[DONE]') {
        return { done: true };
      }

      // Try to parse JSON data
      try {
        const parsed = JSON.parse(data);
        // Handle different response formats
        const content = parsed.content ?? parsed.text ?? parsed.delta?.text ?? '';
        return { done: false, content: String(content) };
      } catch {
        // If it's not JSON, return the raw data as content
        // This handles simple text SSE streams
        return { done: false, content: data };
      }
    }

    // Skip other SSE fields (event:, retry:, etc.)
    return null;
  }, []);

  /**
   * Start a new SSE stream.
   */
  const startStream = useCallback(
    async ({ url, body, headers = {} }: StartStreamOptions): Promise<void> => {
      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this stream
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Reset state for new stream
      contentRef.current = '';
      const streamId = crypto.randomUUID();

      setState({
        content: '',
        isStreaming: true,
        error: null,
        streamId,
      });

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: abortController.signal,
        });

        // Handle HTTP errors
        if (!response.ok) {
          const errorText = await response.text().catch(() => `HTTP ${response.status}`);
          const error = categorizeError(new Error(errorText));
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error,
          }));
          onError?.(error);
          return;
        }

        // Ensure we have a readable stream
        if (!response.body) {
          const error = categorizeError(new Error('Response body is empty'));
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error,
          }));
          onError?.(error);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const parsed = parseSSELine(line);

            if (!parsed) {
              continue;
            }

            // Skip heartbeat messages
            if (parsed.id === 'heartbeat') {
              continue;
            }

            // Handle stream completion
            if (parsed.done) {
              const finalContent = contentRef.current;
              setState((prev) => ({
                ...prev,
                isStreaming: false,
              }));
              onComplete?.(finalContent);
              return;
            }

            // Handle content
            if (parsed.content) {
              contentRef.current += parsed.content;
              const currentContent = contentRef.current;

              setState((prev) => ({
                ...prev,
                content: currentContent,
              }));

              onChunk?.(parsed.content);
            }
          }
        }

        // Process any remaining buffer content
        if (buffer) {
          const parsed = parseSSELine(buffer);
          if (parsed?.content) {
            contentRef.current += parsed.content;
            setState((prev) => ({
              ...prev,
              content: contentRef.current,
            }));
            onChunk?.(parsed.content);
          }
        }

        // Stream completed naturally
        const finalContent = contentRef.current;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
        }));
        onComplete?.(finalContent);
      } catch (err) {
        // Don't treat user-initiated abort as an error
        // Check for AbortError in multiple ways to handle different environments
        const isAbortError =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted')));

        if (isAbortError) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
          }));
          return;
        }

        // Handle other errors
        const error = categorizeError(err instanceof Error ? err : new Error(String(err)), contentRef.current);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error,
        }));
        onError?.(error);
      }
    },
    [parseSSELine, onChunk, onComplete, onError]
  );

  return {
    ...state,
    startStream,
    cancel,
    reset,
  };
}

export type { StreamState, UseAIStreamOptions, StartStreamOptions, UseAIStreamReturn };
