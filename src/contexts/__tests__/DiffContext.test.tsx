import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DiffProvider, useDiff, DiffChange } from '../DiffContext';
import { ReactNode } from 'react';

// Wrapper component for testing
const wrapper = ({ children }: { children: ReactNode }) => <DiffProvider>{children}</DiffProvider>;

describe('DiffContext', () => {
  const mockChanges: DiffChange[] = [
    { type: 'remove', value: 'Old text', lineNumber: 1 },
    { type: 'add', value: 'New text', lineNumber: 1 },
    { type: 'unchanged', value: 'Unchanged content', lineNumber: 2 },
  ];

  it('should provide initial state with no changes and closed panel', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    expect(result.current.state.changes).toEqual([]);
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.acceptedIndexes).toEqual(new Set());
    expect(result.current.state.rejectedIndexes).toEqual(new Set());
    expect(result.current.state.operationId).toBeNull();
  });

  it('should set changes and open panel', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original document',
        modifiedContent: 'Modified document',
      });
    });

    expect(result.current.state.changes).toEqual(mockChanges);
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.operationId).toBe('op-123');
    expect(result.current.state.originalContent).toBe('Original document');
    expect(result.current.state.modifiedContent).toBe('Modified document');
  });

  it('should accept a change by index', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    act(() => {
      result.current.dispatch({ type: 'ACCEPT_CHANGE', index: 0 });
    });

    expect(result.current.state.acceptedIndexes.has(0)).toBe(true);
    expect(result.current.state.rejectedIndexes.has(0)).toBe(false);
  });

  it('should reject a change by index', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    act(() => {
      result.current.dispatch({ type: 'REJECT_CHANGE', index: 1 });
    });

    expect(result.current.state.rejectedIndexes.has(1)).toBe(true);
    expect(result.current.state.acceptedIndexes.has(1)).toBe(false);
  });

  it('should toggle from accepted to rejected when rejecting an accepted change', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    // First accept
    act(() => {
      result.current.dispatch({ type: 'ACCEPT_CHANGE', index: 0 });
    });

    expect(result.current.state.acceptedIndexes.has(0)).toBe(true);

    // Then reject same change
    act(() => {
      result.current.dispatch({ type: 'REJECT_CHANGE', index: 0 });
    });

    expect(result.current.state.acceptedIndexes.has(0)).toBe(false);
    expect(result.current.state.rejectedIndexes.has(0)).toBe(true);
  });

  it('should toggle from rejected to accepted when accepting a rejected change', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    // First reject
    act(() => {
      result.current.dispatch({ type: 'REJECT_CHANGE', index: 0 });
    });

    // Then accept same change
    act(() => {
      result.current.dispatch({ type: 'ACCEPT_CHANGE', index: 0 });
    });

    expect(result.current.state.rejectedIndexes.has(0)).toBe(false);
    expect(result.current.state.acceptedIndexes.has(0)).toBe(true);
  });

  it('should accept all changes at once', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    act(() => {
      result.current.dispatch({ type: 'ACCEPT_ALL' });
    });

    // Should accept all modified (non-unchanged) changes
    expect(result.current.state.acceptedIndexes.has(0)).toBe(true); // remove
    expect(result.current.state.acceptedIndexes.has(1)).toBe(true); // add
    expect(result.current.state.acceptedIndexes.has(2)).toBe(false); // unchanged - not tracked
    expect(result.current.state.rejectedIndexes.size).toBe(0);
  });

  it('should reject all changes at once', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    act(() => {
      result.current.dispatch({ type: 'REJECT_ALL' });
    });

    // Should reject all modified (non-unchanged) changes
    expect(result.current.state.rejectedIndexes.has(0)).toBe(true); // remove
    expect(result.current.state.rejectedIndexes.has(1)).toBe(true); // add
    expect(result.current.state.rejectedIndexes.has(2)).toBe(false); // unchanged - not tracked
    expect(result.current.state.acceptedIndexes.size).toBe(0);
  });

  it('should close panel and reset state', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    // Set up some state
    act(() => {
      result.current.dispatch({
        type: 'SET_CHANGES',
        changes: mockChanges,
        operationId: 'op-123',
        originalContent: 'Original',
        modifiedContent: 'Modified',
      });
    });

    act(() => {
      result.current.dispatch({ type: 'ACCEPT_CHANGE', index: 0 });
    });

    // Close panel
    act(() => {
      result.current.dispatch({ type: 'CLOSE_PANEL' });
    });

    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.changes).toEqual([]);
    expect(result.current.state.acceptedIndexes.size).toBe(0);
    expect(result.current.state.rejectedIndexes.size).toBe(0);
    expect(result.current.state.operationId).toBeNull();
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useDiff());
    }).toThrow('useDiff must be used within DiffProvider');

    consoleSpy.mockRestore();
  });

  it('should set applying state', () => {
    const { result } = renderHook(() => useDiff(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'SET_APPLYING', isApplying: true });
    });

    expect(result.current.state.isApplying).toBe(true);

    act(() => {
      result.current.dispatch({ type: 'SET_APPLYING', isApplying: false });
    });

    expect(result.current.state.isApplying).toBe(false);
  });
});
