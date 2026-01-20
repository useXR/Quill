'use client';

import { Zap, Clock } from 'lucide-react';
import { ChatStats } from '@/contexts/ChatContext';

interface StatsFooterProps {
  stats: ChatStats;
}

/**
 * StatsFooter - Shows completion stats after message is done.
 *
 * Design tokens from docs/design-system.md:
 * - Muted footer styling
 * - Compact display
 */
export function StatsFooter({ stats }: StatsFooterProps) {
  const { inputTokens, outputTokens, durationMs } = stats;
  const totalTokens = inputTokens + outputTokens;
  const durationSeconds = (durationMs / 1000).toFixed(1);

  return (
    <div
      className="
        mt-3 pt-2 border-t border-border-secondary
        flex items-center gap-4
        text-xs font-ui text-ink-tertiary
      "
      data-testid="stats-footer"
    >
      <div className="flex items-center gap-1" title={`Input: ${inputTokens}, Output: ${outputTokens}`}>
        <Zap size={12} />
        <span>{formatTokenCount(totalTokens)} tokens</span>
      </div>

      <div className="flex items-center gap-1">
        <Clock size={12} />
        <span>{durationSeconds}s</span>
      </div>
    </div>
  );
}

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
