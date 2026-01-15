import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ChatProvider, useChat, ChatMessage } from '../ChatContext';

describe('ChatContext', () => {
  it('should provide initial state with empty messages', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.isLoading).toBe(false);
  });

  it('should toggle sidebar open and closed', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    expect(result.current.state.isOpen).toBe(false);

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_SIDEBAR' });
    });

    expect(result.current.state.isOpen).toBe(true);

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_SIDEBAR' });
    });

    expect(result.current.state.isOpen).toBe(false);
  });

  it('should add message to state', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    const message: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      createdAt: new Date(),
      status: 'sent',
    };

    act(() => {
      result.current.dispatch({ type: 'ADD_MESSAGE', message });
    });

    expect(result.current.state.messages).toHaveLength(1);
    expect(result.current.state.messages[0].content).toBe('Hello');
  });

  it('should set streamingMessageId when adding streaming message', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    const message: ChatMessage = {
      id: 'msg-streaming',
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      status: 'streaming',
    };

    act(() => {
      result.current.dispatch({ type: 'ADD_MESSAGE', message });
    });

    expect(result.current.state.streamingMessageId).toBe('msg-streaming');
  });

  it('should append content to streaming message', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    // Add initial streaming message
    act(() => {
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello',
          createdAt: new Date(),
          status: 'streaming',
        },
      });
    });

    // Append to it
    act(() => {
      result.current.dispatch({
        type: 'APPEND_TO_STREAMING',
        id: 'msg-1',
        chunk: ' World',
      });
    });

    expect(result.current.state.messages[0].content).toBe('Hello World');
  });
});
