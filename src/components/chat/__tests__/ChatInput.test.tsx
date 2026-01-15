import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

// Mock intent detection
vi.mock('@/lib/ai/intent-detection', () => ({
  detectChatMode: (msg: string) => ({
    mode: msg.includes('change all') ? 'global_edit' : 'discussion',
    confidence: 'high',
    matchedPatterns: [],
  }),
}));

describe('ChatInput', () => {
  it('should render textarea and send button', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
  });

  it('should call onSend with message when send clicked', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('chat-send-button'));

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should clear input after sending', () => {
    render(<ChatInput onSend={vi.fn()} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('chat-send-button'));

    expect(input).toHaveValue('');
  });

  it('should send on Enter key', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should show cancel button when streaming', () => {
    const onCancel = vi.fn();
    render(<ChatInput onSend={vi.fn()} onCancel={onCancel} isStreaming />);

    expect(screen.getByTestId('chat-cancel-stream')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-cancel-stream'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
  });
});
