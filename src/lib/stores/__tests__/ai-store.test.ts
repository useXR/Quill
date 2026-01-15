import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAIStore } from '../ai-store';
import type { ClaudeError } from '@/lib/ai/types';
import { AI } from '@/lib/constants/ai';

describe('useAIStore', () => {
  // Reset the store before each test
  beforeEach(() => {
    useAIStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start with no current operation', () => {
      const { currentOperation } = useAIStore.getState();
      expect(currentOperation).toBeNull();
    });

    it('should start with empty operation history', () => {
      const { operationHistory } = useAIStore.getState();
      expect(operationHistory).toEqual([]);
    });
  });

  describe('startOperation', () => {
    it('should start an operation with correct properties', () => {
      const { startOperation } = useAIStore.getState();

      const id = startOperation('selection', 'Make this formal');
      const { currentOperation } = useAIStore.getState();

      expect(currentOperation).not.toBeNull();
      expect(currentOperation?.id).toBe(id);
      expect(currentOperation?.type).toBe('selection');
      expect(currentOperation?.status).toBe('loading');
      expect(currentOperation?.input).toBe('Make this formal');
      expect(currentOperation?.output).toBe('');
      expect(currentOperation?.createdAt).toBeInstanceOf(Date);
    });

    it('should store document snapshot when provided', () => {
      const { startOperation } = useAIStore.getState();
      const snapshot = 'Original document content';

      startOperation('global', 'Rewrite this', snapshot);
      const { currentOperation } = useAIStore.getState();

      expect(currentOperation?.documentSnapshot).toBe(snapshot);
    });

    it('should generate unique IDs for each operation', () => {
      const { startOperation, reset } = useAIStore.getState();

      const id1 = startOperation('selection', 'First');
      reset();
      const id2 = startOperation('selection', 'Second');

      expect(id1).not.toBe(id2);
    });

    it('should support all operation types', () => {
      const types = ['selection', 'cursor', 'global', 'chat'] as const;

      types.forEach((type) => {
        useAIStore.getState().reset();
        useAIStore.getState().startOperation(type, 'test input');
        const { currentOperation } = useAIStore.getState();
        expect(currentOperation?.type).toBe(type);
      });
    });
  });

  describe('appendOutput', () => {
    it('should append content to output', () => {
      const { startOperation, appendOutput } = useAIStore.getState();

      startOperation('selection', 'Test');
      appendOutput('Hello ');
      appendOutput('World');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation?.output).toBe('Hello World');
    });

    it('should set status to streaming when appending', () => {
      const { startOperation, appendOutput } = useAIStore.getState();

      startOperation('selection', 'Test');
      expect(useAIStore.getState().currentOperation?.status).toBe('loading');

      appendOutput('chunk');
      expect(useAIStore.getState().currentOperation?.status).toBe('streaming');
    });

    it('should do nothing when no current operation', () => {
      const { appendOutput } = useAIStore.getState();

      // Should not throw
      appendOutput('content');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation).toBeNull();
    });
  });

  describe('setOutput', () => {
    it('should set the complete output', () => {
      const { startOperation, setOutput } = useAIStore.getState();

      startOperation('selection', 'Test');
      setOutput('Complete output');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation?.output).toBe('Complete output');
    });

    it('should replace existing output', () => {
      const { startOperation, appendOutput, setOutput } = useAIStore.getState();

      startOperation('selection', 'Test');
      appendOutput('Partial');
      setOutput('Replaced');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation?.output).toBe('Replaced');
    });

    it('should do nothing when no current operation', () => {
      const { setOutput } = useAIStore.getState();

      setOutput('content');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation).toBeNull();
    });
  });

  describe('setStatus', () => {
    it('should update operation status', () => {
      const { startOperation, setStatus } = useAIStore.getState();

      startOperation('selection', 'Test');
      setStatus('preview');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation?.status).toBe('preview');
    });

    it('should support all status values', () => {
      const statuses = ['idle', 'loading', 'streaming', 'preview', 'error'] as const;

      statuses.forEach((status) => {
        useAIStore.getState().reset();
        useAIStore.getState().startOperation('selection', 'Test');
        useAIStore.getState().setStatus(status);
        expect(useAIStore.getState().currentOperation?.status).toBe(status);
      });
    });

    it('should do nothing when no current operation', () => {
      const { setStatus } = useAIStore.getState();

      setStatus('preview');

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error and status to error', () => {
      const { startOperation, setError } = useAIStore.getState();
      const error: ClaudeError = {
        code: 'TIMEOUT',
        message: 'Operation timed out',
        retryable: true,
      };

      startOperation('selection', 'Test');
      setError(error);

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation?.status).toBe('error');
      expect(currentOperation?.error).toEqual(error);
    });

    it('should do nothing when no current operation', () => {
      const { setError } = useAIStore.getState();
      const error: ClaudeError = {
        code: 'TIMEOUT',
        message: 'Test',
        retryable: false,
      };

      setError(error);

      const { currentOperation } = useAIStore.getState();
      expect(currentOperation).toBeNull();
    });
  });

  describe('acceptOperation', () => {
    it('should add operation to history and clear current', () => {
      const { startOperation, setOutput, acceptOperation } = useAIStore.getState();

      const id = startOperation('selection', 'Test');
      setOutput('Generated content');
      acceptOperation();

      const { currentOperation, operationHistory } = useAIStore.getState();
      expect(currentOperation).toBeNull();
      expect(operationHistory).toHaveLength(1);
      expect(operationHistory[0].id).toBe(id);
      expect(operationHistory[0].output).toBe('Generated content');
    });

    it('should add most recent operations first', () => {
      const { startOperation, setOutput, acceptOperation } = useAIStore.getState();

      startOperation('selection', 'First');
      setOutput('First output');
      acceptOperation();

      startOperation('selection', 'Second');
      setOutput('Second output');
      acceptOperation();

      const { operationHistory } = useAIStore.getState();
      expect(operationHistory).toHaveLength(2);
      expect(operationHistory[0].input).toBe('Second');
      expect(operationHistory[1].input).toBe('First');
    });

    it('should limit history to MAX_OPERATION_HISTORY', () => {
      const { startOperation, acceptOperation } = useAIStore.getState();

      // Create MAX_OPERATION_HISTORY + 5 operations
      for (let i = 0; i < AI.MAX_OPERATION_HISTORY + 5; i++) {
        startOperation('selection', `Operation ${i}`);
        acceptOperation();
      }

      const { operationHistory } = useAIStore.getState();
      expect(operationHistory).toHaveLength(AI.MAX_OPERATION_HISTORY);
      // Most recent should be at index 0
      expect(operationHistory[0].input).toBe(`Operation ${AI.MAX_OPERATION_HISTORY + 4}`);
    });

    it('should do nothing when no current operation', () => {
      const { acceptOperation } = useAIStore.getState();

      acceptOperation();

      const { currentOperation, operationHistory } = useAIStore.getState();
      expect(currentOperation).toBeNull();
      expect(operationHistory).toHaveLength(0);
    });
  });

  describe('rejectOperation', () => {
    it('should clear current operation without adding to history', () => {
      const { startOperation, setOutput, rejectOperation } = useAIStore.getState();

      startOperation('selection', 'Test');
      setOutput('Generated content');
      rejectOperation();

      const { currentOperation, operationHistory } = useAIStore.getState();
      expect(currentOperation).toBeNull();
      expect(operationHistory).toHaveLength(0);
    });

    it('should preserve existing history', () => {
      const { startOperation, acceptOperation, rejectOperation } = useAIStore.getState();

      // Accept one operation
      startOperation('selection', 'Accepted');
      acceptOperation();

      // Reject another
      startOperation('selection', 'Rejected');
      rejectOperation();

      const { operationHistory } = useAIStore.getState();
      expect(operationHistory).toHaveLength(1);
      expect(operationHistory[0].input).toBe('Accepted');
    });
  });

  describe('undoOperation', () => {
    it('should return document snapshot and remove from history', () => {
      const { startOperation, acceptOperation, undoOperation } = useAIStore.getState();
      const snapshot = 'Original document';

      const id = startOperation('selection', 'Test', snapshot);
      acceptOperation();

      const result = undoOperation(id);

      expect(result).toBe(snapshot);
      const { operationHistory } = useAIStore.getState();
      expect(operationHistory).toHaveLength(0);
    });

    it('should return null for non-existent operation', () => {
      const { undoOperation } = useAIStore.getState();

      const result = undoOperation('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null for operation without snapshot', () => {
      const { startOperation, acceptOperation, undoOperation } = useAIStore.getState();

      const id = startOperation('chat', 'Test'); // No snapshot
      acceptOperation();

      const result = undoOperation(id);

      expect(result).toBeNull();
    });

    it('should only remove the specified operation from history', () => {
      const { startOperation, acceptOperation, undoOperation } = useAIStore.getState();

      const id1 = startOperation('selection', 'First', 'Snapshot 1');
      acceptOperation();

      const id2 = startOperation('selection', 'Second', 'Snapshot 2');
      acceptOperation();

      undoOperation(id1);

      const { operationHistory } = useAIStore.getState();
      expect(operationHistory).toHaveLength(1);
      expect(operationHistory[0].id).toBe(id2);
    });
  });

  describe('reset', () => {
    it('should clear current operation and history', () => {
      const { startOperation, acceptOperation, reset } = useAIStore.getState();

      // Create some state
      startOperation('selection', 'Accepted');
      acceptOperation();
      startOperation('selection', 'Current');

      // Reset
      reset();

      const { currentOperation, operationHistory } = useAIStore.getState();
      expect(currentOperation).toBeNull();
      expect(operationHistory).toHaveLength(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete streaming workflow', () => {
      const { startOperation, appendOutput, setStatus, acceptOperation } = useAIStore.getState();

      // Start operation
      const id = startOperation('selection', 'Make formal', 'Original text');
      expect(useAIStore.getState().currentOperation?.status).toBe('loading');

      // Stream content
      appendOutput('This is ');
      expect(useAIStore.getState().currentOperation?.status).toBe('streaming');
      appendOutput('formal text.');

      // Show preview
      setStatus('preview');
      expect(useAIStore.getState().currentOperation?.status).toBe('preview');

      // Accept
      acceptOperation();
      expect(useAIStore.getState().currentOperation).toBeNull();
      expect(useAIStore.getState().operationHistory[0].output).toBe('This is formal text.');
    });

    it('should handle error recovery workflow', () => {
      const { startOperation, setError, rejectOperation, setOutput, acceptOperation } = useAIStore.getState();

      // Start and fail
      startOperation('selection', 'Test', 'Original');
      setError({
        code: 'RATE_LIMITED',
        message: 'Rate limited',
        retryable: true,
      });
      expect(useAIStore.getState().currentOperation?.status).toBe('error');

      // Reject and retry
      rejectOperation();
      startOperation('selection', 'Test', 'Original');
      setOutput('Success!');
      acceptOperation();

      expect(useAIStore.getState().operationHistory).toHaveLength(1);
    });
  });
});
