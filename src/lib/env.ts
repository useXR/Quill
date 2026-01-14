/**
 * Type-safe environment variable access.
 * Throws immediately if required variables are missing.
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnvVarOptional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  get supabaseUrl() {
    return getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey() {
    return getEnvVarOptional('SUPABASE_SERVICE_ROLE_KEY', '');
  },
} as const;
