import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: false, // Force fresh client creation
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: false, // Allow non-HTTPS for local dev
    },
  });
}
