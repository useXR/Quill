import { redirect } from 'next/navigation';

interface HomeProps {
  searchParams: Promise<{ code?: string; next?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  // If there's an auth code, redirect to auth callback to exchange it
  if (params.code) {
    const next = params.next || '/projects';
    redirect(`/auth/callback?code=${params.code}&next=${encodeURIComponent(next)}`);
  }

  redirect('/projects');
}
