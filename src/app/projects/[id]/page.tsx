import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FileText, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProject, getDocuments, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { AddDocumentButton } from '@/components/projects/AddDocumentButton';
import { ProjectLayout } from '@/components/projects/ProjectLayout';
import type { ProjectStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let project;
  let documents;
  try {
    [project, documents] = await Promise.all([getProject(id), getDocuments(id)]);
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
    .eq('project_id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (vaultCountError) {
    console.error('Failed to fetch vault item count:', vaultCountError);
  }

  const status = (project.status || 'draft') as ProjectStatus;

  return (
    <ProjectLayout
      projectId={id}
      projectTitle={project.title}
      documents={documents}
      vaultItemCount={vaultItemCount || 0}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-warm-sm)] border border-[var(--color-ink-faint)] p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1
                  className="text-2xl font-bold text-[var(--color-ink-primary)] tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {project.title}
                </h1>
                <StatusBadge status={status} />
              </div>
              {project.description && (
                <p className="text-[var(--color-ink-secondary)] mt-2" style={{ fontFamily: 'var(--font-ui)' }}>
                  {project.description}
                </p>
              )}
              <div className="mt-4 text-sm text-[var(--color-ink-tertiary)]" style={{ fontFamily: 'var(--font-ui)' }}>
                <span>Created {formatDate(project.created_at)}</span>
                <span className="mx-2 text-[var(--color-ink-faint)]">|</span>
                <span>Updated {formatDate(project.updated_at)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/projects/${id}/edit`}>
                <Button variant="secondary" size="sm" leftIcon={<Pencil className="w-4 h-4" />}>
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-warm-sm)] border border-[var(--color-ink-faint)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-lg font-semibold text-[var(--color-ink-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Documents
            </h2>
            <AddDocumentButton projectId={id} />
          </div>

          {documents.length === 0 ? (
            /* Empty state */
            <div className="text-center py-12">
              <FileText
                className="mx-auto h-12 w-12 text-[var(--color-ink-subtle)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <p className="mt-4 text-sm text-[var(--color-ink-tertiary)]" style={{ fontFamily: 'var(--font-ui)' }}>
                No documents yet. Add a document to start writing your proposal.
              </p>
            </div>
          ) : (
            /* Document list */
            <ul className="divide-y divide-[var(--color-ink-faint)]">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/projects/${id}/documents/${doc.id}`}
                    className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
                  >
                    <FileText className="h-5 w-5 text-[var(--color-ink-tertiary)]" strokeWidth={1.5} />
                    <span
                      className="text-[var(--color-ink-primary)] font-medium"
                      style={{ fontFamily: 'var(--font-ui)' }}
                    >
                      {doc.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ProjectLayout>
  );
}
