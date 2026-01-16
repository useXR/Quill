'use client';

import { type ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';

interface EditorCanvasProps {
  children: ReactNode;
}

/**
 * EditorCanvas Component
 *
 * Provides a Google Docs-style page-on-canvas layout for the document editor.
 * The document "page" floats on a neutral gray canvas background.
 *
 * Layout structure:
 * - Outer wrapper: relative positioning context for FAB, no overflow
 * - Inner scroll container: scrollable canvas area with gray background
 * - Page wrapper: centered white page with constrained width
 * - FAB: positioned outside scroll container so it stays visible when scrolling
 *
 * Design tokens used:
 * - --color-canvas-bg: Canvas background color
 * - --page-width-min: Minimum page width (650px)
 * - --page-width-max: Maximum page width (850px)
 */
export function EditorCanvas({ children }: EditorCanvasProps) {
  const { state, dispatch } = useChat();

  return (
    // Outer wrapper: relative positioning context for FAB, clips overflow
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Scrolling container for canvas content */}
      <div className="flex-1 overflow-auto bg-[var(--color-canvas-bg)]">
        <div className="min-h-full flex items-start justify-center py-8 px-4">
          <div
            className="
              w-full
              min-w-[var(--page-width-min)]
              max-w-[var(--page-width-max)]
            "
          >
            {children}
          </div>
        </div>
      </div>

      {/* FAB - positioned OUTSIDE scroll container so it stays fixed when scrolling */}
      {!state.isOpen && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="
            absolute right-6 bottom-6 z-40
            p-3 bg-quill text-white rounded-full shadow-lg
            hover:bg-quill-dark hover:shadow-xl hover:scale-105
            active:bg-quill-darker active:scale-95
            transition-all duration-150
            motion-reduce:transition-none
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          aria-label="Open chat sidebar"
          data-testid="chat-fab"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}
