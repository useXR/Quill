import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VaultPageClient } from './VaultPageClient';
import type { VaultItem } from '@/lib/vault/types';

export const dynamic = 'force-dynamic';

interface VaultPageProps {
  params: Promise<{ id: string }>;
}

export default async function VaultPage({ params }: VaultPageProps) {
  const { id: projectId } = await params;

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    redirect('/projects');
  }

  // Fetch initial vault items (exclude soft-deleted)
  const { data: items } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const vaultItems: VaultItem[] = items ?? [];

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <VaultPageClient projectId={projectId} initialItems={vaultItems} />
      </div>
    </div>
  );
}
