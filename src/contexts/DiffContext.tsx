'use client';

import { createContext, useContext, useReducer, ReactNode } from 'react';

/**
 * DiffChange type - matches the diff-generator utility
 */
export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  value: string;
  lineNumber: number;
}

/**
 * DiffContext State
 *
 * Manages the state of the diff review panel including:
 * - The list of changes from the diff
 * - Which changes have been accepted/rejected
 * - The current operation ID for undo tracking
 */
interface DiffState {
  changes: DiffChange[];
  acceptedIndexes: Set<number>;
  rejectedIndexes: Set<number>;
  isOpen: boolean;
  isApplying: boolean;
  operationId: string | null;
  originalContent: string | null;
  modifiedContent: string | null;
}

type DiffAction =
  | {
      type: 'SET_CHANGES';
      changes: DiffChange[];
      operationId: string;
      originalContent: string;
      modifiedContent: string;
    }
  | { type: 'ACCEPT_CHANGE'; index: number }
  | { type: 'REJECT_CHANGE'; index: number }
  | { type: 'ACCEPT_ALL' }
  | { type: 'REJECT_ALL' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_APPLYING'; isApplying: boolean };

const initialState: DiffState = {
  changes: [],
  acceptedIndexes: new Set<number>(),
  rejectedIndexes: new Set<number>(),
  isOpen: false,
  isApplying: false,
  operationId: null,
  originalContent: null,
  modifiedContent: null,
};

function diffReducer(state: DiffState, action: DiffAction): DiffState {
  switch (action.type) {
    case 'SET_CHANGES':
      return {
        ...state,
        changes: action.changes,
        operationId: action.operationId,
        originalContent: action.originalContent,
        modifiedContent: action.modifiedContent,
        acceptedIndexes: new Set<number>(),
        rejectedIndexes: new Set<number>(),
        isOpen: true,
        isApplying: false,
      };

    case 'ACCEPT_CHANGE': {
      const newAccepted = new Set(state.acceptedIndexes);
      const newRejected = new Set(state.rejectedIndexes);
      newAccepted.add(action.index);
      newRejected.delete(action.index);
      return {
        ...state,
        acceptedIndexes: newAccepted,
        rejectedIndexes: newRejected,
      };
    }

    case 'REJECT_CHANGE': {
      const newAccepted = new Set(state.acceptedIndexes);
      const newRejected = new Set(state.rejectedIndexes);
      newRejected.add(action.index);
      newAccepted.delete(action.index);
      return {
        ...state,
        acceptedIndexes: newAccepted,
        rejectedIndexes: newRejected,
      };
    }

    case 'ACCEPT_ALL': {
      const newAccepted = new Set<number>();
      state.changes.forEach((change, index) => {
        if (change.type !== 'unchanged') {
          newAccepted.add(index);
        }
      });
      return {
        ...state,
        acceptedIndexes: newAccepted,
        rejectedIndexes: new Set<number>(),
      };
    }

    case 'REJECT_ALL': {
      const newRejected = new Set<number>();
      state.changes.forEach((change, index) => {
        if (change.type !== 'unchanged') {
          newRejected.add(index);
        }
      });
      return {
        ...state,
        acceptedIndexes: new Set<number>(),
        rejectedIndexes: newRejected,
      };
    }

    case 'CLOSE_PANEL':
      return {
        ...initialState,
      };

    case 'SET_APPLYING':
      return {
        ...state,
        isApplying: action.isApplying,
      };

    default:
      return state;
  }
}

const DiffContext = createContext<{
  state: DiffState;
  dispatch: React.Dispatch<DiffAction>;
} | null>(null);

/**
 * DiffProvider - Provides diff review state to the application
 *
 * Used by the DiffPanel to track which changes have been
 * accepted or rejected during the review process.
 */
export function DiffProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(diffReducer, initialState);
  return <DiffContext value={{ state, dispatch }}>{children}</DiffContext>;
}

/**
 * useDiff hook - Access diff review state and dispatch
 *
 * Must be used within a DiffProvider.
 */
export function useDiff() {
  const context = useContext(DiffContext);
  if (!context) {
    throw new Error('useDiff must be used within DiffProvider');
  }
  return context;
}

// Re-export the DiffChange type for external use
export type { DiffState, DiffAction };
