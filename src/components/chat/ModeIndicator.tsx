'use client';

import { Edit3, MessageCircle, Search } from 'lucide-react';

export type ChatMode = 'discussion' | 'global_edit' | 'research';

interface ModeIndicatorProps {
  mode: ChatMode;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Mode configuration using Quill Design System tokens (Scholarly Craft aesthetic)
 *
 * Design tokens reference: docs/design-system.md
 * - Discussion: Uses info semantic colors for scholarly discussion
 * - Global Edit: Uses warning semantic colors for edit operations (caution)
 * - Research: Uses success semantic colors for research/discovery
 */
const MODE_CONFIG = {
  discussion: {
    icon: MessageCircle,
    label: 'Discussion',
    // Info semantic: scholarly discussion mode
    color: 'text-info-dark bg-info-light border-info/20',
  },
  global_edit: {
    icon: Edit3,
    label: 'Global Edit',
    // Warning semantic: edit operations require attention
    color: 'text-warning-dark bg-warning-light border-warning/20',
  },
  research: {
    icon: Search,
    label: 'Research',
    // Success semantic: research and discovery
    color: 'text-success-dark bg-success-light border-success/20',
  },
};

export function ModeIndicator({ mode, confidence }: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-full
        text-xs font-ui font-medium
        border
        ${config.color}
      `}
      data-testid="chat-mode-indicator"
      data-mode={mode}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
      {confidence && confidence !== 'high' && <span className="text-ink-tertiary">({confidence})</span>}
    </div>
  );
}
