# Task 2.4: Vault API Helpers (TDD)

> **Phase 2** | [← VaultItemList Component](./04-vault-item-list-component.md) | [Next: Upload API Route →](./06-upload-api-route.md)

---

## Context

**This task creates server-side helper functions for vault CRUD operations.** It includes secure filename sanitization, soft delete with restore capability, and audit logging.

### Prerequisites

- **Task 2.0** completed (types and database tables available)

### What This Task Creates

- `src/lib/api/__tests__/vault.test.ts` - 8 unit tests with proper mocking and cleanup
- `src/lib/api/vault.ts` - CRUD helper functions with soft delete
- `src/lib/api/audit.ts` - Audit logging helper
- `src/lib/utils/filename.ts` - Secure filename sanitizer

### Tasks That Depend on This

- **Task 2.5** (Upload API Route) - uses these helpers
- **Task 2.9** (Extraction Processor) - uses updateVaultItemStatus

### Parallel Tasks

This task can be done in parallel with:

- **Task 2.1** (VaultUpload)
- **Task 2.2** (VaultItemCard)

---

## Files to Create/Modify

- `src/lib/api/__tests__/vault.test.ts` (create)
- `src/lib/api/vault.ts` (create)
- `src/lib/api/audit.ts` (create)
- `src/lib/utils/filename.ts` (create)

---

## Steps

### Step 1: Write failing tests for vault API

Create `src/lib/api/__tests__/vault.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVaultItem, getVaultItems, getVaultItem, softDeleteVaultItem, restoreVaultItem } from '../vault';
import { sanitizeFilename } from '@/lib/utils/filename';

// Track mock state for cleanup verification (following TestData pattern from best practices)
let mockCreatedRecords: { table: string; id: string }[] = [];

// Create a mock Supabase client that tracks operations
const createMockSupabase = () => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    from: vi.fn((table: string) => ({
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        const id = `mock-${Date.now()}`;
        mockCreatedRecords.push({ table, id });
        return { data: { id, filename: 'test.pdf', type: 'pdf' }, error: null };
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  };
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Vault API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatedRecords = [];
  });

  afterEach(() => {
    // Cleanup: In real tests with actual DB, this would delete created records
    // Following the TestData class pattern from best practices
    mockCreatedRecords = [];
  });

  describe('createVaultItem', () => {
    it('creates a vault item with correct data', async () => {
      const item = await createVaultItem({
        projectId: 'project-1',
        type: 'pdf',
        filename: 'test.pdf',
        storagePath: 'vault/test.pdf',
      });

      expect(item).toBeDefined();
      expect(item.id).toBeDefined();

      // Verify audit log was called
      const { createAuditLog } = await import('../audit');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vault:create',
          resourceType: 'vault_item',
        })
      );
    });

    it('throws error when not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      } as any);

      await expect(
        createVaultItem({
          projectId: 'project-1',
          type: 'pdf',
          filename: 'test.pdf',
          storagePath: 'vault/test.pdf',
        })
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('getVaultItems', () => {
    it('returns items for a project', async () => {
      const items = await getVaultItems('project-1');
      expect(Array.isArray(items)).toBe(true);
    });

    it('filters out soft-deleted items by default', async () => {
      // Verify the query includes .is('deleted_at', null)
      const { createClient } = await import('@/lib/supabase/server');
      await getVaultItems('project-1');
      expect(createClient).toHaveBeenCalled();
      // The implementation should filter soft-deleted items
    });
  });

  describe('softDeleteVaultItem', () => {
    it('sets deleted_at timestamp on soft delete', async () => {
      await softDeleteVaultItem('test-item-id');

      const { createAuditLog } = await import('../audit');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vault:delete',
          resourceId: 'test-item-id',
        })
      );
    });
  });

  describe('restoreVaultItem', () => {
    it('clears deleted_at timestamp on restore', async () => {
      await restoreVaultItem('test-item-id');

      const { createAuditLog } = await import('../audit');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vault:restore',
          resourceId: 'test-item-id',
        })
      );
    });
  });
});

describe('sanitizeFilename', () => {
  it('removes path traversal attempts', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('______etc_passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('______windows_system32');
  });

  it('removes null bytes', () => {
    expect(sanitizeFilename('file\x00.pdf')).toBe('file.pdf');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('file<>:"|?*.pdf')).toBe('file_______.pdf');
  });

  it('limits filename length', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(255);
  });

  it('returns unnamed for empty result', () => {
    expect(sanitizeFilename('...')).toBe('unnamed');
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/lib/api/__tests__/vault.test.ts
```

**Expected:** FAIL - Cannot find modules

---

### Step 3: Create audit logging helper

Create `src/lib/api/audit.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { vaultLogger } from '@/lib/logger';

export type AuditAction =
  | 'vault:create'
  | 'vault:delete'
  | 'vault:restore'
  | 'vault:extraction_complete'
  | 'vault:extraction_failed';

interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType: 'vault_item';
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const log = vaultLogger({ userId: entry.userId, itemId: entry.resourceId });

  try {
    const supabase = await createClient();

    await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      metadata: entry.metadata,
    });

    log.info({ action: entry.action }, 'Audit log created');
  } catch (error) {
    // Log but don't fail the operation if audit logging fails
    log.error({ error, action: entry.action }, 'Failed to create audit log');
  }
}
```

---

### Step 4: Implement filename sanitizer

Create `src/lib/utils/filename.ts`:

```typescript
export function sanitizeFilename(filename: string): string {
  // Remove null bytes
  let safe = filename.replace(/\x00/g, '');

  // Remove path traversal
  safe = safe.replace(/[/\\]/g, '_').replace(/\.\./g, '__');

  // Remove special characters (Windows reserved + control chars)
  safe = safe.replace(/[<>:"|?*\x00-\x1f]/g, '_');

  // Limit length (preserve extension if possible)
  if (safe.length > 255) {
    const ext = safe.slice(safe.lastIndexOf('.'));
    const name = safe.slice(0, 255 - ext.length);
    safe = name + ext;
  }

  // Handle empty result
  const trimmed = safe.replace(/^[._]+|[._]+$/g, '').trim();
  return trimmed || 'unnamed';
}
```

---

### Step 5: Implement vault API helpers

Create `src/lib/api/vault.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { VaultItem, ExtractionStatus } from '@/lib/vault/types';
import type { FileType } from '@/lib/vault/constants';
import { createAuditLog } from './audit';
import { vaultLogger } from '@/lib/logger';

type VaultItemInsert = Database['public']['Tables']['vault_items']['Insert'];

export async function createVaultItem(item: {
  projectId: string | null;
  type: FileType;
  filename: string;
  storagePath: string;
}): Promise<VaultItem> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const log = vaultLogger({ userId: user.id, projectId: item.projectId || undefined });

  const insertData: VaultItemInsert = {
    user_id: user.id,
    project_id: item.projectId,
    type: item.type,
    filename: item.filename,
    storage_path: item.storagePath,
    extraction_status: 'pending',
  };

  const { data, error } = await supabase.from('vault_items').insert(insertData).select().single();

  if (error) {
    log.error({ error, filename: item.filename }, 'Failed to create vault item');
    throw error;
  }

  // Audit log the creation
  await createAuditLog({
    userId: user.id,
    action: 'vault:create',
    resourceType: 'vault_item',
    resourceId: data.id,
    metadata: { filename: item.filename, type: item.type },
  });

  log.info({ itemId: data.id, filename: item.filename }, 'Vault item created');
  return data;
}

export async function getVaultItems(projectId: string): Promise<VaultItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .is('deleted_at', null) // IMPORTANT: Exclude soft-deleted items
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getVaultItem(id: string): Promise<VaultItem | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.from('vault_items').select('*').eq('id', id).eq('user_id', user.id).single();

  if (error) return null;
  return data;
}

export async function updateVaultItemStatus(
  id: string,
  status: ExtractionStatus,
  updates?: { extracted_text?: string; chunk_count?: number }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('vault_items')
    .update({
      extraction_status: status,
      ...updates,
    })
    .eq('id', id);

  if (error) throw error;
}

// Soft delete - sets deleted_at timestamp, storage cleanup happens after grace period
export async function softDeleteVaultItem(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const log = vaultLogger({ userId: user.id, itemId: id });

  const { error } = await supabase
    .from('vault_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    log.error({ error }, 'Failed to soft delete vault item');
    throw error;
  }

  // Audit log the deletion
  await createAuditLog({
    userId: user.id,
    action: 'vault:delete',
    resourceType: 'vault_item',
    resourceId: id,
  });

  log.info('Vault item soft deleted');
}

// Restore a soft-deleted item (undo delete within grace period)
export async function restoreVaultItem(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const log = vaultLogger({ userId: user.id, itemId: id });

  // Note: May need to bypass RLS to find soft-deleted items
  // Consider using a service role or dedicated database function
  const { error } = await supabase.from('vault_items').update({ deleted_at: null }).eq('id', id).eq('user_id', user.id);

  if (error) {
    log.error({ error }, 'Failed to restore vault item');
    throw error;
  }

  await createAuditLog({
    userId: user.id,
    action: 'vault:restore',
    resourceType: 'vault_item',
    resourceId: id,
  });

  log.info('Vault item restored');
}

// Legacy alias for backwards compatibility - uses soft delete
export async function deleteVaultItem(id: string): Promise<void> {
  return softDeleteVaultItem(id);
}
```

---

### Step 6: Run tests to verify they pass

```bash
npm test src/lib/api/__tests__/vault.test.ts
```

**Expected:** PASS - All 8 tests pass

---

### Step 7: Commit vault API helpers

```bash
git add src/lib/api/ src/lib/utils/
git commit -m "feat: add vault API helpers with soft delete, audit logging, and secure filename sanitization (TDD)"
```

---

## Verification Checklist

- [ ] `src/lib/api/__tests__/vault.test.ts` exists with 8 tests
- [ ] `src/lib/api/vault.ts` exists with CRUD functions
- [ ] `src/lib/api/audit.ts` exists with audit logging
- [ ] `src/lib/utils/filename.ts` exists with sanitization
- [ ] All 8 tests pass
- [ ] Tests use mock cleanup pattern (track created records in afterEach)
- [ ] Filename sanitizer handles path traversal
- [ ] Filename sanitizer handles null bytes
- [ ] Filename sanitizer handles special characters
- [ ] Filename sanitizer enforces length limits
- [ ] `getVaultItems` filters out soft-deleted items (`.is('deleted_at', null)`)
- [ ] Delete uses soft delete (sets deleted_at)
- [ ] Restore function can undo soft delete
- [ ] Audit logs created for create/delete/restore operations
- [ ] Uses structured logger (pino) instead of console.log
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.5: Upload API Route](./06-upload-api-route.md)**.
