'use client';

import { useCallback, useState } from 'react';
import { useDocumentEditor } from '@/contexts/DocumentEditorContext';
import { DiffPanel } from '@/components/diff/DiffPanel';
import { applyDiffChanges } from '@/lib/ai/diff-generator';

export function DiffPanelWrapper() {
  const { diffState, hideDiff, applyContent } = useDocumentEditor();
  const [acceptedIndexes, setAcceptedIndexes] = useState<Set<number>>(new Set());
  const [rejectedIndexes, setRejectedIndexes] = useState<Set<number>>(new Set());

  const handleAcceptChange = useCallback((index: number) => {
    setAcceptedIndexes((prev) => new Set(prev).add(index));
    setRejectedIndexes((prev) => {
      const n = new Set(prev);
      n.delete(index);
      return n;
    });
  }, []);

  const handleRejectChange = useCallback((index: number) => {
    setRejectedIndexes((prev) => new Set(prev).add(index));
    setAcceptedIndexes((prev) => {
      const n = new Set(prev);
      n.delete(index);
      return n;
    });
  }, []);

  const handleAcceptAll = useCallback(() => {
    const allIndexes = diffState.changes.map((_, i) => i).filter((i) => diffState.changes[i].type !== 'unchanged');
    setAcceptedIndexes(new Set(allIndexes));
    setRejectedIndexes(new Set());
  }, [diffState.changes]);

  const handleRejectAll = useCallback(async () => {
    if (diffState.operationId) {
      await fetch(`/api/ai/operations/${diffState.operationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
    }
    setAcceptedIndexes(new Set());
    setRejectedIndexes(new Set());
    hideDiff();
  }, [diffState.operationId, hideDiff]);

  const handleApply = useCallback(async () => {
    const newContent = applyDiffChanges(diffState.originalContent, diffState.changes, Array.from(acceptedIndexes));
    applyContent(newContent);

    if (diffState.operationId) {
      const status =
        acceptedIndexes.size === diffState.changes.filter((c) => c.type !== 'unchanged').length
          ? 'accepted'
          : 'partial';
      await fetch(`/api/ai/operations/${diffState.operationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, outputContent: newContent }),
      });
    }

    setAcceptedIndexes(new Set());
    setRejectedIndexes(new Set());
    hideDiff();
  }, [diffState, acceptedIndexes, applyContent, hideDiff]);

  if (!diffState.isVisible) return null;

  return (
    <DiffPanel
      changes={diffState.changes}
      acceptedIndexes={acceptedIndexes}
      rejectedIndexes={rejectedIndexes}
      onAcceptChange={handleAcceptChange}
      onRejectChange={handleRejectChange}
      onAcceptAll={handleAcceptAll}
      onRejectAll={handleRejectAll}
      onApply={handleApply}
      onClose={handleRejectAll}
    />
  );
}
