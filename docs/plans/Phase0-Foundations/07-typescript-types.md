# Task 0.7: Generate TypeScript Types from Database

> **Phase 0** | [<- Database Schema](./06-database-schema.md) | [Next: Test Utilities ->](./08-test-utilities.md)

---

## Context

**This task generates TypeScript types from the database schema.** This ensures type safety when working with Supabase queries and provides autocomplete in your editor.

### Prerequisites

- **Task 0.6** completed (Database schema applied)

### What This Task Creates

- Auto-generated database types
- Type helper exports for common use cases
- Barrel export for clean imports
- Typed Supabase clients

### Tasks That Depend on This

- **Task 0.8** (Test Utilities) - uses these types for test factories

---

## Files to Create/Modify

- `src/lib/supabase/database.types.ts` (create - auto-generated)
- `src/lib/supabase/types.ts` (create)
- `src/lib/supabase/index.ts` (create - barrel export)
- `src/lib/supabase/client.ts` (modify - add types)
- `src/lib/supabase/server.ts` (modify - add types)
- `package.json` (modify)

---

## Steps

### Step 1: Ensure Supabase is running

```bash
pnpm exec supabase status
```

If not running: `pnpm exec supabase start`

### Step 2: Generate types

```bash
pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

### Step 3: Verify types were generated correctly

```bash
# Should show Database interface with Tables including profiles, projects, etc.
head -100 src/lib/supabase/database.types.ts
```

**Expected:** File should contain `export type Database = {` with `public: { Tables: { ... } }`

### Step 4: Create type helpers

Create `src/lib/supabase/types.ts`:

```typescript
import type { Database } from './database.types';

// ============================================
// TABLE ROW TYPES
// Use these when reading data from the database
// ============================================

/** User profile linked to auth.users */
export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Grant proposal project */
export type Project = Database['public']['Tables']['projects']['Row'];

/** Document section within a project */
export type Document = Database['public']['Tables']['documents']['Row'];

/** Uploaded reference file (PDF, DOCX, URL, text) */
export type VaultItem = Database['public']['Tables']['vault_items']['Row'];

/** Chunked text with embedding for semantic search */
export type VaultChunk = Database['public']['Tables']['vault_chunks']['Row'];

/** Bibliography/reference citation */
export type Citation = Database['public']['Tables']['citations']['Row'];

/** AI conversation message */
export type ChatMessage = Database['public']['Tables']['chat_history']['Row'];

/** Security audit trail entry */
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

/** AI edit operation for undo/history */
export type AIOperation = Database['public']['Tables']['ai_operations']['Row'];

// ============================================
// INSERT TYPES
// Use these when creating new records
// ============================================

/** Data required to create a new project */
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

/** Data required to create a new document */
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

/** Data required to create a new vault item */
export type VaultItemInsert = Database['public']['Tables']['vault_items']['Insert'];

/** Data required to create a new vault chunk */
export type VaultChunkInsert = Database['public']['Tables']['vault_chunks']['Insert'];

/** Data required to create a new citation */
export type CitationInsert = Database['public']['Tables']['citations']['Insert'];

/** Data required to create a new chat message */
export type ChatMessageInsert = Database['public']['Tables']['chat_history']['Insert'];

/** Data required to create an AI operation record */
export type AIOperationInsert = Database['public']['Tables']['ai_operations']['Insert'];

/** Data required to create an audit log entry */
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

// ============================================
// UPDATE TYPES
// Use these when updating existing records
// ============================================

/** Fields that can be updated on a project */
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

/** Fields that can be updated on a document */
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

/** Fields that can be updated on a profile */
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/** Fields that can be updated on a vault item */
export type VaultItemUpdate = Database['public']['Tables']['vault_items']['Update'];

/** Fields that can be updated on a citation */
export type CitationUpdate = Database['public']['Tables']['citations']['Update'];

/** Fields that can be updated on an AI operation */
export type AIOperationUpdate = Database['public']['Tables']['ai_operations']['Update'];

// ============================================
// STATUS ENUMS (as string literal unions)
// Use these for type-safe status handling
// ============================================

/** Project status values */
export type ProjectStatus = 'draft' | 'submitted' | 'funded';

/** Vault item extraction status values */
export type ExtractionStatus = 'pending' | 'success' | 'partial' | 'failed';

/** AI operation status values */
export type AIOperationStatus = 'pending' | 'accepted' | 'rejected' | 'partial';

/** AI operation type values */
export type AIOperationType = 'selection' | 'cursor' | 'global';

/** Chat message role values */
export type ChatRole = 'user' | 'assistant';

/** Citation source values */
export type CitationSource = 'user_added' | 'ai_fetched';

// ============================================
// TIPTAP/PROSEMIRROR CONTENT TYPES
// Use these for typed document content
// ============================================

/** Base TipTap node structure */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** TipTap document structure */
export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

/** Document with typed TipTap content */
export interface TypedDocument extends Omit<Document, 'content'> {
  content: TipTapDocument;
}

// ============================================
// RPC RETURN TYPES
// Use these for typed RPC call results
// ============================================

/** Return type for search_vault_chunks RPC function */
export interface VaultSearchResult {
  content: string;
  similarity: number;
  vault_item_id: string;
  filename: string | null;
}
```

### Step 5: Create barrel export for cleaner imports

Create `src/lib/supabase/index.ts`:

```typescript
export { createClient } from './client';
export { createClient as createServerClient } from './server';
export * from './types';
export type { Database } from './database.types';
```

### Step 6: Update Supabase clients with types

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

### Step 7: Add type generation script to package.json

Add to `scripts`:

```json
"db:types": "pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts"
```

### Step 8: Commit

```bash
git add .
git commit -m "chore: generate TypeScript types from database schema"
```

---

## Usage Examples

After this task, you can import types cleanly:

```typescript
// Import types
import type { Project, Document, ProjectInsert } from '@/lib/supabase';

// Import client
import { createClient } from '@/lib/supabase';

// Use typed queries - client is already typed with <Database>
const client = createClient();
const { data } = await client.from('projects').select('*').eq('user_id', userId);
// data is typed as Project[] | null

// For single record queries, use .single() for cleaner types
const { data: project } = await client.from('projects').select('*').eq('id', projectId).single();
// project is typed as Project | null

// Insert with typed data
const newProject: ProjectInsert = {
  user_id: userId,
  title: 'My Grant Proposal',
  status: 'draft',
};
const { data: created } = await client.from('projects').insert(newProject).select().single();
// created is typed as Project | null
```

### Inline Type Assertions

For third-party API responses or complex queries, use type assertions:

```typescript
// Type assertion for API responses
interface ExternalApiResponse {
  items: { id: string; name: string }[];
  total: number;
}

const response = await fetch('/api/external');
const data = (await response.json()) as ExternalApiResponse;

// Type assertion for RPC calls
const { data: results } = await client.rpc('search_vault_chunks', {
  query_embedding: embedding,
  match_threshold: 0.8,
  match_count: 10,
  p_project_id: projectId,
});
// results is typed based on the RPC return type
```

---

## Verification Checklist

- [ ] `src/lib/supabase/database.types.ts` generated with Database interface
- [ ] `src/lib/supabase/types.ts` created with helper types
- [ ] `src/lib/supabase/index.ts` created with barrel exports
- [ ] `src/lib/supabase/client.ts` updated with `<Database>` generic
- [ ] `src/lib/supabase/server.ts` updated with `<Database>` generic
- [ ] `pnpm db:types` script added to package.json
- [ ] No TypeScript errors: `pnpm exec tsc --noEmit`
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 0.8: Set Up Test Utilities](./08-test-utilities.md)**.
