import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ChatProvider, useChat } from '../ChatContext';

describe('ChatContext', () => {
  it('should provide initial state with empty messages', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: ChatProvider,
    });

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.isLoading).toBe(false);
  });
});
