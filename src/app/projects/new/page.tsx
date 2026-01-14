import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewProjectForm } from '@/components/projects';

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
          <p className="mt-1 text-sm text-gray-500">Start a new grant proposal</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <NewProjectForm />
        </div>
      </div>
    </div>
  );
}
