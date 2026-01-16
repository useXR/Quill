import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProject, getDocument, getDocuments, ApiError } from '@/lib/api';
import { ProjectLayout } from '@/components/projects/ProjectLayout';
import { DocumentPageClient } from './DocumentPageClient';

export const dynamic = 'force-dynamic';

interface DocumentPageProps {
  params: Promise<{ id: string; docId: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id: projectId, docId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let project;
  let document;
  let documents;

  try {
    [project, document, documents] = await Promise.all([
      getProject(projectId),
      getDocument(docId),
      getDocuments(projectId),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  // Get vault item count for sidebar (errors are non-fatal, default to 0)
  const { count: vaultItemCount, error: vaultCountError } = await supabase
    .from('vault_items')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (vaultCountError) {
    console.error('Failed to fetch vault item count:', vaultCountError);
  }

  // Verify document belongs to this project
  if (document.project_id !== projectId) {
    notFound();
  }

  return (
    <ProjectLayout
      projectId={projectId}
      projectTitle={project.title}
      documents={documents}
      vaultItemCount={vaultItemCount || 0}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link
                href="/projects"
                className="text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
              >
                Projects
              </Link>
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-[var(--color-ink-faint)]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <Link
                href={`/projects/${projectId}`}
                className="ml-2 text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
              >
                {project.title}
              </Link>
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-[var(--color-ink-faint)]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span
                className="ml-2 text-sm font-medium text-[var(--color-ink-primary)]"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {document.title}
              </span>
            </li>
          </ol>
        </nav>

        {/* Document Editor with Chat and Diff integration */}
        <DocumentPageClient documentId={docId} projectId={projectId} document={document} />
      </div>
    </ProjectLayout>
  );
}
