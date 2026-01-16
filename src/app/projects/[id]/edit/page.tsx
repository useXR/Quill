import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProject, getDocuments, ApiError } from '@/lib/api';
import { ProjectLayout } from '@/components/projects/ProjectLayout';
import { EditProjectForm } from '@/components/projects/EditProjectForm';

export const dynamic = 'force-dynamic';

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
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

  if (!project) {
    notFound();
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

  return (
    <ProjectLayout
      projectId={id}
      projectTitle={project.title}
      documents={documents}
      vaultItemCount={vaultItemCount || 0}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2" style={{ fontFamily: 'var(--font-ui)' }}>
            <li>
              <Link
                href="/projects"
                className="text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-primary)] transition-colors duration-150"
              >
                Projects
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <Link
                href={`/projects/${id}`}
                className="ml-2 text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-primary)] transition-colors duration-150"
              >
                {project.title}
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <span className="ml-2 text-sm text-[var(--color-ink-secondary)] font-medium">Edit</span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-[var(--color-ink-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Edit Project
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-tertiary)]" style={{ fontFamily: 'var(--font-ui)' }}>
            Update your project details below.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] border border-[var(--color-ink-faint)] p-6">
          <EditProjectForm project={project} />
        </div>
      </div>
    </ProjectLayout>
  );
}
