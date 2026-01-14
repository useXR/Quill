# Quill MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered document editor for academic grant writing with Claude Code CLI integration.

**Architecture:** Next.js app with TipTap editor, Supabase backend (auth, postgres, storage, pgvector), Claude Code CLI spawned as subprocess for AI operations.

**Tech Stack:** TypeScript, Next.js 14 (App Router), TipTap/ProseMirror, Supabase, Vitest (unit/integration), Playwright (e2e), Tailwind CSS

---

## Phase 0: Foundation & Testing Infrastructure

This phase establishes the complete development environment, testing pyramid, and CI/CD pipeline before any feature work begins.

---

### Task 0.1: Initialize Next.js Project

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `.gitignore`

**Step 1: Create Next.js project with TypeScript**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Project scaffolded with App Router structure

**Step 2: Verify dev server starts**

```bash
npm run dev
```

Expected: Server running on http://localhost:3000

**Step 3: Commit**

```bash
git add .
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 0.2: Configure ESLint and Prettier

**Files:**

- Modify: `package.json`
- Create: `.prettierrc`
- Modify: `eslint.config.mjs`

**Step 1: Install Prettier and ESLint plugins**

```bash
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
```

**Step 2: Create Prettier config**

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Step 3: Update ESLint config to integrate Prettier**

Update `eslint.config.mjs` to extend prettier:

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier')];

export default eslintConfig;
```

**Step 4: Add format script to package.json**

Add to `scripts` in `package.json`:

```json
"format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\""
```

**Step 5: Run format and lint**

```bash
npm run format
npm run lint
```

Expected: No errors

**Step 6: Commit**

```bash
git add .
git commit -m "chore: configure ESLint and Prettier"
```

---

### Task 0.3: Set Up Vitest for Unit/Integration Testing

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/example.test.ts`
- Create: `vitest.setup.ts`

**Step 1: Install Vitest and testing utilities**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/dom jsdom @testing-library/user-event
```

**Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/**/*.d.ts', '**/*.config.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 3: Create Vitest setup file**

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

**Step 4: Install jest-dom for Vitest**

```bash
npm install -D @testing-library/jest-dom
```

**Step 5: Write first test (TDD - this should pass)**

Create `src/lib/__tests__/example.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Example test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 6: Add test scripts to package.json**

Add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:ui": "vitest --ui"
```

**Step 7: Run tests**

```bash
npm test
```

Expected: 1 test passing

**Step 8: Commit**

```bash
git add .
git commit -m "chore: configure Vitest for unit and integration testing"
```

---

### Task 0.4: Set Up Playwright for E2E Testing

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/example.spec.ts`
- Modify: `package.json`

**Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Step 2: Create Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Step 3: Write first E2E test**

Create `e2e/example.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Next/);
  });
});
```

**Step 4: Add E2E scripts to package.json**

Add to `scripts`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug"
```

**Step 5: Run E2E tests**

```bash
npm run test:e2e
```

Expected: 1 test passing

**Step 6: Commit**

```bash
git add .
git commit -m "chore: configure Playwright for E2E testing"
```

---

### Task 0.5: Set Up Supabase Local Development

**Files:**

- Create: `supabase/config.toml` (generated)
- Create: `.env.local`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Modify: `package.json`

**Step 1: Install Supabase CLI and client**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase
```

**Step 2: Initialize Supabase**

```bash
npx supabase init
```

Expected: Creates `supabase/` directory with config

**Step 3: Start local Supabase**

```bash
npx supabase start
```

Expected: Local Supabase running with URLs printed. Note the `API URL` and `anon key`.

**Step 4: Create environment file**

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
```

**Step 5: Create Supabase client for browser**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
```

**Step 6: Create Supabase client for server**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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

**Step 7: Add Supabase scripts to package.json**

Add to `scripts`:

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:migrate": "supabase migration new",
"db:push": "supabase db push"
```

**Step 8: Add to .gitignore**

Append to `.gitignore`:

```
# Supabase
.env.local
.env*.local
```

**Step 9: Commit**

```bash
git add .
git commit -m "chore: configure Supabase local development"
```

---

### Task 0.6: Create Database Schema Migration

**Files:**

- Create: `supabase/migrations/00001_initial_schema.sql`

**Step 1: Create migration file**

```bash
npx supabase migration new initial_schema
```

**Step 2: Write schema migration**

Edit the created migration file `supabase/migrations/*_initial_schema.sql`:

```sql
-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  status text check (status in ('draft', 'submitted', 'funded')) default 'draft',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.projects enable row level security;

create policy "Users can CRUD own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- Documents table
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  content jsonb default '{}',
  content_text text default '',
  sort_order integer default 0,
  version integer default 1,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.documents enable row level security;

create policy "Users can CRUD documents in own projects"
  on public.documents for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Vault items table
create table public.vault_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  type text check (type in ('pdf', 'docx', 'url', 'text')) not null,
  filename text,
  storage_path text,
  extracted_text text,
  extraction_status text check (extraction_status in ('pending', 'success', 'partial', 'failed')) default 'pending',
  chunk_count integer default 0,
  created_at timestamptz default now() not null
);

alter table public.vault_items enable row level security;

create policy "Users can CRUD own vault items"
  on public.vault_items for all
  using (auth.uid() = user_id);

-- Vault chunks table (for semantic search)
create table public.vault_chunks (
  id uuid default gen_random_uuid() primary key,
  vault_item_id uuid references public.vault_items(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null
);

alter table public.vault_chunks enable row level security;

create policy "Users can access chunks of own vault items"
  on public.vault_chunks for all
  using (
    vault_item_id in (
      select id from public.vault_items where user_id = auth.uid()
    )
  );

-- Create index for vector similarity search
create index on public.vault_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Citations table
create table public.citations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  authors text,
  year integer,
  journal text,
  doi text,
  url text,
  abstract text,
  source text check (source in ('user_added', 'ai_fetched')) default 'user_added',
  verified boolean default false,
  created_at timestamptz default now() not null
);

alter table public.citations enable row level security;

create policy "Users can CRUD citations in own projects"
  on public.citations for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Chat history table
create table public.chat_history (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete set null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.chat_history enable row level security;

create policy "Users can CRUD chat in own projects"
  on public.chat_history for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- AI operations table (for undo/history)
create table public.ai_operations (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  operation_type text check (operation_type in ('selection', 'cursor', 'global')) not null,
  input_summary text,
  output_content text,
  status text check (status in ('pending', 'accepted', 'rejected', 'partial')) default 'pending',
  snapshot_before jsonb,
  created_at timestamptz default now() not null
);

alter table public.ai_operations enable row level security;

create policy "Users can CRUD ai_operations in own documents"
  on public.ai_operations for all
  using (
    document_id in (
      select d.id from public.documents d
      join public.projects p on d.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- Function to auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger set_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Step 3: Apply migration**

```bash
npx supabase db reset
```

Expected: Migration applied, tables created

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add initial database schema migration"
```

---

### Task 0.7: Generate TypeScript Types from Database

**Files:**

- Create: `src/lib/supabase/database.types.ts`
- Modify: `package.json`

**Step 1: Generate types**

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

**Step 2: Add type generation script to package.json**

Add to `scripts`:

```json
"db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
```

**Step 3: Update Supabase clients with types**

Update `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Update `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "chore: generate TypeScript types from database schema"
```

---

### Task 0.8: Set Up Test Database Utilities

**Files:**

- Create: `src/lib/supabase/test-utils.ts`
- Create: `src/lib/supabase/__tests__/client.test.ts`

**Step 1: Create test utilities**

Create `src/lib/supabase/test-utils.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Creates a Supabase client for testing with service role key.
 * Only use in test environment.
 */
export function createTestClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase test environment variables');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a test user and returns auth credentials
 */
export async function createTestUser(email: string, password: string) {
  const client = createTestClient();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;
  return data.user;
}

/**
 * Cleans up test user
 */
export async function deleteTestUser(userId: string) {
  const client = createTestClient();
  await client.auth.admin.deleteUser(userId);
}
```

**Step 2: Update .env.local with service role key**

Add to `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-start>
```

**Step 3: Write test for Supabase client**

Create `src/lib/supabase/__tests__/client.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Supabase client', () => {
  it('should have required environment variables', () => {
    // This test verifies env vars are set (they may not be in CI without setup)
    // In real tests, we'd mock or use test containers
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
  });
});
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "chore: add Supabase test utilities"
```

---

### Task 0.9: Set Up GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-for-build
```

**Step 2: Commit**

```bash
git add .
git commit -m "chore: add GitHub Actions CI workflow"
```

---

### Task 0.10: Create Development Scripts and Documentation

**Files:**

- Create: `scripts/dev-setup.sh`
- Create: `DEVELOPMENT.md`

**Step 1: Create dev setup script**

Create `scripts/dev-setup.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up Quill development environment..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required for Supabase local development." >&2; exit 1; }

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Start Supabase
echo "Starting Supabase local development..."
npx supabase start

# Get Supabase credentials
echo ""
echo "Supabase is running. Copy these values to .env.local:"
npx supabase status

# Generate types
echo ""
echo "Generating TypeScript types..."
npm run db:types

echo ""
echo "Setup complete! Run 'npm run dev' to start the development server."
```

**Step 2: Make script executable**

```bash
chmod +x scripts/dev-setup.sh
```

**Step 3: Create development documentation**

Create `DEVELOPMENT.md`:

````markdown
# Quill Development Guide

## Prerequisites

- Node.js 20+
- Docker (for Supabase local development)
- Claude Code CLI (for AI features)

## Quick Start

```bash
# First time setup
./scripts/dev-setup.sh

# Copy Supabase credentials to .env.local
cp .env.local.example .env.local
# Edit .env.local with values from `npx supabase status`

# Start development
npm run dev
```
````

## Available Scripts

### Development

- `npm run dev` - Start Next.js dev server
- `npm run build` - Build for production
- `npm run start` - Start production server

### Testing

- `npm test` - Run unit/integration tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Run E2E tests with UI
- `npm run test:e2e:debug` - Debug E2E tests

### Database

- `npm run db:start` - Start local Supabase
- `npm run db:stop` - Stop local Supabase
- `npm run db:reset` - Reset database (runs migrations)
- `npm run db:migrate` - Create new migration
- `npm run db:types` - Regenerate TypeScript types

### Code Quality

- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── ui/             # Base UI components
│   ├── editor/         # TipTap editor components
│   └── ...
├── lib/                 # Shared utilities
│   ├── supabase/       # Supabase clients and types
│   ├── ai/             # Claude Code CLI integration
│   └── ...
└── hooks/              # Custom React hooks

e2e/                    # Playwright E2E tests
supabase/
├── migrations/         # Database migrations
└── config.toml        # Supabase config
```

## Testing Strategy

### Unit Tests (Vitest)

- Test pure functions and utilities
- Test React components in isolation
- Located in `__tests__` folders near source

### Integration Tests (Vitest)

- Test component interactions
- Test API route handlers
- Test Supabase queries (with test database)

### E2E Tests (Playwright)

- Test complete user flows
- Test AI interactions (mocked)
- Located in `e2e/` folder

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# For testing
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For AI features (production)
OPENAI_API_KEY=your-openai-key  # For embeddings
```

````

**Step 4: Create .env.local.example**

Create `.env.local.example`:
```bash
# Supabase - get these from `npx supabase status`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI - for embeddings
OPENAI_API_KEY=your-openai-key
````

**Step 5: Commit**

```bash
git add .
git commit -m "docs: add development setup scripts and documentation"
```

---

## Phase 0 Complete

At this point you have:

- Next.js 14 with TypeScript and Tailwind
- ESLint + Prettier configured
- Vitest for unit/integration tests
- Playwright for E2E tests
- Supabase local development with full schema
- TypeScript types generated from database
- GitHub Actions CI pipeline
- Development documentation

**Verification checklist:**

- [ ] `npm run dev` starts without errors
- [ ] `npm test` passes all tests
- [ ] `npm run test:e2e` passes all tests
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run build` succeeds
- [ ] `npx supabase status` shows running services

---

## Phase 1: Core Editor & Document Management

This phase builds the TipTap editor, authentication, and basic project/document CRUD.

---

### Task 1.1: Set Up TipTap Editor Package

**Files:**

- Modify: `package.json`
- Create: `src/components/editor/Editor.tsx`
- Create: `src/components/editor/__tests__/Editor.test.tsx`

**Step 1: Install TipTap dependencies**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count
```

**Step 2: Write failing test for Editor component**

Create `src/components/editor/__tests__/Editor.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from '../Editor';

describe('Editor', () => {
  it('should render the editor', () => {
    render(<Editor />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should display placeholder when empty', () => {
    render(<Editor placeholder="Start writing..." />);
    expect(screen.getByText('Start writing...')).toBeInTheDocument();
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test src/components/editor/__tests__/Editor.test.tsx
```

Expected: FAIL - module not found

**Step 4: Implement Editor component**

Create `src/components/editor/Editor.tsx`:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';

interface EditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  editable?: boolean;
}

export function Editor({
  content = '',
  placeholder = 'Start writing...',
  onChange,
  editable = true,
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[200px] p-4',
        role: 'textbox',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-white">
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Step 5: Run tests**

```bash
npm test src/components/editor/__tests__/Editor.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add TipTap editor component"
```

---

### Task 1.2: Add Editor Toolbar

**Files:**

- Create: `src/components/editor/Toolbar.tsx`
- Create: `src/components/editor/__tests__/Toolbar.test.tsx`
- Modify: `src/components/editor/Editor.tsx`

**Step 1: Install lucide-react for icons**

```bash
npm install lucide-react
```

**Step 2: Implement Toolbar component**

Create `src/components/editor/Toolbar.tsx`:

```typescript
'use client';

import { Editor } from '@tiptap/react';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered } from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const buttons = [
    { icon: Bold, label: 'Bold', action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive('bold') },
    { icon: Italic, label: 'Italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive('italic') },
    { icon: Heading1, label: 'Heading', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor.isActive('heading', { level: 1 }) },
    { icon: Heading2, label: 'Subheading', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }) },
    { icon: List, label: 'Bullet List', action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
    { icon: ListOrdered, label: 'Numbered List', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
  ];

  return (
    <div className="flex items-center gap-1 p-2 border-b">
      {buttons.map(({ icon: Icon, label, action, isActive }) => (
        <button key={label} type="button" onClick={action} aria-label={label}
          className={`p-2 rounded hover:bg-gray-100 ${isActive ? 'bg-gray-200' : ''}`}>
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Update Editor to include Toolbar**

Modify `src/components/editor/Editor.tsx` to import and render `<Toolbar editor={editor} />` above `<EditorContent />`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add editor toolbar with formatting buttons"
```

---

### Task 1.3: Set Up Supabase Auth with Magic Link

**Files:**

- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/middleware.ts`

**Step 1: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

**Step 2: Create LoginForm component**

Create `src/components/auth/LoginForm.tsx` with email input, magic link submission via `supabase.auth.signInWithOtp()`.

**Step 3: Create login page**

Create `src/app/login/page.tsx` rendering the LoginForm.

**Step 4: Create middleware for auth protection**

Create `src/middleware.ts` to protect `/projects/*` and `/editor/*` routes.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add Supabase auth with magic link"
```

---

### Task 1.4: Create Projects CRUD

**Files:**

- Create: `src/lib/api/projects.ts`
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/new/page.tsx`
- Create: `src/app/api/projects/route.ts`
- Create: `src/components/projects/ProjectList.tsx`
- Create: `src/components/projects/NewProjectForm.tsx`

**Step 1: Create projects API helpers**

Create `src/lib/api/projects.ts` with `getProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`.

**Step 2: Create ProjectList component**

**Step 3: Create projects page**

**Step 4: Create new project form and page**

**Step 5: Create API route**

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add projects CRUD"
```

---

### Task 1.5: Create Documents CRUD

**Files:**

- Create: `src/lib/api/documents.ts`
- Create: `src/app/projects/[id]/page.tsx`
- Create: `src/app/projects/[id]/documents/[docId]/page.tsx`
- Create: `src/app/api/documents/[id]/route.ts`
- Create: `src/components/documents/DocumentList.tsx`

**Step 1: Create documents API helpers**

Create `src/lib/api/documents.ts` with `getDocuments`, `getDocument`, `createDocument`, `updateDocument`, `deleteDocument`.

**Step 2: Create project detail page with document list**

**Step 3: Create document editor page**

**Step 4: Create document API routes**

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add documents CRUD"
```

---

### Task 1.6: Add Document Autosave

**Files:**

- Create: `src/components/editor/DocumentEditor.tsx`
- Modify: document page to use DocumentEditor

**Step 1: Create DocumentEditor with debounced autosave**

Implement 1-second debounce, save status indicator.

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add document autosave"
```

---

### Task 1.7: Add Word/Character Count

**Files:**

- Create: `src/components/editor/WordCount.tsx`
- Modify: `src/components/editor/Editor.tsx`

**Step 1: Create WordCount component**

Display words, characters, optional limit with warning.

**Step 2: Integrate into Editor**

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add word and character count"
```

---

## Phase 1 Complete

At this point you have:

- TipTap editor with toolbar
- Word/character count
- Supabase auth with magic link
- Projects CRUD
- Documents CRUD with autosave

---

## Phase 2: Knowledge Vault

File upload, text extraction, chunking, and embedding for semantic search.

---

### Task 2.1: Create Vault Upload UI

**Files:**

- Create: `src/app/projects/[id]/vault/page.tsx`
- Create: `src/components/vault/VaultUpload.tsx`
- Create: `src/components/vault/VaultItemList.tsx`

**Step 1: Create VaultUpload component**

Create `src/components/vault/VaultUpload.tsx`:

```typescript
'use client';

import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
}

export function VaultUpload({ projectId, onUpload }: VaultUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    formData.append('projectId', projectId);

    await fetch('/api/vault/upload', { method: 'POST', body: formData });
    setUploading(false);
    onUpload();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p>Drag files here or <button onClick={() => inputRef.current?.click()} className="text-blue-600 underline">browse</button></p>
      <p className="text-sm text-gray-500 mt-1">PDF, DOCX, or TXT</p>
      <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      {uploading && <p className="mt-2 text-blue-600">Uploading...</p>}
    </div>
  );
}
```

**Step 2: Create VaultItemList component**

Create `src/components/vault/VaultItemList.tsx` to display uploaded items with extraction status.

**Step 3: Create vault page**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add vault upload UI"
```

---

### Task 2.2: Create File Upload API

**Files:**

- Create: `src/app/api/vault/upload/route.ts`
- Create: `src/lib/api/vault.ts`

**Step 1: Create vault API helpers**

Create `src/lib/api/vault.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type VaultItem = Database['public']['Tables']['vault_items']['Row'];

export async function createVaultItem(item: {
  projectId: string | null;
  type: 'pdf' | 'docx' | 'url' | 'text';
  filename: string;
  storagePath: string;
}): Promise<VaultItem> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('vault_items')
    .insert({
      user_id: user.id,
      project_id: item.projectId,
      type: item.type,
      filename: item.filename,
      storage_path: item.storagePath,
      extraction_status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getVaultItems(projectId: string): Promise<VaultItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

**Step 2: Create upload route**

Create `src/app/api/vault/upload/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { createVaultItem } from '@/lib/api/vault';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  const projectId = formData.get('projectId') as string;

  const supabase = await createClient();
  const results = [];

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'text';
    const path = `vault/${projectId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from('vault-files').upload(path, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      continue;
    }

    const item = await createVaultItem({
      projectId,
      type,
      filename: file.name,
      storagePath: path,
    });
    results.push(item);
  }

  // Trigger background extraction
  for (const item of results) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vault/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id }),
    });
  }

  return NextResponse.json(results);
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add vault file upload API"
```

---

### Task 2.3: Implement Text Extraction

**Files:**

- Create: `src/app/api/vault/extract/route.ts`
- Create: `src/lib/extraction/pdf.ts`
- Create: `src/lib/extraction/docx.ts`

**Step 1: Install extraction libraries**

```bash
npm install pdf-parse mammoth
npm install -D @types/pdf-parse
```

**Step 2: Create PDF extractor**

Create `src/lib/extraction/pdf.ts`:

```typescript
import pdf from 'pdf-parse';

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
```

**Step 3: Create DOCX extractor**

Create `src/lib/extraction/docx.ts`:

```typescript
import mammoth from 'mammoth';

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
```

**Step 4: Create extraction API route**

Create `src/app/api/vault/extract/route.ts` that downloads file from storage, extracts text based on type, updates vault_item with extracted_text and status.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add text extraction for PDF and DOCX"
```

---

### Task 2.4: Implement Chunking and Embedding

**Files:**

- Create: `src/lib/extraction/chunker.ts`
- Create: `src/lib/extraction/embeddings.ts`
- Modify: extraction route to chunk and embed

**Step 1: Install OpenAI SDK**

```bash
npm install openai
```

**Step 2: Create chunker**

Create `src/lib/extraction/chunker.ts`:

```typescript
export interface Chunk {
  content: string;
  index: number;
}

export function chunkText(text: string, maxChunkSize = 1000, overlap = 100): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    let chunkEnd = end;

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      if (lastPeriod > start + maxChunkSize / 2) {
        chunkEnd = lastPeriod + 1;
      }
    }

    chunks.push({ content: text.slice(start, chunkEnd).trim(), index });
    start = chunkEnd - overlap;
    index++;
  }

  return chunks;
}
```

**Step 3: Create embeddings helper**

Create `src/lib/extraction/embeddings.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}
```

**Step 4: Update extraction route to chunk and embed**

After extracting text, chunk it and store embeddings in vault_chunks table.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add text chunking and embedding"
```

---

### Task 2.5: Implement Semantic Search

**Files:**

- Create: `src/lib/api/search.ts`
- Create: `src/app/api/vault/search/route.ts`

**Step 1: Create semantic search function**

Create `src/lib/api/search.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/extraction/embeddings';

export interface SearchResult {
  content: string;
  similarity: number;
  vaultItemId: string;
  filename: string;
}

export async function searchVault(
  projectId: string,
  query: string,
  limit = 5,
  threshold = 0.7
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const queryEmbedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('search_vault_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    p_project_id: projectId,
  });

  if (error) throw error;
  return data;
}
```

**Step 2: Create database function for vector search**

Create migration `supabase/migrations/*_search_function.sql`:

```sql
create or replace function search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
returns table (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text
)
language sql stable
as $$
  select
    vc.content,
    1 - (vc.embedding <=> query_embedding) as similarity,
    vc.vault_item_id,
    vi.filename
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and 1 - (vc.embedding <=> query_embedding) > match_threshold
  order by vc.embedding <=> query_embedding
  limit match_count;
$$;
```

**Step 3: Create search API route**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add semantic search for vault"
```

---

## Phase 2 Complete

At this point you have:

- Vault file upload
- PDF/DOCX text extraction
- Text chunking
- OpenAI embeddings
- Semantic search via pgvector

---

## Phase 3: AI Integration (Claude Code CLI)

Claude Code CLI subprocess integration for AI operations.

---

### Task 3.1: Create Claude Code CLI Wrapper

**Files:**

- Create: `src/lib/ai/claude-cli.ts`
- Create: `src/lib/ai/__tests__/claude-cli.test.ts`

**Step 1: Write failing test**

Create `src/lib/ai/__tests__/claude-cli.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { invokeClaude, ClaudeResponse } from '../claude-cli';

// Mock child_process
vi.mock('child_process');

describe('Claude CLI', () => {
  it('should handle successful response', async () => {
    // Test implementation
  });

  it('should handle timeout', async () => {
    // Test implementation
  });
});
```

**Step 2: Implement CLI wrapper**

Create `src/lib/ai/claude-cli.ts`:

```typescript
import { spawn } from 'child_process';

export interface ClaudeRequest {
  prompt: string;
  context?: string;
  timeout?: number;
}

export interface ClaudeResponse {
  content: string;
  error?: string;
}

export async function invokeClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const { prompt, context, timeout = 120000 } = request;

  return new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'stream-json'];
    if (context) {
      args.push('--context', context);
    }

    const proc = spawn('claude', args, {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 || error) {
        resolve({ content: '', error: error || `Exit code ${code}` });
      } else {
        // Parse streamed JSON output
        const lines = output.trim().split('\n');
        const content = lines
          .map((line) => {
            try {
              const parsed = JSON.parse(line);
              return parsed.content || '';
            } catch {
              return '';
            }
          })
          .join('');
        resolve({ content });
      }
    });

    proc.on('error', (err) => {
      resolve({ content: '', error: err.message });
    });
  });
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add Claude Code CLI wrapper"
```

---

### Task 3.2: Create Streaming Claude Endpoint

**Files:**

- Create: `src/app/api/ai/generate/route.ts`
- Create: `src/lib/ai/streaming.ts`

**Step 1: Create streaming helper**

Create `src/lib/ai/streaming.ts`:

```typescript
import { spawn } from 'child_process';

export function streamClaude(
  prompt: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  timeout = 120000
) {
  const proc = spawn('claude', ['-p', prompt, '--output-format', 'stream-json'], {
    timeout,
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.content) onChunk(parsed.content);
      } catch {}
    }
  });

  proc.on('close', (code) => {
    if (code === 0) onComplete();
    else onError(`Exit code ${code}`);
  });

  proc.on('error', (err) => onError(err.message));

  return () => proc.kill();
}
```

**Step 2: Create streaming API route**

Create `src/app/api/ai/generate/route.ts` using `ReadableStream` for Server-Sent Events.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add streaming Claude endpoint"
```

---

### Task 3.3: Create Context Builder

**Files:**

- Create: `src/lib/ai/context-builder.ts`

**Step 1: Implement context builder**

Create `src/lib/ai/context-builder.ts`:

```typescript
import { searchVault } from '@/lib/api/search';
import { getDocument } from '@/lib/api/documents';

export interface AIContext {
  documentContent: string;
  vaultContext: string[];
  recentChat: string[];
}

export async function buildContext(documentId: string, projectId: string, query: string): Promise<AIContext> {
  // Get current document
  const doc = await getDocument(documentId);
  const documentContent = doc?.content_text || '';

  // Get relevant vault chunks
  const vaultResults = await searchVault(projectId, query, 5, 0.7);
  const vaultContext = vaultResults.map((r) => `[From ${r.filename}]: ${r.content}`);

  return {
    documentContent,
    vaultContext,
    recentChat: [], // TODO: implement chat history
  };
}

export function formatContextForPrompt(context: AIContext): string {
  let prompt = '';

  if (context.documentContent) {
    prompt += `## Current Document\n${context.documentContent}\n\n`;
  }

  if (context.vaultContext.length > 0) {
    prompt += `## Reference Materials\n${context.vaultContext.join('\n\n')}\n\n`;
  }

  return prompt;
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add AI context builder"
```

---

### Task 3.4: Implement Selection Actions

**Files:**

- Create: `src/components/editor/SelectionToolbar.tsx`
- Create: `src/app/api/ai/selection/route.ts`

**Step 1: Create SelectionToolbar component**

Create floating toolbar that appears on text selection with Refine/Extend/Shorten/Simplify buttons.

**Step 2: Create selection AI endpoint**

Handle selection-scoped AI operations.

**Step 3: Integrate with editor**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add selection AI actions"
```

---

### Task 3.5: Implement Cursor Generation (Cmd+K)

**Files:**

- Create: `src/components/editor/CursorPrompt.tsx`
- Create: `src/components/editor/PreviewPanel.tsx`

**Step 1: Create CursorPrompt modal**

Triggered by Cmd+K, allows user to describe what to generate.

**Step 2: Create PreviewPanel**

Shows generated content with Accept/Edit/Regenerate options.

**Step 3: Integrate with editor**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add cursor generation with Cmd+K"
```

---

## Phase 3 Complete

At this point you have:

- Claude Code CLI integration
- Streaming responses
- Context building from vault
- Selection actions (refine, extend, etc.)
- Cursor generation with preview

---

## Phase 4: Chat & Global Edits

Document chat sidebar and global edit commands.

---

### Task 4.1: Create Chat Sidebar

**Files:**

- Create: `src/components/chat/ChatSidebar.tsx`
- Create: `src/components/chat/ChatMessage.tsx`
- Create: `src/components/chat/ChatInput.tsx`
- Create: `src/lib/api/chat.ts`

**Step 1: Create chat API helpers**

CRUD operations for chat_history table.

**Step 2: Create ChatMessage component**

Display user/assistant messages with different styling.

**Step 3: Create ChatInput component**

Text input with send button.

**Step 4: Create ChatSidebar**

Collapsible sidebar with message list and input.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add chat sidebar"
```

---

### Task 4.2: Implement Chat Mode Detection

**Files:**

- Create: `src/lib/ai/intent-detection.ts`
- Modify: chat API to detect mode

**Step 1: Create intent detector**

Create `src/lib/ai/intent-detection.ts`:

```typescript
export type ChatMode = 'discussion' | 'global_edit' | 'research';

export function detectChatMode(message: string): ChatMode {
  const editPatterns = [
    /\b(change|modify|update|remove|delete|add|insert|replace|shorten|expand)\b/i,
    /\bthroughout\b/i,
    /\beverywhere\b/i,
    /\ball\s+(sections?|paragraphs?)\b/i,
  ];

  const researchPatterns = [
    /\b(find|search|look up|what is|cite|citation|paper|study|research)\b/i,
    /\brecent (papers?|studies?|research)\b/i,
  ];

  if (editPatterns.some((p) => p.test(message))) {
    return 'global_edit';
  }
  if (researchPatterns.some((p) => p.test(message))) {
    return 'research';
  }
  return 'discussion';
}
```

**Step 2: Add mode indicator to chat UI**

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add chat mode detection"
```

---

### Task 4.3: Implement Global Edit with Diff View

**Files:**

- Create: `src/components/editor/DiffPanel.tsx`
- Create: `src/lib/ai/diff-generator.ts`
- Create: `src/app/api/ai/global-edit/route.ts`

**Step 1: Install diff library**

```bash
npm install diff
npm install -D @types/diff
```

**Step 2: Create diff generator**

Create `src/lib/ai/diff-generator.ts`:

```typescript
import { diffLines } from 'diff';

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  value: string;
  lineNumber: number;
}

export function generateDiff(original: string, modified: string): DiffChange[] {
  const changes = diffLines(original, modified);
  const result: DiffChange[] = [];
  let lineNumber = 1;

  for (const change of changes) {
    result.push({
      type: change.added ? 'add' : change.removed ? 'remove' : 'unchanged',
      value: change.value,
      lineNumber,
    });
    if (!change.removed) {
      lineNumber += change.value.split('\n').length - 1;
    }
  }

  return result;
}
```

**Step 3: Create DiffPanel component**

Display diff with accept/reject buttons per change.

**Step 4: Create global edit API route**

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add global edit with diff view"
```

---

### Task 4.4: Add AI Operations History (Undo)

**Files:**

- Create: `src/lib/api/ai-operations.ts`
- Modify: AI endpoints to create snapshots

**Step 1: Create ai-operations API helpers**

**Step 2: Update AI endpoints to snapshot before edit**

**Step 3: Add undo UI**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add AI operation history for undo"
```

---

## Phase 4 Complete

At this point you have:

- Chat sidebar with message history
- Chat mode detection
- Global edit with diff view
- AI operation snapshots for undo

---

## Phase 5: Citations & Research

Semantic Scholar integration and citation management.

---

### Task 5.1: Create Semantic Scholar Client

**Files:**

- Create: `src/lib/citations/semantic-scholar.ts`
- Create: `src/lib/citations/__tests__/semantic-scholar.test.ts`

**Step 1: Implement Semantic Scholar client**

Create `src/lib/citations/semantic-scholar.ts`:

```typescript
const API_BASE = 'https://api.semanticscholar.org/graph/v1';

export interface Paper {
  paperId: string;
  title: string;
  authors: { name: string }[];
  year: number;
  journal?: { name: string };
  externalIds?: { DOI?: string };
  abstract?: string;
  url: string;
}

export async function searchPapers(query: string, limit = 10): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: 'paperId,title,authors,year,journal,externalIds,abstract,url',
  });

  const response = await fetch(`${API_BASE}/paper/search?${params}`);
  if (!response.ok) throw new Error('Semantic Scholar API error');

  const data = await response.json();
  return data.data || [];
}

export async function getPaper(paperId: string): Promise<Paper | null> {
  const params = new URLSearchParams({
    fields: 'paperId,title,authors,year,journal,externalIds,abstract,url',
  });

  const response = await fetch(`${API_BASE}/paper/${paperId}?${params}`);
  if (!response.ok) return null;

  return response.json();
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add Semantic Scholar client"
```

---

### Task 5.2: Create Citation Search UI

**Files:**

- Create: `src/components/citations/CitationSearch.tsx`
- Create: `src/components/citations/CitationCard.tsx`
- Create: `src/app/api/citations/search/route.ts`

**Step 1: Create CitationCard component**

Display paper with title, authors, year, DOI link, add button.

**Step 2: Create CitationSearch component**

Search input with results list.

**Step 3: Integrate with chat sidebar**

When research mode detected, show citation search.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add citation search UI"
```

---

### Task 5.3: Create Citation Manager

**Files:**

- Create: `src/lib/api/citations.ts`
- Create: `src/components/citations/CitationList.tsx`
- Create: `src/app/projects/[id]/citations/page.tsx`

**Step 1: Create citations API helpers**

CRUD operations for citations table.

**Step 2: Create CitationList component**

**Step 3: Create citations page**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add citation manager"
```

---

### Task 5.4: Integrate Citations into Editor

**Files:**

- Create: `src/components/editor/CitationInserter.tsx`
- Modify: Editor to support citation insertion

**Step 1: Create citation insertion UI**

Allow inserting citations into document with proper formatting.

**Step 2: Commit**

```bash
git add .
git commit -m "feat: integrate citations into editor"
```

---

## Phase 5 Complete

At this point you have:

- Semantic Scholar integration
- Citation search with verified DOIs
- Citation management
- Citation insertion in editor

---

## Phase 6: Export & Polish

Document export and final UI polish.

---

### Task 6.1: Implement DOCX Export

**Files:**

- Create: `src/lib/export/docx.ts`
- Create: `src/app/api/export/docx/route.ts`

**Step 1: Install docx library**

```bash
npm install docx file-saver
npm install -D @types/file-saver
```

**Step 2: Create DOCX exporter**

Create `src/lib/export/docx.ts`:

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export async function exportToDocx(content: string, title: string): Promise<Buffer> {
  // Parse HTML content and convert to docx paragraphs
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true })],
            heading: HeadingLevel.TITLE,
          }),
          // Convert HTML to paragraphs...
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
```

**Step 3: Create export route**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add DOCX export"
```

---

### Task 6.2: Implement PDF Export

**Files:**

- Create: `src/lib/export/pdf.ts`
- Create: `src/app/api/export/pdf/route.ts`

**Step 1: Create PDF exporter (via HTML to PDF)**

Use puppeteer or similar for server-side PDF generation.

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add PDF export"
```

---

### Task 6.3: Add App Shell and Navigation

**Files:**

- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Modify: layout.tsx

**Step 1: Create responsive app shell**

Header with logo, user menu. Sidebar with navigation.

**Step 2: Apply to all pages**

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add app shell and navigation"
```

---

### Task 6.4: Add Loading States and Error Handling

**Files:**

- Create: `src/components/ui/Loading.tsx`
- Create: `src/components/ui/ErrorBoundary.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/loading.tsx`

**Step 1: Create loading components**

**Step 2: Create error boundary**

**Step 3: Add to pages**

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add loading states and error handling"
```

---

### Task 6.5: Final E2E Tests

**Files:**

- Create: `e2e/full-flow.spec.ts`
- Create: `e2e/ai-features.spec.ts`

**Step 1: Write comprehensive E2E tests**

Test complete user flows: signup, create project, create document, edit with AI, export.

**Step 2: Run all tests**

```bash
npm run test:e2e
```

**Step 3: Commit**

```bash
git add .
git commit -m "test: add comprehensive E2E tests"
```

---

## Phase 6 Complete

At this point you have:

- DOCX and PDF export
- App shell with navigation
- Loading states and error handling
- Comprehensive E2E tests

---

## MVP Complete

**Final verification checklist:**

- [ ] Can sign in via magic link
- [ ] Can create projects and documents
- [ ] Editor has formatting toolbar
- [ ] Word count displays
- [ ] Autosave works
- [ ] Can upload files to vault
- [ ] Can search vault semantically
- [ ] Selection actions work (refine, extend, etc.)
- [ ] Cmd+K cursor generation works
- [ ] Chat sidebar with mode detection
- [ ] Global edits with diff view
- [ ] AI undo via snapshots
- [ ] Citation search returns verified DOIs
- [ ] Can export to DOCX/PDF
- [ ] All tests pass

**Ready for production deployment.**

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-01-13-quill-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
