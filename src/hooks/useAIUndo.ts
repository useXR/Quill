import { useCallback, useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';

/**
 * AI Operation record from the database
 */
export interface AIOperation {
  id: string;
  operation_type: string;
  input_summary: string;
  snapshot_before: { content: string } | null;
  status: string;
  created_at: string;
}

/**
 * useAIUndo Hook
 *
 * Provides AI undo functionality by tracking AI operations and their
 * snapshots. Allows users to restore previous document states.
 *
 * @param editor - TipTap editor instance
 * @param documentId - Current document ID
 */
export function useAIUndo(editor: Editor | null, documentId: string) {
  const [operations, setOperations] = useState<AIOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load recent AI operations for the document
   */
  const loadOperations = useCallback(async () => {
    if (!documentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ai/operations?documentId=${documentId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  // Load operations when documentId changes
  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  /**
   * Undo an AI operation by restoring its snapshot
   *
   * @param operationId - Optional specific operation to undo, defaults to most recent
   */
  const undoOperation = useCallback(
    async (operationId?: string) => {
      if (!editor) return;

      // Find the target operation
      const targetOp = operationId ? operations.find((op) => op.id === operationId) : operations[0];

      if (!targetOp?.snapshot_before) return;

      // Restore the content
      editor.commands.setContent(targetOp.snapshot_before.content);

      // Mark the operation as rejected in the database
      await fetch(`/api/ai/operations/${targetOp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });

      // Reload operations to update the list
      await loadOperations();
    },
    [editor, operations, loadOperations]
  );

  return {
    /** List of AI operations for this document */
    operations,
    /** Whether operations are being loaded */
    isLoading,
    /** Undo an AI operation */
    undoOperation,
    /** Whether there are operations that can be undone */
    canUndo: operations.length > 0,
    /** The most recent operation */
    lastOperation: operations[0],
    /** Number of operations that can be undone */
    undoCount: operations.length,
  };
}
