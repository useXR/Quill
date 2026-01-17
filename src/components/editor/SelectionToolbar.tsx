'use client';

import { useCallback, useRef, useEffect, useLayoutEffect, useState, KeyboardEvent, CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { Loader2 } from 'lucide-react';
import { useAIStore } from '@/lib/stores/ai-store';
import { useAIStream } from '@/hooks/useAIStream';
import { useToast } from '@/hooks/useToast';
import type { SelectionState } from './extensions/selection-tracker';

/**
 * Maps technical error messages to user-friendly messages.
 */
const getUserFriendlyError = (error: Error | { message: string }): string => {
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'Could not connect to AI service. Check your internet connection.';
  }
  if (message.includes('429') || message.includes('rate')) {
    return 'AI service is busy. Please try again in a moment.';
  }
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  if (message.includes('401') || message.includes('unauthorized')) {
    return 'Session expired. Please refresh the page.';
  }
  return 'Something went wrong. Please try again.';
};

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
      `Rewrite the following text to improve its clarity, flow, and readability. Output ONLY the refined text with no explanations or commentary. Use markdown formatting (headings, lists, bold, italic, code) when it improves structure. Preserve the original meaning and approximate length.

TEXT TO REFINE:
${text}

REFINED VERSION:`,
  },
  {
    id: 'extend',
    label: 'Extend',
    description: 'Expand on this text',
    prompt: (text) =>
      `Expand the following text by adding more detail, examples, and depth. Make it approximately 2-3x longer while maintaining the same style and tone. Output ONLY the expanded text with no explanations or commentary. Use markdown formatting (headings, lists, bold, italic, code) when it improves structure.

TEXT TO EXPAND:
${text}

EXPANDED VERSION:`,
  },
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Create a shorter version',
    prompt: (text) =>
      `Summarize the following text to approximately 1/3 of its original length while preserving the key points. Output ONLY the summary with no explanations or commentary. Use markdown formatting (headings, lists, bold, italic, code) when it improves structure.

TEXT TO SUMMARIZE:
${text}

SUMMARY:`,
  },
  {
    id: 'simplify',
    label: 'Simplify',
    description: 'Make it easier to understand',
    prompt: (text) =>
      `Rewrite the following text using simpler words and shorter sentences to make it easier to understand. Preserve the meaning and approximate length. Output ONLY the simplified text with no explanations or commentary. Use markdown formatting (headings, lists, bold, italic, code) when it improves structure.

TEXT TO SIMPLIFY:
${text}

SIMPLIFIED VERSION:`,
  },
];

export function SelectionToolbar({ editor, selection, projectId, documentId }: SelectionToolbarProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [lastAction, setLastAction] = useState<AIAction | null>(null);
  const toast = useToast();

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

      // Cancel any previous streaming operation
      if (currentOperation?.status === 'streaming') {
        cancel();
      }

      setLastAction(action);
      const prompt = action.prompt(selection.text);
      const operationId = store.startOperation?.('selection', projectId, documentId);

      if (operationId) {
        startStream({
          url: '/api/ai/generate',
          body: { prompt, projectId, documentId },
        });
      }
    },
    [selection, isDisabled, store, projectId, documentId, startStream, cancel, currentOperation?.status]
  );

  // Handle accept
  const handleAccept = useCallback(() => {
    // Debounce: prevent double-click
    if (isAccepting) return;

    if (!selection || !currentOperation?.output) return;

    // Validate: prevent empty/whitespace-only output
    const output = currentOperation.output.trim();
    if (!output) {
      toast.addToast('AI returned empty content. Please try again.', { type: 'error' });
      return;
    }

    // Validate: check selection is still valid
    const docLength = editor.state.doc.content.size;
    if (selection.to > docLength || selection.from > docLength) {
      toast.addToast('Selection is no longer valid. Please select text again.', { type: 'error' });
      store.rejectOperation?.();
      return;
    }

    setIsAccepting(true);

    // Replace selected text with AI output using markdown content type
    try {
      const chain = editor.chain();
      if (chain && typeof chain.focus === 'function') {
        chain
          .focus()
          .insertContentAt({ from: selection.from, to: selection.to }, currentOperation.output, {
            contentType: 'markdown',
          })
          .run();
      }
    } catch {
      // Handle mock editors or errors gracefully
    } finally {
      setIsAccepting(false);
    }

    store.acceptOperation?.();
  }, [editor, selection, currentOperation, store, isAccepting, toast]);

  // Handle reject
  const handleReject = useCallback(() => {
    cancel();
    store.rejectOperation?.();
  }, [cancel, store]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    if (!selection || !lastAction) return;
    store.rejectOperation?.();
    // Re-trigger the last action
    handleAction(lastAction);
  }, [selection, lastAction, store, handleAction]);

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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (currentOperation?.status === 'streaming') {
        cancel();
        store.rejectOperation?.();
      }
    };
  }, [currentOperation?.status, cancel, store]);

  // Cleanup on document change
  useEffect(() => {
    return () => {
      if (currentOperation) {
        cancel();
        store.rejectOperation?.();
      }
    };
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Loading/Status indicator */}
      {(isLoading || isStreaming) && (
        <>
          <div role="status" aria-live="polite" className="sr-only">
            Generating AI response...
          </div>
          <div className="flex items-center gap-2 px-2">
            <Loader2 className="animate-spin h-4 w-4 text-gray-500" aria-hidden="true" />
            <span className="text-xs text-gray-500">{isStreaming ? 'Generating...' : 'Starting...'}</span>
          </div>
        </>
      )}

      {/* Streaming preview explanation */}
      {isStreaming && (
        <div className="text-xs text-gray-500 px-2">Preview shows raw format. Styling applied when accepted.</div>
      )}

      {/* Error alert with retry button */}
      {isError && currentOperation?.error && (
        <div role="alert" className="flex items-center gap-2 text-sm text-red-600 px-2">
          <span>{getUserFriendlyError(currentOperation.error)}</span>
          {lastAction && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
            >
              Try again
            </button>
          )}
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
            disabled={isAccepting}
            aria-label="Accept AI suggestion"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              isAccepting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            {isAccepting ? 'Accepting...' : 'Accept'}
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
