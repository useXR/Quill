// src/app/projects/[id]/citations/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCitations } from '@/lib/api/citations';
import { BookMarked } from 'lucide-react';

interface CitationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CitationsPage({ params }: CitationsPageProps) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    redirect('/projects');
  }

  let citations: Awaited<ReturnType<typeof getCitations>> = [];
  try {
    citations = await getCitations(projectId);
  } catch (error) {
    // Log error but continue with empty citations
    console.error('Failed to load citations:', error);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <BookMarked className="h-8 w-8 text-quill" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-primary">
              Citations
            </h1>
            <p className="font-ui text-sm text-ink-secondary mt-1">
              Manage citations for {project.title}
            </p>
          </div>
        </div>
      </header>

      {/* Search Section Placeholder - CitationSearch will be added in UI Components task */}
      <section className="mb-8">
        <h2 className="font-ui text-lg font-medium text-ink-primary mb-4">
          Search Papers
        </h2>
        <div className="p-4 bg-surface border border-ink-faint rounded-lg">
          <p className="font-ui text-sm text-ink-tertiary">
            Citation search will be available here.
          </p>
        </div>
      </section>

      {/* Citations List Section */}
      <section>
        <h2 className="font-ui text-lg font-medium text-ink-primary mb-4">
          Project Citations ({citations.length})
        </h2>
        {citations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-surface border border-ink-faint rounded-lg">
            <BookMarked className="h-12 w-12 text-ink-subtle mb-4" />
            <p className="font-ui text-ink-secondary">No citations yet</p>
            <p className="font-ui text-sm text-ink-tertiary mt-1">
              Search for papers above to add citations to your project.
            </p>
          </div>
        ) : (
          <ul className="space-y-4" role="list" aria-label="Citations">
            {citations.map((citation) => (
              <li
                key={citation.id}
                className="p-4 bg-surface border border-ink-faint rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <h3 className="font-display text-base font-medium text-ink-primary">
                  {citation.title}
                </h3>
                {citation.authors && (
                  <p className="font-ui text-sm text-ink-secondary mt-1">
                    {citation.authors}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 font-ui text-xs text-ink-tertiary">
                  {citation.year && <span>{citation.year}</span>}
                  {citation.journal && <span>• {citation.journal}</span>}
                  {citation.doi && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-success-light text-success rounded-md">
                      Verified
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export async function generateMetadata({ params }: CitationsPageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('title')
    .eq('id', projectId)
    .single();

  return {
    title: project ? `Citations - ${project.title}` : 'Citations',
    description: 'Manage project citations',
  };
}
