import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppProviders } from '@/components/layout';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AppProviders>{children}</AppProviders>;
}
