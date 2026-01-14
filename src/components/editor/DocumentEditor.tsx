'use client';

import { useCallback, useState, useEffect } from 'react';
import { Editor } from './Editor';
import { SaveStatus } from './SaveStatus';
import { EditableTitle } from './EditableTitle';
import { useAutosave } from '@/hooks/useAutosave';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Document } from '@/lib/supabase/types';

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
        setVersion(doc.version ?? 1);
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

          onConflict?.(latestDoc.version ?? 1, version);
          throw new Error('Version conflict: document was modified elsewhere');
        }

        throw new Error(apiResponse.error || 'Failed to save document');
      }

      const savedDoc = data as Document;
      setDocument(savedDoc);
      setVersion(savedDoc.version ?? version + 1);
      onSave?.(savedDoc);
    },
    [documentId, version, onSave, onConflict]
  );

  // Save title function
  const saveTitle = useCallback(
    async (newTitle: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle,
        }),
      });

      const data: ApiResponse | Document = await response.json();

      if (!response.ok) {
        throw new Error((data as ApiResponse).error || 'Failed to save title');
      }

      const savedDoc = data as Document;
      setDocument(savedDoc);
      setVersion(savedDoc.version ?? version + 1); // Update version to prevent conflicts
      onSave?.(savedDoc);
    },
    [documentId, version, onSave]
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

  // Get initial content from document - pass JSON object directly to TipTap
  // TipTap accepts either HTML string or JSON object, not a JSON string
  const initialContent = document?.content ? (document.content as unknown as object) : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-[var(--color-ink-tertiary)]" style={{ fontFamily: 'var(--font-ui)' }}>
          Loading document...
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
        <Alert variant="error" title="Error loading document">
          {fetchError.message}
        </Alert>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <EditableTitle title={document?.title || 'Untitled Document'} onSave={saveTitle} />
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
