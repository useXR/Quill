import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  const baseProps = {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Hello world',
    timestamp: new Date('2024-01-01T12:00:00'),
    status: 'sent' as const,
  };

  it('should render user message with correct role indicator', () => {
    render(<ChatMessage {...baseProps} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('should render assistant message with Claude label', () => {
    render(<ChatMessage {...baseProps} role="assistant" />);
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('should show streaming cursor when streaming', () => {
    render(<ChatMessage {...baseProps} status="streaming" />);
    expect(screen.getByTestId('chat-message')).toHaveAttribute('data-streaming', 'true');
  });

  it('should show error state with retry button', () => {
    const onRetry = vi.fn();
    render(<ChatMessage {...baseProps} status="error" onRetry={onRetry} />);

    expect(screen.getByText('Failed to send')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should display mode indicator when mode provided', () => {
    render(<ChatMessage {...baseProps} mode="global_edit" />);
    expect(screen.getByTestId('chat-mode-indicator')).toBeInTheDocument();
  });
});
