# Task 0: Supabase Setup & Database Schema

> **Phase 1** | [← Overview](./00-overview.md) | [Next: Testing Infrastructure →](./02-testing-infrastructure.md)

---

## Context

**This task establishes the database foundation for the entire application.** All subsequent tasks depend on the schema, RLS policies, and Supabase client helpers created here.

### Prerequisites

- Node.js 24+ installed
- Supabase CLI installed (`npx supabase --version`)
- Project initialized with `npx create-next-app@latest`
- Supabase project linked (`npx supabase link`)

### What This Task Creates

- `supabase/migrations/20260113000000_initial_schema.sql` - Database schema
- `src/lib/supabase/server.ts` - Server client helper
- `src/lib/supabase/client.ts` - Browser client helper
- `src/lib/supabase/database.types.ts` - Generated TypeScript types
- `src/lib/supabase/index.ts` - Barrel export
- `src/lib/env.ts` - Type-safe environment variable helper
- `next.config.ts` - Security headers configuration

### Tasks That Depend on This

- **Task 1** (Testing Infrastructure) - Needs database types for mocks
- **Task 4** (Auth) - Uses auth_attempts table and rate limit function
- **Task 6** (Projects CRUD) - Uses projects table and RLS policies
- **Task 7** (Documents CRUD) - Uses documents table and RLS policies

---

## Files to Create/Modify

- `supabase/migrations/20260113000000_initial_schema.sql` (create)
- `src/lib/env.ts` (create)
- `src/lib/supabase/server.ts` (create)
- `src/lib/supabase/client.ts` (create)
- `src/lib/supabase/database.types.ts` (create - generated)
- `src/lib/supabase/index.ts` (create)
- `next.config.ts` (modify)

---

## Steps

### Step 0.1: Install Supabase SSR package

```bash
npm install @supabase/ssr @supabase/supabase-js
```

**Expected:** Packages added to package.json

### Step 0.2: Create environment variable helper

Create `src/lib/env.ts`:

```typescript
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

/**
 * Get optional environment variable with fallback.
 */
export function getEnvVarOptional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// Validated environment variables for Supabase
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
```

**Expected:** Type-safe env access prevents silent failures

### Step 0.3: Create initial schema migration

Create `supabase/migrations/20260113000000_initial_schema.sql`:

```sql
-- Projects table
CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'funded')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Documents table
CREATE TABLE public.documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content jsonb DEFAULT '{"type": "doc", "content": []}'::jsonb,
  content_text text DEFAULT '',
  sort_order integer DEFAULT 0,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Auth attempts table for rate limiting
CREATE TABLE public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now() NOT NULL,
  success boolean DEFAULT false
);

-- Indexes
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX idx_documents_project_id ON public.documents(project_id);
CREATE INDEX idx_documents_sort_order ON public.documents(project_id, sort_order);
CREATE INDEX idx_auth_attempts_email ON public.auth_attempts(email, created_at);
CREATE INDEX idx_auth_attempts_ip ON public.auth_attempts(ip_address, created_at);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Projects: users can only access their own
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Documents: users can access documents in their projects
CREATE POLICY "Users can view documents in own projects" ON public.documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create documents in own projects" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update documents in own projects" ON public.documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete documents in own projects" ON public.documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Rate limit check function
CREATE OR REPLACE FUNCTION check_auth_rate_limit(
  p_email text,
  p_ip inet,
  max_attempts int DEFAULT 5,
  window_minutes int DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  attempt_count int;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_attempts
  WHERE (email = p_email OR ip_address = p_ip)
    AND created_at > now() - (window_minutes || ' minutes')::interval;
  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 0.4: Apply migration

```bash
npx supabase db reset
```

**Expected:** "Resetting local database... Done"

### Step 0.5: Generate TypeScript types

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

**Expected:** File created with Database type definitions

### Step 0.6: Create server client helper

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { env } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component - ignore
        }
      },
    },
  });
}
```

### Step 0.7: Create browser client helper

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { env } from '@/lib/env';

export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
```

### Step 0.8: Create barrel export

Create `src/lib/supabase/index.ts`:

```typescript
export { createClient as createServerClient } from './server';
export { createClient as createBrowserClient } from './client';
export type { Database } from './database.types';
```

### Step 0.9: Configure security headers and standalone output

Update `next.config.ts` to add security headers and standalone output (required for Docker multi-stage builds):

```typescript
import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    // Content Security Policy - adjust sources as needed for your app
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'", // Inline styles for TipTap
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Required for Docker multi-stage builds (see infrastructure-best-practices.md)
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

**Notes:**

- `output: 'standalone'` is required for efficient Docker deployments (see `docs/best-practices/infrastructure-best-practices.md`)
- CSP `connect-src` allows Supabase API and WebSocket connections
- CSP may need adjustment if using external fonts, analytics, or other services
- In development, Next.js needs `unsafe-eval` for fast refresh

**Expected:** Security headers applied to all routes, standalone output enabled

### Step 0.10: Commit

```bash
git add supabase/migrations src/lib/supabase src/lib/env.ts next.config.ts
git commit -m "chore: add Supabase setup with schema, RLS, client helpers, and security headers"
```

---

## Verification Checklist

- [ ] Supabase packages installed
- [ ] Environment variable helper created (`src/lib/env.ts`)
- [ ] Migration file created
- [ ] Database reset successful
- [ ] TypeScript types generated
- [ ] Server client helper created (using `env` helper)
- [ ] Browser client helper created (using `env` helper)
- [ ] Barrel export created (`src/lib/supabase/index.ts`)
- [ ] Security headers configured in `next.config.ts` (including CSP)
- [ ] `output: 'standalone'` configured for Docker builds
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 1: Testing Infrastructure](./02-testing-infrastructure.md)**.
