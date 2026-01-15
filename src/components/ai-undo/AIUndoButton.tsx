'use client';

import { useState } from 'react';
import { Undo2, ChevronDown, History } from 'lucide-react';

/**
 * AI Operation interface for the button component
 */
interface AIOperation {
  id: string;
  input_summary: string;
  created_at: string;
}

interface AIUndoButtonProps {
  canUndo: boolean;
  undoCount: number;
  lastOperation?: AIOperation;
  onUndo: (operationId?: string) => void;
  operations: AIOperation[];
}

/**
 * AIUndoButton Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Button group: border-ink-faint, rounded-l-lg/rounded-r-lg
 * - Hover: bg-surface-hover
 * - Badge: bg-bg-tertiary, text-ink-secondary
 * - Dropdown: bg-surface, shadow-lg, border-ink-faint
 */
export function AIUndoButton({ canUndo, undoCount, lastOperation, onUndo, operations }: AIUndoButtonProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="relative">
      {/* Button group with split button pattern */}
      <div className="flex items-center">
        {/* Main undo button */}
        <button
          onClick={() => onUndo()}
          disabled={!canUndo}
          className="
            flex items-center gap-1.5
            px-3 py-2 min-h-[44px]
            font-ui text-sm font-medium text-ink-primary
            bg-surface hover:bg-surface-hover
            border border-ink-faint rounded-l-md
            transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          title={lastOperation ? `Undo: ${lastOperation.input_summary}` : 'No AI operations to undo'}
          data-testid="ai-undo-button"
        >
          <Undo2 size={16} />
          <span>Undo AI</span>
          {/* Count badge */}
          {undoCount > 0 && (
            <span
              className="
                px-1.5 py-0.5
                font-ui text-xs font-medium
                bg-bg-tertiary text-ink-secondary
                rounded-full
              "
              data-testid="undo-count"
            >
              {undoCount}
            </span>
          )}
        </button>
        {/* Dropdown toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          disabled={!canUndo}
          className="
            px-2 py-2 min-h-[44px]
            text-ink-secondary hover:text-ink-primary
            bg-surface hover:bg-surface-hover
            border-y border-r border-ink-faint rounded-r-md
            transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
          "
          data-testid="ai-history-toggle"
          aria-label="Show AI operation history"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* History dropdown panel */}
      {showHistory && operations.length > 0 && (
        <div
          className="
            absolute top-full right-0 mt-1
            w-80
            bg-surface
            border border-ink-faint rounded-lg
            shadow-lg
            z-50
          "
          data-testid="ai-history-panel"
        >
          {/* Panel header */}
          <div className="p-3 border-b border-ink-faint">
            <h4
              className="
              flex items-center gap-2
              font-display font-semibold text-sm text-ink-primary
            "
            >
              <History size={14} />
              AI Operation History
            </h4>
          </div>
          {/* Operation list */}
          <div className="max-h-64 overflow-y-auto" data-testid="ai-snapshot-list">
            {operations.map((op) => (
              <div
                key={op.id}
                className="
                  p-3
                  border-b border-ink-faint last:border-b-0
                  hover:bg-surface-hover
                  transition-colors duration-150
                "
                data-testid="ai-snapshot"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-sm font-medium text-ink-primary truncate">{op.input_summary}</p>
                    <p className="font-ui text-xs text-ink-tertiary">{new Date(op.created_at).toLocaleString()}</p>
                  </div>
                  {/* Restore button - uses quill accent */}
                  <button
                    onClick={() => {
                      onUndo(op.id);
                      setShowHistory(false);
                    }}
                    className="
                      px-2.5 py-1
                      font-ui text-xs font-medium
                      bg-quill-lighter text-quill
                      hover:bg-quill-light
                      rounded-md
                      transition-colors duration-150
                      focus:outline-none focus:ring-2 focus:ring-quill
                    "
                    data-testid="restore-snapshot"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
