# Task 0.8: Set Up Test Database Utilities

> **Phase 0** | [<- TypeScript Types](./07-typescript-types.md) | [Next: GitHub Actions CI ->](./09-github-actions.md)

---

## Context

**This task creates test utilities for database operations and test data factories.** These utilities enable clean test isolation and consistent test data creation.

### Prerequisites

- **Task 0.3** completed (Vitest configured)
- **Task 0.7** completed (TypeScript types generated)

### What This Task Creates

- Service role test client (bypasses RLS for test setup)
- Test user creation/deletion utilities
- Factory functions for test data
- First Supabase client tests

### Tasks That Depend on This

- **Task 0.9** (GitHub Actions CI) - runs these tests

---

## Files to Create

- `src/lib/supabase/test-utils.ts`
- `src/test-utils/factories.ts`
- `src/lib/supabase/__tests__/client.test.ts`

---

## Steps

### Step 1: Create test utilities

Create `src/lib/supabase/test-utils.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * WARNING: Service role key bypasses RLS
 * Only use in test environment with test data
 */
export function createTestClient() {
  // Safety check: only allow in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'createTestClient should only be used in test environment. ' + `Current NODE_ENV: ${process.env.NODE_ENV}`
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a test user and returns the user object
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
 * Deletes a test user by ID
 */
export async function deleteTestUser(userId: string) {
  const client = createTestClient();
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/**
 * Cleans up all test data for a user
 */
export async function cleanupTestData(userId: string) {
  const client = createTestClient();

  // Delete in order respecting foreign keys
  // Projects cascade to documents, vault_items, etc.
  await client.from('audit_logs').delete().eq('user_id', userId);
  await client.from('projects').delete().eq('user_id', userId);
  await client.from('profiles').delete().eq('id', userId);
}

/**
 * Creates an audit log entry (for testing audit functionality)
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resource: { type: string; id?: string },
  changes?: Record<string, unknown>
) {
  const client = createTestClient();

  const { error } = await client.from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resource.type,
    resource_id: resource.id,
    changes,
  });

  if (error) throw error;
}
```

### Step 2: Create TestData class with auto-cleanup

The `TestData` class tracks created records and cleans them up automatically in reverse order to respect foreign key constraints.

Update `src/lib/supabase/test-utils.ts` to add:

```typescript
/**
 * TestData class with auto-cleanup for test isolation.
 * Tracks created records and deletes them in reverse order.
 */
export class TestData {
  private createdRecords: { table: string; id: string }[] = [];
  private client = createTestClient();

  /**
   * Create a project and track it for cleanup.
   */
  async createProject(userId: string, data: Partial<ProjectInsert> = {}) {
    const { data: project, error } = await this.client
      .from('projects')
      .insert({
        user_id: userId,
        title: `Test Project ${Date.now()}`,
        status: 'draft',
        ...data,
      })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'projects', id: project.id });
    return project;
  }

  /**
   * Create a document and track it for cleanup.
   */
  async createDocument(projectId: string, data: Partial<DocumentInsert> = {}) {
    const { data: document, error } = await this.client
      .from('documents')
      .insert({
        project_id: projectId,
        title: `Test Document ${Date.now()}`,
        content: {},
        content_text: '',
        sort_order: 0,
        version: 1,
        ...data,
      })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'documents', id: document.id });
    return document;
  }

  /**
   * Track an externally created record for cleanup.
   */
  track(table: string, id: string) {
    this.createdRecords.push({ table, id });
  }

  /**
   * Clean up all tracked records in reverse order.
   * Call this in afterEach or afterAll.
   */
  async cleanup() {
    // NOTE: Using spread to avoid mutating the original array
    const toDelete = [...this.createdRecords].reverse();
    for (const { table, id } of toDelete) {
      try {
        await this.client.from(table).delete().eq('id', id);
      } catch (error) {
        console.warn(`Failed to cleanup ${table}:${id}`, error);
      }
    }
    this.createdRecords = [];
  }

  /**
   * Get count of tracked records.
   */
  get count() {
    return this.createdRecords.length;
  }
}
```

**Usage example:**

```typescript
describe('My feature', () => {
  const testData = new TestData();

  afterAll(async () => {
    await testData.cleanup();
  });

  it('should create a project', async () => {
    const project = await testData.createProject(userId);
    // Test code here - project will be cleaned up automatically
  });
});
```

### Step 3: Create factory functions for test data

Create `src/test-utils/factories.ts`:

```typescript
import type {
  ProjectInsert,
  DocumentInsert,
  VaultItemInsert,
  VaultChunkInsert,
  CitationInsert,
  ChatMessageInsert,
  AIOperationInsert,
  AuditLogInsert,
} from '@/lib/supabase/types';

// Counter for generating unique test data
let counter = 0;

/**
 * Reset counter between test suites if needed
 */
export function resetFactoryCounter() {
  counter = 0;
}

/**
 * Create test project data
 */
export function createTestProject(userId: string, overrides: Partial<ProjectInsert> = {}): ProjectInsert {
  counter++;
  return {
    user_id: userId,
    title: `Test Project ${counter}`,
    status: 'draft',
    ...overrides,
  };
}

/**
 * Create test document data
 */
export function createTestDocument(projectId: string, overrides: Partial<DocumentInsert> = {}): DocumentInsert {
  counter++;
  return {
    project_id: projectId,
    title: `Test Document ${counter}`,
    content: { type: 'doc', content: [] },
    content_text: '',
    sort_order: counter,
    version: 1,
    ...overrides,
  };
}

/**
 * Create test vault item data
 */
export function createTestVaultItem(
  userId: string,
  projectId: string,
  overrides: Partial<VaultItemInsert> = {}
): VaultItemInsert {
  counter++;
  return {
    user_id: userId,
    project_id: projectId,
    type: 'text',
    filename: `test-file-${counter}.txt`,
    extraction_status: 'pending',
    ...overrides,
  };
}

/**
 * Create test vault chunk data
 */
export function createTestVaultChunk(
  vaultItemId: string,
  chunkIndex: number,
  overrides: Partial<VaultChunkInsert> = {}
): VaultChunkInsert {
  counter++;
  return {
    vault_item_id: vaultItemId,
    content: `Test chunk content ${counter}`,
    chunk_index: chunkIndex,
    ...overrides,
  };
}

/**
 * Create test citation data
 */
export function createTestCitation(projectId: string, overrides: Partial<CitationInsert> = {}): CitationInsert {
  counter++;
  return {
    project_id: projectId,
    title: `Test Citation ${counter}`,
    authors: `Author ${counter}`,
    year: 2024,
    source: 'user_added',
    verified: false,
    ...overrides,
  };
}

/**
 * Create test chat message data
 */
export function createTestChatMessage(
  projectId: string,
  role: 'user' | 'assistant',
  overrides: Partial<ChatMessageInsert> = {}
): ChatMessageInsert {
  counter++;
  return {
    project_id: projectId,
    role,
    content: `Test ${role} message ${counter}`,
    ...overrides,
  };
}

/**
 * Create test AI operation data
 */
export function createTestAIOperation(
  documentId: string,
  userId: string,
  overrides: Partial<AIOperationInsert> = {}
): AIOperationInsert {
  counter++;
  return {
    document_id: documentId,
    user_id: userId,
    operation_type: 'cursor',
    input_summary: `Test input ${counter}`,
    output_content: `Test output ${counter}`,
    status: 'pending',
    ...overrides,
  };
}

/**
 * Create test audit log data
 */
export function createTestAuditLog(userId: string, overrides: Partial<AuditLogInsert> = {}): AuditLogInsert {
  counter++;
  return {
    user_id: userId,
    action: `test:action:${counter}`,
    resource_type: 'test',
    ...overrides,
  };
}
```

### Step 4: Update test-utils barrel export

Update `src/test-utils/index.ts` to include factories:

```typescript
export * from './render';
export * from './next-mocks';
export * from './factories';
```

### Step 5: Write client tests

Create `src/lib/supabase/__tests__/client.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Supabase client', () => {
  it('should have required environment variables defined in test env', () => {
    // These are set in vitest.config.ts
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });

  it('should export createClient function', async () => {
    const clientModule = await import('../client');
    expect(clientModule.createClient).toBeDefined();
    expect(typeof clientModule.createClient).toBe('function');
  });

  it('should return a client with expected methods', async () => {
    const { createClient } = await import('../client');
    const client = createClient();

    // Verify real behavior - client should have Supabase methods
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth.getSession).toBe('function');
    expect(typeof client.auth.signInWithOtp).toBe('function');
  });
});
```

### Step 6: Run tests

```bash
pnpm test src/lib/supabase
```

**Expected:** All tests pass (3 tests)

### Step 7: Commit

```bash
git add .
git commit -m "chore: add Supabase test utilities and factories"
```

---

## Usage Examples

### Using Test Client (for setup/teardown)

```typescript
import { createTestClient, createTestUser, cleanupTestData } from '@/lib/supabase/test-utils';

describe('My feature', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUser('test@example.com', 'password123');
    userId = user.id;
  });

  afterAll(async () => {
    await cleanupTestData(userId);
  });

  it('should do something', async () => {
    const client = createTestClient();
    // ... test code
  });
});
```

### Using Factories

```typescript
import { createTestProject, createTestDocument } from '@/test-utils';

const projectData = createTestProject(userId, { title: 'Custom Title' });
const documentData = createTestDocument(projectId);
```

---

## Verification Checklist

- [ ] `src/lib/supabase/test-utils.ts` created with:
  - [ ] `createTestClient()` function
  - [ ] `createTestUser()` function
  - [ ] `deleteTestUser()` function
  - [ ] `cleanupTestData()` function
  - [ ] `createAuditLog()` function
  - [ ] `TestData` class with auto-cleanup
- [ ] `src/test-utils/factories.ts` created with factory functions
- [ ] `src/test-utils/index.ts` updated with factories export
- [ ] `src/lib/supabase/__tests__/client.test.ts` created
- [ ] `pnpm test src/lib/supabase` passes (3 tests)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 0.9: Set Up GitHub Actions CI](./09-github-actions.md)**.
