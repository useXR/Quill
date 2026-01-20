'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface ThinkingSectionProps {
  thinking: string;
  isStreaming?: boolean;
}

/**
 * ThinkingSection - Collapsible display of Claude's reasoning process.
 *
 * Design tokens from docs/design-system.md:
 * - Muted styling with bg-bg-tertiary
 * - Monospace font for technical content
 * - Collapsible with smooth transition
 */
export function ThinkingSection({ thinking, isStreaming = false }: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thinking) return null;

  return (
    <div className="mt-2 mb-3 border border-border-secondary rounded-md overflow-hidden" data-testid="thinking-section">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          w-full flex items-center gap-2 px-3 py-2
          bg-bg-tertiary hover:bg-bg-secondary
          text-ink-secondary text-sm font-ui
          transition-colors duration-150
        "
        aria-expanded={isExpanded}
        aria-controls="thinking-content"
      >
        <Brain size={14} className="text-ink-tertiary" />
        <span className="flex-1 text-left">{isStreaming ? 'Thinking...' : 'Reasoning'}</span>
        {isExpanded ? (
          <ChevronDown size={14} className="text-ink-tertiary" />
        ) : (
          <ChevronRight size={14} className="text-ink-tertiary" />
        )}
      </button>

      {isExpanded && (
        <div
          id="thinking-content"
          className="
            px-3 py-2 bg-bg-secondary
            font-mono text-xs text-ink-secondary
            whitespace-pre-wrap break-words
            max-h-64 overflow-y-auto
          "
        >
          {thinking}
        </div>
      )}
    </div>
  );
}
