// src/app/projects/[id]/citations/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCitations } from '@/lib/api/citations';
import { BookMarked } from 'lucide-react';
import { CitationsClient } from './CitationsClient';

interface CitationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CitationsPage({ params }: CitationsPageProps) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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
            <h1 className="font-display text-2xl font-semibold text-ink-primary">Citations</h1>
            <p className="font-ui text-sm text-ink-secondary mt-1">Manage citations for {project.title}</p>
          </div>
        </div>
      </header>

      <CitationsClient projectId={projectId} initialCitations={citations} />
    </div>
  );
}

export async function generateMetadata({ params }: CitationsPageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();

  return {
    title: project ? `Citations - ${project.title}` : 'Citations',
    description: 'Manage project citations',
  };
}
