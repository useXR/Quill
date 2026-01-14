'use client';

import { useCallback, useState, useEffect } from 'react';
import { Editor } from './Editor';
import { SaveStatus } from './SaveStatus';
import { useAutosave } from '@/hooks/useAutosave';
import type { Document, TipTapDocument } from '@/lib/supabase/types';

interface DocumentEditorProps {
  documentId: string;
  initialDocument?: Document;
  placeholder?: string;
  characterLimit?: number;
  onSave?: (document: Document) => void;
  onConflict?: (serverVersion: number, localVersion: number) => void;
}

interface ApiResponse {
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export function DocumentEditor({
  documentId,
  initialDocument,
  placeholder,
  characterLimit,
  onSave,
  onConflict,
}: DocumentEditorProps) {
  const [document, setDocument] = useState<Document | null>(initialDocument ?? null);
  const [version, setVersion] = useState<number>(initialDocument?.version ?? 1);
  const [isLoading, setIsLoading] = useState(!initialDocument);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  // Fetch document if not provided initially
  useEffect(() => {
    if (initialDocument) {
      return;
    }

    const fetchDocument = async () => {
      setIsLoading(true);
      setFetchError(null);

      try {
        const response = await fetch(`/api/documents/${documentId}`);
        const data: ApiResponse | Document = await response.json();

        if (!response.ok) {
          throw new Error((data as ApiResponse).error || 'Failed to fetch document');
        }

        const doc = data as Document;
        setDocument(doc);
        setVersion(doc.version);
      } catch (err) {
        setFetchError(err instanceof Error ? err : new Error('Failed to fetch document'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [documentId, initialDocument]);

  // Save function for autosave hook
  const saveContent = useCallback(
    async (content: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: JSON.parse(content),
          expectedVersion: version,
        }),
      });

      const data: ApiResponse | Document = await response.json();

      if (!response.ok) {
        const apiResponse = data as ApiResponse;
        // Handle version conflict
        if (response.status === 409 && apiResponse.code === 'CONFLICT') {
          // Fetch the latest version to report the conflict
          const latestResponse = await fetch(`/api/documents/${documentId}`);
          const latestDoc = (await latestResponse.json()) as Document;

          onConflict?.(latestDoc.version, version);
          throw new Error('Version conflict: document was modified elsewhere');
        }

        throw new Error(apiResponse.error || 'Failed to save document');
      }

      const savedDoc = data as Document;
      setDocument(savedDoc);
      setVersion(savedDoc.version);
      onSave?.(savedDoc);
    },
    [documentId, version, onSave, onConflict]
  );

  const { triggerSave, saveNow, status, error, lastSavedAt } = useAutosave({
    save: saveContent,
  });

  // Handle editor content changes
  const handleChange = useCallback(
    (_html: string, json: object) => {
      triggerSave(JSON.stringify(json));
    },
    [triggerSave]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    saveNow();
  }, [saveNow]);

  // Get initial content from document
  const initialContent = document?.content ? JSON.stringify(document.content as TipTapDocument) : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-gray-500">Loading document...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
        <div className="text-red-500">Error loading document: {fetchError.message}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <SaveStatus status={status} lastSavedAt={lastSavedAt} error={error} onRetry={handleRetry} />
      </div>
      <Editor
        content={initialContent}
        placeholder={placeholder}
        characterLimit={characterLimit}
        onChange={handleChange}
      />
    </div>
  );
}
