'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { useDocumentEditorSafe } from '@/contexts/DocumentEditorContext';

// Estimated words per page for US Letter, 12pt Libre Baskerville, 1.6 line height, 1" margins
// Based on ~60 chars/line, ~50 lines/page = ~3000 chars = ~500-550 words
const WORDS_PER_PAGE = 500;

/**
 * Displays an estimated page count based on word count.
 * Uses typical US Letter page density for 12pt serif font.
 */
export function PageEstimate() {
  const context = useDocumentEditorSafe();
  const [pageCount, setPageCount] = useState(1);
  const [editorReady, setEditorReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for editor availability since refs don't trigger re-renders
  useEffect(() => {
    if (!context) return;

    const checkEditor = () => {
      const editor = context.editorRef.current;
      if (editor?.view?.dom) {
        setEditorReady(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    };

    // Check immediately
    checkEditor();

    // Poll every 100ms until editor is ready
    if (!editorReady) {
      pollRef.current = setInterval(checkEditor, 100);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [context, editorReady]);

  // Set up listeners once editor is ready
  useEffect(() => {
    if (!editorReady || !context) return;

    const editor = context.editorRef.current;
    if (!editor) return;

    const calculatePageCount = () => {
      const text = editor.getText();
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      const estimated = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
      setPageCount(estimated);
    };

    // Calculate initial page count
    const initialTimeout = setTimeout(calculatePageCount, 50);

    // Listen for editor updates with debounce
    const handleUpdate = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(calculatePageCount, 200);
    };

    editor.on('update', handleUpdate);

    return () => {
      clearTimeout(initialTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      editor.off('update', handleUpdate);
    };
  }, [editorReady, context]);

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
      title={`Estimated ${pageCount} page${pageCount !== 1 ? 's' : ''} when exported to PDF (US Letter, 1" margins, ~${WORDS_PER_PAGE} words/page)`}
      data-testid="page-estimate"
    >
      <FileText className="h-4 w-4" aria-hidden="true" />
      <span>
        ~{pageCount} page{pageCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
