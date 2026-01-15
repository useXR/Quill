'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { detectChatMode } from '@/lib/ai/intent-detection';

/**
 * Type for SSE stream events from the chat API.
 * Best Practice: Type external data explicitly
 */
type StreamEvent = { type: 'content'; content: string } | { type: 'done' } | { type: 'error'; message: string };

/**
 * Return type for the useStreamingChat hook.
 */
export interface UseStreamingChatReturn {
  /** Send a message to the AI chat API */
  sendMessage: (content: string) => Promise<void>;
  /** Cancel the current streaming response */
  cancelStream: () => void;
  /** Retry the last user message */
  retryLastMessage: () => Promise<void>;
  /** Whether the hook is currently loading (waiting for response) */
  isLoading: boolean;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
}

/**
 * useStreamingChat Hook
 *
 * Manages chat communication with the AI API via Server-Sent Events (SSE).
 * Integrates with ChatContext for state management.
 *
 * Features:
 * - Automatic mode detection (discussion, global_edit, research)
 * - SSE streaming with proper error handling
 * - Cancellation support via AbortController
 * - Retry functionality for failed messages
 * - Cleanup on unmount
 *
 * @returns Object with sendMessage, cancelStream, retryLastMessage, isLoading, isStreaming
 */
export function useStreamingChat(): UseStreamingChatReturn {
  const { state, dispatch } = useChat();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount (Best Practice: Manage resources with useRef + cleanup)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Send a message to the AI chat API.
   * Adds user message to state, creates assistant message placeholder,
   * and streams the response via SSE.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!state.documentId || !state.projectId) {
        dispatch({ type: 'SET_ERROR', error: 'No document selected' });
        return;
      }

      // Detect chat mode from message content
      const { mode } = detectChatMode(content);
      const userMessageId = crypto.randomUUID();

      // Add user message to state
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: userMessageId,
          role: 'user',
          content,
          createdAt: new Date(),
          status: 'sent',
          mode,
        },
      });

      // Create assistant message placeholder for streaming
      const assistantMessageId = crypto.randomUUID();
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          status: 'streaming',
          mode,
        },
      });

      // Set loading state and prepare abort controller
      dispatch({ type: 'SET_LOADING', isLoading: true });
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            documentId: state.documentId,
            projectId: state.projectId,
            mode,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Chat request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Process SSE data lines
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as StreamEvent;

                if (data.type === 'content') {
                  dispatch({
                    type: 'APPEND_TO_STREAMING',
                    id: assistantMessageId,
                    chunk: data.content,
                  });
                } else if (data.type === 'done') {
                  dispatch({
                    type: 'SET_MESSAGE_STATUS',
                    id: assistantMessageId,
                    status: 'sent',
                  });
                } else if (data.type === 'error') {
                  dispatch({
                    type: 'SET_MESSAGE_STATUS',
                    id: assistantMessageId,
                    status: 'error',
                  });
                  dispatch({ type: 'SET_ERROR', error: data.message });
                }
              } catch {
                /* skip malformed JSON */
              }
            }
          }
        }

        dispatch({ type: 'SET_LOADING', isLoading: false });
      } catch (error) {
        dispatch({ type: 'SET_LOADING', isLoading: false });
        dispatch({
          type: 'SET_MESSAGE_STATUS',
          id: assistantMessageId,
          status: 'error',
        });

        // Don't report AbortError as it's user-initiated
        if (!(error instanceof Error && error.name === 'AbortError')) {
          dispatch({ type: 'SET_ERROR', error: 'Failed to send message' });
        }
      }
    },
    [state.documentId, state.projectId, dispatch]
  );

  /**
   * Cancel the current streaming response.
   */
  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    dispatch({ type: 'SET_LOADING', isLoading: false });
  }, [dispatch]);

  /**
   * Retry the last user message.
   * Finds the most recent user message and resends it.
   */
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  }, [state.messages, sendMessage]);

  return {
    sendMessage,
    cancelStream,
    retryLastMessage,
    isLoading: state.isLoading,
    isStreaming: state.streamingMessageId !== null,
  };
}
