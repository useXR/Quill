import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEditableTitle } from '../useEditableTitle';

describe('useEditableTitle', () => {
  const mockSave = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with provided title', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test Document', onSave: mockSave }));

      expect(result.current.title).toBe('Test Document');
      expect(result.current.isEditing).toBe(false);
    });

    it('should enter edit mode on startEditing', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
      });

      expect(result.current.isEditing).toBe(true);
    });

    it('should update title on setTitle', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('New Title');
      });

      expect(result.current.title).toBe('New Title');
    });
  });

  describe('editing state transitions', () => {
    it('should save and exit edit mode on finishEditing', async () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('Updated Title');
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      expect(mockSave).toHaveBeenCalledWith('Updated Title');
      expect(result.current.isEditing).toBe(false);
    });

    it('should not save if title is unchanged', async () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should revert to original title on cancelEditing', () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Original', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('Changed');
      });

      expect(result.current.title).toBe('Changed');

      act(() => {
        result.current.cancelEditing();
      });

      expect(result.current.title).toBe('Original');
      expect(result.current.isEditing).toBe(false);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should track saving state', async () => {
      let resolveSave: () => void;
      mockSave.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          })
      );

      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('New Title');
      });

      // Start the save (don't await)
      let savePromise: Promise<void>;
      act(() => {
        savePromise = result.current.finishEditing();
      });

      // Now isSaving should be true
      expect(result.current.isSaving).toBe(true);

      // Resolve the save
      await act(async () => {
        resolveSave!();
        await savePromise;
      });

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('validation and error handling', () => {
    it('should trim whitespace from title before saving', async () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('  Trimmed Title  ');
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      expect(mockSave).toHaveBeenCalledWith('Trimmed Title');
    });

    it('should not save empty title', async () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('');
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      expect(mockSave).not.toHaveBeenCalled();
      expect(result.current.title).toBe('Test'); // Reverts to original
    });

    it('should enforce maxLength and not save if exceeded', async () => {
      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave, maxLength: 10 }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('This is way too long');
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      // Should not save - title exceeds maxLength
      expect(mockSave).not.toHaveBeenCalled();
      expect(result.current.title).toBe('Test'); // Reverts to original
    });

    it('should handle save errors', async () => {
      mockSave.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      act(() => {
        result.current.startEditing();
        result.current.setTitle('New Title');
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      expect(result.current.error?.message).toBe('Save failed');
      expect(result.current.isEditing).toBe(true); // Stay in edit mode on error
    });

    it('should clear error when starting new edit', async () => {
      mockSave.mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() => useEditableTitle({ initialTitle: 'Test', onSave: mockSave }));

      // First save fails
      act(() => {
        result.current.startEditing();
        result.current.setTitle('Failed');
      });

      await act(async () => {
        await result.current.finishEditing();
      });

      expect(result.current.error).not.toBeNull();

      // Cancel and start new edit
      act(() => {
        result.current.cancelEditing();
        result.current.startEditing();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('prop changes', () => {
    it('should update when initialTitle prop changes while not editing', () => {
      const { result, rerender } = renderHook(
        ({ initialTitle }) => useEditableTitle({ initialTitle, onSave: mockSave }),
        { initialProps: { initialTitle: 'First' } }
      );

      expect(result.current.title).toBe('First');

      rerender({ initialTitle: 'Second' });

      expect(result.current.title).toBe('Second');
    });

    it('should NOT update title when prop changes during active editing', () => {
      const { result, rerender } = renderHook(
        ({ initialTitle }) => useEditableTitle({ initialTitle, onSave: mockSave }),
        { initialProps: { initialTitle: 'First' } }
      );

      // Enter edit mode and make changes
      act(() => {
        result.current.startEditing();
        result.current.setTitle('User Edit');
      });

      // External update arrives
      rerender({ initialTitle: 'External Update' });

      // Should keep user's editing state, not overwrite
      expect(result.current.title).toBe('User Edit');
    });
  });
});
