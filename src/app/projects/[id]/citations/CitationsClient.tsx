'use client';

import { useState, useCallback } from 'react';
import { CitationSearch } from '@/components/citations/CitationSearch';
import { CitationList } from '@/components/citations/CitationList';
import type { Paper } from '@/lib/citations/types';
import type { Database } from '@/lib/supabase/database.types';

type Citation = Database['public']['Tables']['citations']['Row'];

interface CitationsClientProps {
  projectId: string;
  initialCitations: Citation[];
}

export function CitationsClient({ projectId, initialCitations }: CitationsClientProps) {
  const [citations, setCitations] = useState<Citation[]>(initialCitations);
  const [addedPaperIds, setAddedPaperIds] = useState<Set<string>>(
    new Set(initialCitations.map((c) => c.paper_id).filter(Boolean) as string[])
  );

  const handleAddCitation = useCallback(
    async (paper: Paper) => {
      try {
        const response = await fetch('/api/citations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title: paper.title,
            authors: paper.authors.map((a) => a.name).join(', '),
            year: paper.year,
            journal: paper.journal?.name,
            doi: paper.externalIds?.DOI,
            url: paper.url,
            abstract: paper.abstract,
            paperId: paper.paperId,
            citationCount: paper.citationCount,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to add citation');
        }

        const newCitation = await response.json();
        setCitations((prev) => [newCitation, ...prev]);
        setAddedPaperIds((prev) => new Set([...prev, paper.paperId]));
      } catch (error) {
        console.error('Failed to add citation:', error);
        throw error;
      }
    },
    [projectId]
  );

  const handleDeleteCitation = useCallback(async (citationId: string) => {
    try {
      const response = await fetch(`/api/citations/${citationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete citation');
      }

      setCitations((prev) => {
        const deleted = prev.find((c) => c.id === citationId);
        if (deleted?.paper_id) {
          setAddedPaperIds((prevIds) => {
            const newIds = new Set(prevIds);
            newIds.delete(deleted.paper_id!);
            return newIds;
          });
        }
        return prev.filter((c) => c.id !== citationId);
      });
    } catch (error) {
      console.error('Failed to delete citation:', error);
      throw error;
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Search Section */}
      <section>
        <h2 className="font-ui text-lg font-medium text-ink-primary mb-4">Search Papers</h2>
        <CitationSearch onAdd={handleAddCitation} addedPaperIds={addedPaperIds} />
      </section>

      {/* Citations List Section */}
      <section>
        <h2 className="font-ui text-lg font-medium text-ink-primary mb-4">Project Citations ({citations.length})</h2>
        <CitationList citations={citations} onDelete={handleDeleteCitation} />
      </section>
    </div>
  );
}
