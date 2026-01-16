'use client';

import { useCallback, useRef, useEffect, useLayoutEffect, useState, KeyboardEvent, CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';
import type { SelectionState } from './extensions/selection-tracker';

interface SelectionToolbarProps {
  editor: Editor;
  selection: SelectionState | null;
  projectId: string;
  documentId: string;
}

interface AIAction {
  id: string;
  label: string;
  description: string;
  prompt: (text: string) => string;
}

const AI_ACTIONS: AIAction[] = [
  {
    id: 'refine',
    label: 'Refine',
    description: 'Improve clarity and flow',
    prompt: (text) =>
      `Rewrite the following text to improve its clarity, flow, and readability. Output ONLY the refined text with no explanations, commentary, or markdown formatting. Preserve the original meaning and approximate length.

TEXT TO REFINE:
${text}

REFINED VERSION:`,
  },
  {
    id: 'extend',
    label: 'Extend',
    description: 'Expand on this text',
    prompt: (text) =>
      `Expand the following text by adding more detail, examples, and depth. Make it approximately 2-3x longer while maintaining the same style and tone. Output ONLY the expanded text with no explanations, commentary, or markdown formatting.

TEXT TO EXPAND:
${text}

EXPANDED VERSION:`,
  },
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Create a shorter version',
    prompt: (text) =>
      `Summarize the following text to approximately 1/3 of its original length while preserving the key points. Output ONLY the summary with no explanations, commentary, or markdown formatting.

TEXT TO SUMMARIZE:
${text}

SUMMARY:`,
  },
  {
    id: 'simplify',
    label: 'Simplify',
    description: 'Make it easier to understand',
    prompt: (text) =>
      `Rewrite the following text using simpler words and shorter sentences to make it easier to understand. Preserve the meaning and approximate length. Output ONLY the simplified text with no explanations, commentary, or markdown formatting.

TEXT TO SIMPLIFY:
${text}

SIMPLIFIED VERSION:`,
  },
];

export function SelectionToolbar({ editor, selection, projectId, documentId }: SelectionToolbarProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const store = useAIStore();
  const { startStream, cancel } = useAIStream({
    onChunk: (content) => {
      store.appendOutput?.(content);
    },
    onComplete: (fullContent) => {
      store.setStatus?.('preview');
      store.setOutput?.(fullContent);
    },
    onError: (error) => {
      store.setError?.(error);
    },
  });

  const currentOperation = store.currentOperation;
  const isLoading = currentOperation?.status === 'loading';
  const isStreaming = currentOperation?.status === 'streaming';
  const isPreview = currentOperation?.status === 'preview';
  const isError = currentOperation?.status === 'error';
  const isDisabled = isLoading || isStreaming;

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const buttons = buttonRefs.current.filter(Boolean) as HTMLButtonElement[];
      if (buttons.length === 0) return;

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          const nextIndex = (focusedIndexRef.current + 1) % buttons.length;
          focusedIndexRef.current = nextIndex;
          buttons[nextIndex]?.focus();
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const prevIndex = (focusedIndexRef.current - 1 + buttons.length) % buttons.length;
          focusedIndexRef.current = prevIndex;
          buttons[prevIndex]?.focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusedIndexRef.current = 0;
          buttons[0]?.focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          focusedIndexRef.current = buttons.length - 1;
          buttons[buttons.length - 1]?.focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          store.rejectOperation?.();
          break;
        }
      }
    },
    [store]
  );

  // Handle action button click
  const handleAction = useCallback(
    (action: AIAction) => {
      if (!selection || isDisabled) return;

      const prompt = action.prompt(selection.text);
      const operationId = store.startOperation?.('selection', projectId, documentId);

      if (operationId) {
        startStream({
          url: '/api/ai/generate',
          body: { prompt, projectId, documentId },
        });
      }
    },
    [selection, isDisabled, store, projectId, documentId, startStream]
  );

  // Handle accept
  const handleAccept = useCallback(() => {
    if (!selection || !currentOperation?.output) return;

    // Replace selected text with AI output
    try {
      const chain = editor.chain();
      if (chain && typeof chain.focus === 'function') {
        chain
          .focus()
          .setTextSelection({ from: selection.from, to: selection.to })
          .insertContent(currentOperation.output)
          .run();
      }
    } catch {
      // Handle mock editors or errors gracefully
    }

    store.acceptOperation?.();
  }, [editor, selection, currentOperation, store]);

  // Handle reject
  const handleReject = useCallback(() => {
    cancel();
    store.rejectOperation?.();
  }, [cancel, store]);

  // Track focused button
  const handleFocus = useCallback((index: number) => {
    focusedIndexRef.current = index;
  }, []);

  // Position style state - updated via useLayoutEffect for DOM measurement
  // This is a legitimate use case for setState in useLayoutEffect (measuring before paint)
  const [positionStyle, setPositionStyle] = useState<CSSProperties>({ position: 'absolute' });

  // Calculate position after mount when we can measure the parent element
  // Using useLayoutEffect to measure before paint - this is the correct pattern for
  // DOM measurement that needs to complete before the browser paints
  useLayoutEffect(() => {
    if (!selection?.rect) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement requires setState in useLayoutEffect
      setPositionStyle({ position: 'absolute' });
      return;
    }

    const editorElement = containerRef.current?.parentElement;
    let newTop: number;
    let newLeft: number;

    if (!editorElement) {
      // Fallback: use selection coordinates directly
      newTop = selection.rect.top - 50;
      newLeft = selection.rect.left;
    } else {
      // Get the positioned ancestor's bounding rect
      // The toolbar is rendered inside a div with position: relative in Editor.tsx
      const editorRect = editorElement.getBoundingClientRect();

      // Convert viewport coords to element-relative coords
      newTop = selection.rect.top - editorRect.top - 50;
      newLeft = selection.rect.left - editorRect.left;
    }

    setPositionStyle({
      position: 'absolute',
      top: `${newTop}px`,
      left: `${newLeft}px`,
    });
  }, [selection?.rect]);

  // Global escape key handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        store.rejectOperation?.();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [store]);

  // Don't render if no selection
  if (!selection) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Text formatting actions"
      aria-orientation="horizontal"
      style={positionStyle}
      className="flex items-center gap-1 rounded-lg bg-white p-2 shadow-lg border border-gray-200"
      onKeyDown={handleKeyDown}
    >
      {/* Loading/Status indicator for screen readers */}
      {(isLoading || isStreaming) && (
        <div role="status" aria-live="polite" className="sr-only">
          Generating AI response...
        </div>
      )}

      {/* Error alert */}
      {isError && currentOperation?.error && (
        <div role="alert" className="text-sm text-red-600 px-2">
          {currentOperation.error.message}
        </div>
      )}

      {/* Action buttons */}
      {!isPreview &&
        AI_ACTIONS.map((action, index) => (
          <button
            key={action.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            onClick={() => handleAction(action)}
            onFocus={() => handleFocus(index)}
            disabled={isDisabled}
            aria-label={`${action.label} - ${action.description}`}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {action.label}
          </button>
        ))}

      {/* Preview state: Accept/Reject buttons */}
      {isPreview && (
        <>
          <button
            ref={(el) => {
              buttonRefs.current[0] = el;
            }}
            type="button"
            onClick={handleAccept}
            onFocus={() => handleFocus(0)}
            aria-label="Accept AI suggestion"
            className="px-3 py-1.5 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            Accept
          </button>
          <button
            ref={(el) => {
              buttonRefs.current[1] = el;
            }}
            type="button"
            onClick={handleReject}
            onFocus={() => handleFocus(1)}
            aria-label="Reject AI suggestion"
            className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Reject
          </button>
        </>
      )}
    </div>
  );
}

export default SelectionToolbar;
