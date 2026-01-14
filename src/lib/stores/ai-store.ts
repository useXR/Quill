/**
 * Zustand store for managing AI operation state.
 *
 * Provides centralized state management for all AI operations including
 * selection edits, cursor edits, global edits, and chat interactions.
 */
import { create } from 'zustand';
import type { ClaudeError } from '@/lib/ai/types';
import { AI } from '@/lib/constants/ai';

/**
 * Types of AI operations supported by the application.
 * - selection: Edit selected text
 * - cursor: Insert at cursor position
 * - global: Document-wide changes
 * - chat: Conversational interaction
 */
export type AIOperationType = 'selection' | 'cursor' | 'global' | 'chat';

/**
 * Status of an AI operation.
 * - idle: No operation in progress
 * - loading: Operation started, waiting for response
 * - streaming: Receiving streamed content
 * - preview: Content generated, awaiting user decision
 * - error: Operation failed
 */
export type AIOperationStatus = 'idle' | 'loading' | 'streaming' | 'preview' | 'error';

/**
 * Represents a single AI operation with its full lifecycle state.
 */
export interface AIOperation {
  /** Unique identifier for the operation */
  id: string;
  /** Type of operation being performed */
  type: AIOperationType;
  /** Current status of the operation */
  status: AIOperationStatus;
  /** User's input prompt */
  input: string;
  /** Generated output content */
  output: string;
  /** Error information if the operation failed */
  error?: ClaudeError;
  /** Snapshot of document state before the operation (for undo) */
  documentSnapshot?: string;
  /** When the operation was created */
  createdAt: Date;
}

/**
 * AI store state and actions interface.
 */
interface AIStore {
  /** Currently active operation, or null if idle */
  currentOperation: AIOperation | null;
  /** History of completed operations (most recent first) */
  operationHistory: AIOperation[];

  /**
   * Start a new AI operation.
   * @param type - The type of operation
   * @param input - The user's prompt/input
   * @param snapshot - Optional document snapshot for undo support
   * @returns The generated operation ID
   */
  startOperation: (type: AIOperationType, input: string, snapshot?: string) => string;

  /**
   * Append content to the current operation's output (for streaming).
   * @param content - Content chunk to append
   */
  appendOutput: (content: string) => void;

  /**
   * Set the complete output for the current operation.
   * @param content - The complete output content
   */
  setOutput: (content: string) => void;

  /**
   * Update the status of the current operation.
   * @param status - The new status
   */
  setStatus: (status: AIOperationStatus) => void;

  /**
   * Set an error on the current operation.
   * @param error - The error information
   */
  setError: (error: ClaudeError) => void;

  /**
   * Accept the current operation's output and add to history.
   * Clears the current operation.
   */
  acceptOperation: () => void;

  /**
   * Reject the current operation without adding to history.
   * Clears the current operation.
   */
  rejectOperation: () => void;

  /**
   * Undo a previous operation by retrieving its document snapshot.
   * @param operationId - The ID of the operation to undo
   * @returns The document snapshot, or null if not found
   */
  undoOperation: (operationId: string) => string | null;

  /**
   * Reset the store to its initial state.
   */
  reset: () => void;
}

/**
 * Zustand store for AI operation state management.
 *
 * @example
 * ```tsx
 * const { startOperation, appendOutput, acceptOperation } = useAIStore();
 *
 * // Start an operation
 * const id = startOperation('selection', 'Make this formal', documentContent);
 *
 * // Stream content
 * for await (const chunk of stream) {
 *   appendOutput(chunk);
 * }
 *
 * // Accept the result
 * acceptOperation();
 * ```
 */
export const useAIStore = create<AIStore>((set, get) => ({
  currentOperation: null,
  operationHistory: [],

  startOperation: (type, input, snapshot) => {
    const id = crypto.randomUUID();
    const operation: AIOperation = {
      id,
      type,
      status: 'loading',
      input,
      output: '',
      documentSnapshot: snapshot,
      createdAt: new Date(),
    };

    set({ currentOperation: operation });
    return id;
  },

  appendOutput: (content) => {
    const { currentOperation } = get();
    if (!currentOperation) return;

    set({
      currentOperation: {
        ...currentOperation,
        output: currentOperation.output + content,
        status: 'streaming',
      },
    });
  },

  setOutput: (content) => {
    const { currentOperation } = get();
    if (!currentOperation) return;

    set({
      currentOperation: {
        ...currentOperation,
        output: content,
      },
    });
  },

  setStatus: (status) => {
    const { currentOperation } = get();
    if (!currentOperation) return;

    set({
      currentOperation: {
        ...currentOperation,
        status,
      },
    });
  },

  setError: (error) => {
    const { currentOperation } = get();
    if (!currentOperation) return;

    set({
      currentOperation: {
        ...currentOperation,
        status: 'error',
        error,
      },
    });
  },

  acceptOperation: () => {
    const { currentOperation, operationHistory } = get();
    if (!currentOperation) return;

    // Add to history (most recent first), limit to MAX_OPERATION_HISTORY
    const newHistory = [currentOperation, ...operationHistory].slice(0, AI.MAX_OPERATION_HISTORY);

    set({
      currentOperation: null,
      operationHistory: newHistory,
    });
  },

  rejectOperation: () => {
    set({ currentOperation: null });
  },

  undoOperation: (operationId) => {
    const { operationHistory } = get();
    const operation = operationHistory.find((op) => op.id === operationId);

    if (!operation || !operation.documentSnapshot) {
      return null;
    }

    // Remove the operation from history
    set({
      operationHistory: operationHistory.filter((op) => op.id !== operationId),
    });

    return operation.documentSnapshot;
  },

  reset: () => {
    set({
      currentOperation: null,
      operationHistory: [],
    });
  },
}));
