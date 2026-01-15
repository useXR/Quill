import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIUndo } from '../useAIUndo';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAIUndo', () => {
  const mockEditor = {
    commands: {
      setContent: vi.fn(),
    },
  };

  const mockOperations = [
    {
      id: 'op-1',
      operation_type: 'global_edit',
      input_summary: 'Made text more formal',
      snapshot_before: { content: 'Original content' },
      status: 'accepted',
      created_at: '2025-01-14T10:00:00Z',
    },
    {
      id: 'op-2',
      operation_type: 'global_edit',
      input_summary: 'Fixed grammar',
      snapshot_before: { content: 'Earlier content' },
      status: 'accepted',
      created_at: '2025-01-14T09:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOperations),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with empty operations', async () => {
    const { result } = renderHook(() => useAIUndo(null, ''));

    expect(result.current.operations).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoCount).toBe(0);
  });

  it('should load operations when documentId is provided', async () => {
    const { result } = renderHook(() => useAIUndo(mockEditor as any, 'doc-123'));

    await waitFor(() => {
      expect(result.current.operations).toEqual(mockOperations);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ai/operations?documentId=doc-123&limit=10');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoCount).toBe(2);
    expect(result.current.lastOperation).toEqual(mockOperations[0]);
  });

  it('should not load operations when documentId is empty', async () => {
    renderHook(() => useAIUndo(mockEditor as any, ''));

    // Wait a tick to ensure no fetch was made
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should set isLoading while fetching', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(promise);

    const { result } = renderHook(() => useAIUndo(mockEditor as any, 'doc-123'));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(mockOperations),
      });
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should undo the last operation when called without operationId', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOperations),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOperations.slice(1)),
      });

    const { result } = renderHook(() => useAIUndo(mockEditor as any, 'doc-123'));

    await waitFor(() => {
      expect(result.current.operations).toHaveLength(2);
    });

    await act(async () => {
      await result.current.undoOperation();
    });

    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('Original content');
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/operations/op-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
  });

  it('should undo a specific operation when operationId is provided', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOperations),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOperations.slice(0, 1)),
      });

    const { result } = renderHook(() => useAIUndo(mockEditor as any, 'doc-123'));

    await waitFor(() => {
      expect(result.current.operations).toHaveLength(2);
    });

    await act(async () => {
      await result.current.undoOperation('op-2');
    });

    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('Earlier content');
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/operations/op-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
  });

  it('should not call setContent if editor is null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOperations),
    });

    const { result } = renderHook(() => useAIUndo(null, 'doc-123'));

    await waitFor(() => {
      expect(result.current.operations).toHaveLength(2);
    });

    await act(async () => {
      await result.current.undoOperation();
    });

    // Should not throw and should not call setContent
    expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
  });

  it('should not attempt undo if operation has no snapshot', async () => {
    const operationsWithoutSnapshot = [
      {
        id: 'op-1',
        operation_type: 'discussion',
        input_summary: 'Asked a question',
        snapshot_before: null,
        status: 'completed',
        created_at: '2025-01-14T10:00:00Z',
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(operationsWithoutSnapshot),
    });

    const { result } = renderHook(() => useAIUndo(mockEditor as any, 'doc-123'));

    await waitFor(() => {
      expect(result.current.operations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.undoOperation();
    });

    expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useAIUndo(mockEditor as any, 'doc-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.operations).toEqual([]);
    expect(result.current.canUndo).toBe(false);
  });

  it('should reload operations after documentId changes', async () => {
    const { result, rerender } = renderHook(({ documentId }) => useAIUndo(mockEditor as any, documentId), {
      initialProps: { documentId: 'doc-123' },
    });

    await waitFor(() => {
      expect(result.current.operations).toHaveLength(2);
    });

    // Change documentId
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockOperations[0]]),
    });

    rerender({ documentId: 'doc-456' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/operations?documentId=doc-456&limit=10');
    });
  });
});
