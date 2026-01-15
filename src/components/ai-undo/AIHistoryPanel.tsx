'use client';

import { useEffect, useCallback } from 'react';
import { X, History, Check, Clock, AlertCircle } from 'lucide-react';

/**
 * AI Operation for history panel
 */
interface AIHistoryOperation {
  id: string;
  operation_type: string;
  input_summary: string;
  created_at: string;
  status: string;
  hasSnapshot?: boolean;
}

interface AIHistoryPanelProps {
  operations: AIHistoryOperation[];
  onRestore: (operationId: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

/**
 * Get display name for operation type
 */
function getOperationTypeLabel(type: string): string {
  switch (type) {
    case 'global_edit':
      return 'Global Edit';
    case 'discussion':
      return 'Discussion';
    case 'research':
      return 'Research';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  }
}

/**
 * Get styling for operation type badge
 */
function getOperationTypeStyles(type: string): string {
  switch (type) {
    case 'global_edit':
      return 'bg-warning-light text-warning-dark';
    case 'discussion':
      return 'bg-info-light text-info-dark';
    case 'research':
      return 'bg-success-light text-success-dark';
    default:
      return 'bg-bg-tertiary text-ink-secondary';
  }
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: string }) {
  let icon;
  let color;
  let testId;

  switch (status) {
    case 'accepted':
      icon = <Check size={12} />;
      color = 'text-success';
      testId = 'status-accepted';
      break;
    case 'rejected':
      icon = <X size={12} />;
      color = 'text-error';
      testId = 'status-rejected';
      break;
    case 'pending':
      icon = <Clock size={12} />;
      color = 'text-warning';
      testId = 'status-pending';
      break;
    case 'error':
      icon = <AlertCircle size={12} />;
      color = 'text-error';
      testId = 'status-error';
      break;
    default:
      icon = <Check size={12} />;
      color = 'text-ink-tertiary';
      testId = 'status-completed';
  }

  return (
    <span className={`${color}`} data-testid={testId} title={status}>
      {icon}
    </span>
  );
}

/**
 * AIHistoryPanel Component - Scholarly Craft Design System
 *
 * A standalone panel showing full AI operation history with restore capability.
 *
 * Design tokens from docs/design-system.md:
 * - Panel: bg-surface, shadow-lg, border-ink-faint, rounded-xl
 * - Header: font-display, border-b border-ink-faint
 * - Operations: hover:bg-surface-hover, border-b border-ink-faint
 */
export function AIHistoryPanel({ operations, onRestore, onClose, isOpen }: AIHistoryPanelProps) {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="
        fixed right-4 top-20
        w-96
        bg-surface
        border border-ink-faint rounded-xl
        shadow-lg
        z-50
      "
      data-testid="ai-history-panel"
    >
      {/* Header */}
      <div className="p-4 border-b border-ink-faint flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display font-bold text-base text-ink-primary">
          <History size={18} />
          AI Operation History
        </h3>
        <button
          onClick={onClose}
          className="
            p-2 min-w-[40px] min-h-[40px]
            text-ink-tertiary hover:text-ink-primary
            hover:bg-surface-hover
            rounded-md
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-quill
          "
          data-testid="history-close"
          aria-label="Close history panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Operations list */}
      <div className="max-h-[60vh] overflow-y-auto" data-testid="history-list">
        {operations.length === 0 ? (
          <div className="p-8 text-center">
            <History size={32} className="mx-auto mb-2 text-ink-tertiary" />
            <p className="font-ui text-sm text-ink-secondary">No AI operations yet</p>
          </div>
        ) : (
          operations.map((op) => {
            const canRestore = op.hasSnapshot !== false; // Default to true if not specified

            return (
              <div
                key={op.id}
                className="
                  p-4
                  border-b border-ink-faint last:border-b-0
                  hover:bg-surface-hover
                  transition-colors duration-150
                "
                data-testid="history-operation"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Operation type badge and status */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`
                          px-2 py-0.5
                          font-ui text-xs font-medium rounded
                          ${getOperationTypeStyles(op.operation_type)}
                        `}
                      >
                        {getOperationTypeLabel(op.operation_type)}
                      </span>
                      <StatusIndicator status={op.status} />
                    </div>
                    {/* Summary */}
                    <p className="font-ui text-sm font-medium text-ink-primary">{op.input_summary}</p>
                    {/* Timestamp */}
                    <p className="font-ui text-xs text-ink-tertiary mt-1">{new Date(op.created_at).toLocaleString()}</p>
                  </div>
                  {/* Restore button */}
                  {canRestore && (
                    <button
                      onClick={() => onRestore(op.id)}
                      className="
                        px-3 py-1.5
                        font-ui text-xs font-medium
                        bg-quill-lighter text-quill
                        hover:bg-quill-light
                        rounded-md
                        transition-colors duration-150
                        focus:outline-none focus:ring-2 focus:ring-quill
                        shrink-0
                      "
                      data-testid="restore-operation"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
