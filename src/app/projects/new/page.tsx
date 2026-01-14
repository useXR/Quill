import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewProjectForm } from '@/components/projects';
import { Card } from '@/components/ui/Card';

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-[var(--color-ink-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Create New Project
          </h1>
          <p className="mt-1 text-[var(--color-ink-secondary)]" style={{ fontFamily: 'var(--font-ui)' }}>
            Start a new grant proposal
          </p>
        </div>

        <Card padding="lg">
          <NewProjectForm />
        </Card>
      </div>
    </div>
  );
}
