import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProjects } from '@/lib/api';
import { ProjectList } from '@/components/projects';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { items: projects } = await getProjects();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-bold text-[var(--color-ink-primary)] tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Projects
            </h1>
            <p className="mt-1 text-[var(--color-ink-secondary)]" style={{ fontFamily: 'var(--font-ui)' }}>
              Manage your grant proposals
            </p>
          </div>
          <Link href="/projects/new">
            <Button leftIcon={<Plus className="w-5 h-5" />}>New Project</Button>
          </Link>
        </div>

        <ProjectList projects={projects} />
      </div>
    </div>
  );
}
