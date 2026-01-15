'use client';

import { useState } from 'react';
import { Trash2, BookMarked } from 'lucide-react';

interface Citation {
  id: string;
  title: string;
  authors?: string;
  year?: number;
  journal?: string;
  doi?: string;
}

interface CitationListProps {
  initialCitations: Citation[];
  onDelete: (id: string) => Promise<void>;
}

export function CitationList({ initialCitations, onDelete }: CitationListProps) {
  const [citations, setCitations] = useState<Citation[]>(initialCitations);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const deletedCitation = citations.find((c) => c.id === deleteTarget);
    const originalIndex = citations.findIndex((c) => c.id === deleteTarget);

    setCitations((prev) => prev.filter((c) => c.id !== deleteTarget));
    setDeleteTarget(null);

    try {
      await onDelete(deleteTarget);
    } catch (error) {
      setCitations((prev) => {
        const newCitations = [...prev];
        newCitations.splice(originalIndex, 0, deletedCitation!);
        return newCitations;
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (citations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <BookMarked className="h-12 w-12 text-ink-subtle mb-4" />
        <p className="font-ui text-ink-secondary">No citations yet</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-4" role="list" aria-label="Citations">
        {citations.map((citation) => (
          <li
            key={citation.id}
            className="flex items-start justify-between p-4 bg-surface border border-ink-faint rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-medium text-ink-primary">{citation.title}</h3>
              {citation.authors && <p className="font-ui text-sm text-ink-secondary mt-1">{citation.authors}</p>}
              <div className="flex items-center gap-2 mt-2 font-ui text-xs text-ink-tertiary">
                {citation.year && <span>{citation.year}</span>}
                {citation.journal && <span>• {citation.journal}</span>}
                {citation.doi && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-success-light text-success rounded-md">
                    Verified
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setDeleteTarget(citation.id)}
              className="ml-4 p-2 text-ink-tertiary hover:text-error rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2"
              aria-label="Delete citation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      {/* Simple delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-medium text-ink-primary">Delete Citation</h3>
            <p className="font-ui text-sm text-ink-secondary mt-2">
              Are you sure you want to delete this citation? This action can be undone within 30 days.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 font-ui text-sm font-medium text-ink-secondary bg-surface border border-ink-faint rounded-md hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 font-ui text-sm font-medium text-white bg-error hover:bg-error-dark rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
