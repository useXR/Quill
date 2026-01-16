'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ChatSidebarProps {
  documentId: string;
  projectId: string;
}

/**
 * ChatSidebar Component
 *
 * Main chat interface panel that provides AI-powered document assistance.
 * Integrates with ChatContext for state and useStreamingChat for API communication.
 *
 * Design System: Follows the Scholarly Craft aesthetic from docs/design-system.md
 *
 * Layout: Always renders as a flex child that transitions between w-96 (open) and w-0 (closed).
 * The FAB toggle button is now rendered by EditorCanvas, not this component.
 *
 * Features:
 * - Slide-out panel with message list
 * - Real-time streaming responses
 * - Clear history with confirmation
 * - Accessible with proper ARIA labels
 */
export function ChatSidebar({ documentId, projectId }: ChatSidebarProps) {
  const { state, dispatch } = useChat();
  const { sendMessage, cancelStream, retryLastMessage, isLoading, isStreaming } = useStreamingChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Set document context on mount
  useEffect(() => {
    dispatch({ type: 'SET_DOCUMENT', documentId, projectId });
  }, [documentId, projectId, dispatch]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Focus management: focus panel when opened
  useEffect(() => {
    if (state.isOpen && panelRef.current) {
      // Focus the first focusable element (close button)
      const firstFocusable = panelRef.current.querySelector('button');
      firstFocusable?.focus();
    }
  }, [state.isOpen]);

  // Memoized handlers
  const handleToggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, [dispatch]);

  const handleClearHistory = useCallback(async () => {
    setShowClearConfirm(false);
    await fetch('/api/chat/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, documentId }),
    });
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, [projectId, documentId, dispatch]);

  /**
   * ChatSidebar always renders as a flex child.
   * When closed: w-0 with overflow-hidden (content not rendered)
   * When open: w-96 with full panel content
   *
   * The width transition provides smooth open/close animation.
   */
  return (
    <div
      className={`
        h-full overflow-hidden
        transition-[width] duration-200 ease-out
        motion-reduce:transition-none
        ${state.isOpen ? 'w-96 border-l border-ink-faint' : 'w-0'}
      `}
      role="complementary"
      aria-label="Document chat"
      aria-hidden={!state.isOpen}
      data-testid="chat-sidebar-wrapper"
    >
      {state.isOpen && (
        <div ref={panelRef} className="w-96 h-full flex flex-col bg-surface" data-testid="chat-sidebar">
          {/* Header - uses display font for scholarly title */}
          <div className="flex items-center justify-between p-4 border-b border-ink-faint">
            <h2 className="font-display font-semibold text-ink-primary">Document Chat</h2>
            <div className="flex items-center gap-1">
              {/* Icon buttons - subtle with hover states */}
              <button
                onClick={() => setShowClearConfirm(true)}
                className="
                  p-2 rounded-md
                  text-ink-tertiary hover:text-ink-primary
                  hover:bg-surface-hover
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-quill
                "
                data-testid="chat-clear-history"
                aria-label="Clear chat history"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={handleToggle}
                className="
                  p-2 rounded-md
                  text-ink-tertiary hover:text-ink-primary
                  hover:bg-surface-hover
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-quill
                "
                data-testid="chat-sidebar-toggle"
                aria-label="Close chat sidebar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Non-blocking confirmation dialog */}
          <ConfirmDialog
            open={showClearConfirm}
            onClose={() => setShowClearConfirm(false)}
            onConfirm={handleClearHistory}
            title="Clear Chat History"
            message="Are you sure you want to clear all chat history? This cannot be undone."
          />

          {/* Message List - scrollable area */}
          <div className="flex-1 overflow-y-auto" data-testid="chat-message-list">
            {state.messages.length === 0 ? (
              /* Empty State - centered with subdued styling */
              <div className="p-8 text-center">
                <MessageSquare size={48} className="mx-auto mb-4 text-ink-faint opacity-50" />
                <p className="font-ui text-ink-tertiary">Start a conversation about your document</p>
              </div>
            ) : (
              state.messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.createdAt}
                  status={msg.status}
                  mode={msg.mode}
                  onRetry={msg.status === 'error' ? retryLastMessage : undefined}
                />
              ))
            )}
            <div ref={messagesEndRef} />
            {/* Loading State - thinking indicator */}
            {isLoading && !isStreaming && (
              <div className="p-4 flex items-center gap-2 text-ink-tertiary" data-testid="chat-loading">
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                <span className="font-ui text-sm">Claude is thinking...</span>
              </div>
            )}
          </div>

          {/* Error Banner - uses error semantic colors */}
          {state.error && (
            <div
              className="
                px-4 py-2
                bg-error-light
                font-ui text-sm text-error
              "
              data-testid="chat-error"
            >
              {state.error}
            </div>
          )}

          <ChatInput
            onSend={sendMessage}
            onCancel={cancelStream}
            disabled={isLoading && !isStreaming}
            isStreaming={isStreaming}
          />
        </div>
      )}
    </div>
  );
}
