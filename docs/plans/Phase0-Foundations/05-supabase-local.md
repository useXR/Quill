# Task 0.5: Set Up Supabase Local Development

> **Phase 0** | [<- Playwright Setup](./04-playwright-setup.md) | [Next: Database Schema ->](./06-database-schema.md)

---

## Context

**This task sets up local Supabase development with Docker.** Supabase provides PostgreSQL database, authentication, and storage.

### Prerequisites

- **Task 0.2** completed (ESLint/Prettier configured)
- Docker installed and running

### What This Task Creates

- Supabase local development environment
- Browser and server Supabase clients
- Environment configuration files

### Tasks That Depend on This

- **Task 0.6** (Database Schema) - creates tables in the database
- **Task 0.7** (TypeScript Types) - generates types from the schema

### Parallel Tasks

This task can be done in parallel with:

- **Task 0.3** (Vitest)
- **Task 0.4** (Playwright)

> **Note:** Supabase auth middleware (`src/middleware.ts`) is required for production
> auth flows but will be implemented in **Phase 1** when we add authentication.
> The server client created here is sufficient for Phase 0's testing needs.

---

## Files to Create/Modify

- `supabase/config.toml` (generated)
- `.env.local` (create)
- `.env.local.example` (create)
- `src/lib/supabase/client.ts` (create)
- `src/lib/supabase/server.ts` (create)
- `package.json` (modify)

---

## Steps

### Step 1: Verify Docker is running

```bash
docker ps
```

**If error:** Start Docker Desktop or Docker daemon first.

### Step 2: Install Supabase CLI and client libraries

```bash
# Pin Supabase CLI version for consistency across team
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D supabase@2.72.6
```

**Note:** Pinning the Supabase CLI version (now v2.x) prevents unexpected breaking changes. The Supabase CLI 2.x includes minor improvements but maintains compatibility with existing workflows.

### Step 3: Initialize Supabase

```bash
pnpm exec supabase init
```

**Expected:** Creates `supabase/` directory with `config.toml`

### Step 4: Start local Supabase

```bash
echo "Waiting for Supabase (this takes 2-3 minutes on first run)..."
pnpm exec supabase start
```

**Expected output:** Local Supabase running with URLs printed.

**Save these values from output:**

- `API URL`: http://127.0.0.1:54321
- `anon key`: (long JWT string starting with `eyJ`)
- `service_role key`: (another long JWT string)

### Step 5: Create environment example file

Create `.env.local.example`:

```bash
# Supabase - get these from `pnpm exec supabase status`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-status
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-status

# OpenAI - for embeddings (Phase 2)
OPENAI_API_KEY=your-openai-key
```

### Step 6: Create actual environment file

Create `.env.local` with actual values from Step 4:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here>
```

### Step 7: Create Supabase client for browser

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for browser-side operations.
 * Uses the anon key which respects RLS policies.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
```

### Step 8: Create Supabase client for server

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for server-side operations.
 * Uses the anon key which respects RLS policies.
 * Handles cookie-based auth for SSR.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component - ignore (can't set cookies in Server Components)
        }
      },
    },
  });
}
```

### Step 8b: Create admin client for service-role operations

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Create a Supabase admin client with service role key.
 * BYPASSES RLS - use with extreme caution!
 *
 * Use cases:
 * - Server-side operations that need to bypass RLS
 * - Batch operations in API routes
 * - Admin functionality
 *
 * NEVER expose this client to the browser or client-side code.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin environment variables. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

**Warning:** The admin client bypasses Row Level Security. Only use it in server-side code (API routes, server actions) where you explicitly need to bypass RLS.

### Step 9: Add Supabase scripts to package.json

Add to `scripts`:

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:status": "supabase status",
"db:push": "supabase db push",
"test:all": "pnpm lint && pnpm format:check && pnpm test && pnpm test:e2e:chromium"
```

### Step 10: Update .gitignore

Append to `.gitignore`:

```
# Environment
.env.local
.env*.local

# Supabase
supabase/.branches
supabase/.temp
```

### Step 11: Commit

```bash
git add .
git commit -m "chore: configure Supabase local development"
```

---

## Verification Checklist

- [ ] Docker is running
- [ ] `supabase/config.toml` created
- [ ] `pnpm exec supabase status` shows running services
- [ ] `.env.local.example` created
- [ ] `.env.local` created with actual keys
- [ ] `src/lib/supabase/client.ts` created with env validation
- [ ] `src/lib/supabase/server.ts` created with env validation
- [ ] `src/lib/supabase/admin.ts` created for service-role operations
- [ ] Supabase Studio accessible at http://localhost:54323
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 0.6: Create Database Schema](./06-database-schema.md)**.
