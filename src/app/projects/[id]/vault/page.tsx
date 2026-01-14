import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { VaultPageClient } from './VaultPageClient';
import { ProjectLayout } from '@/components/projects/ProjectLayout';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VaultPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !project) {
    redirect('/projects');
  }

  // Get documents for sidebar
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, sort_order')
    .eq('project_id', id)
    .order('sort_order', { ascending: true });

  // Get vault items
  const { data: items } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <ProjectLayout
      projectId={id}
      projectTitle={project.title}
      documents={documents || []}
      vaultItemCount={items?.length || 0}
    >
      <VaultPageClient projectId={id} initialItems={items || []} />
    </ProjectLayout>
  );
}
