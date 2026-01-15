'use client';

import { useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { ModeIndicator } from './ModeIndicator';
import { detectChatMode } from '@/lib/ai/intent-detection';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

/**
 * ChatInput Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Input: bg-surface, border-ink-faint, focus:ring-quill
 * - Send button: bg-quill, hover:bg-quill-dark (Primary Button pattern)
 * - Cancel button: bg-error-light, text-error (Warning state)
 * - Touch targets: min 44x44px for accessibility
 */
export function ChatInput({
  onSend,
  onCancel,
  disabled = false,
  isStreaming = false,
  placeholder = 'Ask a question or request changes...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const { mode: detectedMode } = detectChatMode(message);

  const handleSend = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-ink-faint p-4 bg-surface">
      {/* Live mode detection indicator */}
      {message.length > 0 && (
        <div className="mb-2">
          <ModeIndicator mode={detectedMode} />
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Text input following design system form input pattern */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none
            px-3 py-2.5
            bg-surface
            font-ui text-sm text-ink-primary
            placeholder:text-ink-subtle
            border border-ink-faint rounded-md
            shadow-sm
            transition-all duration-150
            hover:border-ink-subtle
            focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-secondary
          "
          data-testid="chat-input"
        />

        {/* Buttons with proper touch targets (Best Practice: 44x44px minimum) */}
        {isStreaming ? (
          // Cancel button - uses error semantic colors
          <button
            onClick={onCancel}
            className="
              flex-shrink-0
              p-3 min-w-[44px] min-h-[44px]
              rounded-md
              bg-error-light text-error
              hover:bg-error/20
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2
            "
            data-testid="chat-cancel-stream"
            aria-label="Cancel streaming"
          >
            <Square size={20} />
          </button>
        ) : (
          // Send button - Primary button pattern from design system
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="
              flex-shrink-0
              p-3 min-w-[44px] min-h-[44px]
              rounded-md
              bg-quill text-white
              shadow-sm
              hover:bg-quill-dark hover:shadow-md
              active:bg-quill-darker
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-quill
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
            data-testid="chat-send-button"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
