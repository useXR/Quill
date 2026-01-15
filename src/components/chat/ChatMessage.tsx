'use client';

import { User, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { ModeIndicator, ChatMode } from './ModeIndicator';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'streaming' | 'error';
  mode?: ChatMode;
  onRetry?: () => void;
}

/**
 * ChatMessage Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - User messages: bg-bg-secondary (warm cream background)
 * - Assistant messages: bg-surface (clean white)
 * - Typography: font-ui (Source Sans 3) for readability
 * - Icons: Lucide icons at --icon-sm (16px)
 */
export function ChatMessage({ id, role, content, timestamp, status, mode, onRetry }: ChatMessageProps) {
  const isUser = role === 'user';
  const isError = status === 'error';
  const isStreaming = status === 'streaming';

  return (
    <div
      className={`
        flex gap-3 p-4
        ${isUser ? 'bg-bg-secondary' : 'bg-surface'}
      `}
      data-testid="chat-message"
      data-role={role}
      data-streaming={isStreaming}
    >
      {/* Avatar - uses quill brand colors for assistant, subtle for user */}
      <div
        className={`
        flex-shrink-0 w-8 h-8
        rounded-full
        flex items-center justify-center
        ${isUser ? 'bg-bg-tertiary text-ink-secondary' : 'bg-quill-lighter text-quill'}
      `}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header with role, mode, and timestamp */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-ui font-semibold text-sm text-ink-primary">{isUser ? 'You' : 'Claude'}</span>
          {mode && <ModeIndicator mode={mode} />}
          <span className="font-ui text-xs text-ink-tertiary">{timestamp.toLocaleTimeString()}</span>
        </div>

        {/* Message content with proper text colors */}
        <div
          className={`
          font-ui text-sm whitespace-pre-wrap
          ${isError ? 'text-error' : 'text-ink-secondary'}
        `}
        >
          {content}
          {/* Streaming cursor - uses quill brand color, respects reduced motion */}
          {isStreaming && (
            <span
              className="
              inline-block w-2 h-4 ml-1
              bg-quill
              animate-pulse
              motion-reduce:animate-none motion-reduce:opacity-70
            "
            />
          )}
        </div>

        {/* Error state with retry - follows alert pattern from design system */}
        {isError && (
          <div
            className="
            flex items-center gap-2 mt-2
            text-error
          "
          >
            <AlertCircle size={14} />
            <span className="font-ui text-xs">Failed to send</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="
                  flex items-center gap-1
                  px-2 py-1
                  font-ui text-xs text-quill
                  hover:underline
                  rounded-md
                  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                  min-h-[44px] min-w-[44px]
                "
                data-testid="chat-retry"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
