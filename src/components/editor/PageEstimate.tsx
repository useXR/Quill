'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { useDocumentEditorSafe } from '@/contexts/DocumentEditorContext';
import { PAGE } from '@/lib/constants';

/**
 * Displays an estimated page count based on editor content height.
 * Uses US Letter page dimensions with 1" margins to calculate.
 */
export function PageEstimate() {
  const context = useDocumentEditorSafe();
  const [pageCount, setPageCount] = useState(1);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const editor = context?.editorRef.current;
    if (!editor) return;

    const calculatePageCount = () => {
      const dom = editor.view?.dom;
      if (!dom) return;

      const contentHeight = dom.scrollHeight;
      const estimated = Math.max(1, Math.ceil(contentHeight / PAGE.CONTENT_HEIGHT_PX));
      setPageCount(estimated);
    };

    // Calculate after a small delay to ensure DOM is ready
    const initialTimeout = setTimeout(calculatePageCount, 100);

    // Listen for editor updates with debounce
    const handleUpdate = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(calculatePageCount, 200);
    };

    editor.on('update', handleUpdate);

    // Also recalculate on window resize (affects content reflow)
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(initialTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      editor.off('update', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [context?.editorRef]);

  // Don't render if no editor context
  if (!context) return null;

  return (
    <div
      className="
        flex items-center gap-1.5
        px-3 py-1.5
        bg-surface rounded-full
        shadow-warm-sm
        text-ink-secondary text-sm
        select-none
      "
      title={`Estimated ${pageCount} page${pageCount !== 1 ? 's' : ''} when exported to PDF (US Letter, 1" margins)`}
      data-testid="page-estimate"
    >
      <FileText className="h-4 w-4" aria-hidden="true" />
      <span>
        ~{pageCount} page{pageCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
