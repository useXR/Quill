'use client';

import { FileText, Edit3, PenTool, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ToolActivity } from '@/contexts/ChatContext';

interface ToolActivityTimelineProps {
  activities: ToolActivity[];
}

/**
 * ToolActivityTimeline - Shows tool calls and their results.
 *
 * Design tokens from docs/design-system.md:
 * - Compact inline format
 * - Spinner during execution
 * - Checkmark/X for results
 */
export function ToolActivityTimeline({ activities }: ToolActivityTimelineProps) {
  if (!activities || activities.length === 0) return null;

  // Group activities by toolId to show call/result pairs
  const toolGroups = groupActivitiesByTool(activities);

  return (
    <div className="mt-2 mb-3 space-y-1" data-testid="tool-activity-timeline">
      {toolGroups.map((group) => (
        <ToolActivityItem key={group.toolId} group={group} />
      ))}
    </div>
  );
}

interface ToolGroup {
  toolId: string;
  toolName: string;
  call?: ToolActivity;
  result?: ToolActivity;
}

function groupActivitiesByTool(activities: ToolActivity[]): ToolGroup[] {
  const groups = new Map<string, ToolGroup>();

  for (const activity of activities) {
    const existing = groups.get(activity.toolId) || {
      toolId: activity.toolId,
      toolName: activity.toolName,
    };

    if (activity.type === 'call') {
      existing.call = activity;
    } else {
      existing.result = activity;
    }

    groups.set(activity.toolId, existing);
  }

  return Array.from(groups.values());
}

function ToolActivityItem({ group }: { group: ToolGroup }) {
  const { toolName, call, result } = group;
  const isPending = call && !result;
  const isSuccess = result?.success === true;
  const isError = result?.success === false;

  return (
    <div
      className="
        flex items-center gap-2 px-2 py-1
        rounded-md bg-bg-tertiary
        text-xs font-ui
      "
      data-testid="tool-activity-item"
      data-tool={toolName}
      data-status={isPending ? 'pending' : isSuccess ? 'success' : 'error'}
    >
      {/* Tool icon */}
      <ToolIcon toolName={toolName} />

      {/* Tool name */}
      <span className="text-ink-secondary">{formatToolName(toolName)}</span>

      {/* Status indicator */}
      <span className="flex-1" />

      {isPending && <Loader2 size={12} className="text-quill animate-spin" />}

      {isSuccess && <CheckCircle size={12} className="text-success" />}

      {isError && (
        <>
          <XCircle size={12} className="text-error" />
          {result?.message && (
            <span className="text-error truncate max-w-32" title={result.message}>
              {result.message}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ToolIcon({ toolName }: { toolName: string }) {
  const iconClass = 'text-ink-tertiary flex-shrink-0';
  switch (toolName.toLowerCase()) {
    case 'read':
      return <FileText size={12} className={iconClass} />;
    case 'edit':
      return <Edit3 size={12} className={iconClass} />;
    case 'write':
      return <PenTool size={12} className={iconClass} />;
    default:
      return <FileText size={12} className={iconClass} />;
  }
}

function formatToolName(toolName: string): string {
  switch (toolName.toLowerCase()) {
    case 'read':
      return 'Reading file';
    case 'edit':
      return 'Editing file';
    case 'write':
      return 'Writing file';
    case 'file_edit':
      return 'Editing document';
    default:
      return toolName;
  }
}
