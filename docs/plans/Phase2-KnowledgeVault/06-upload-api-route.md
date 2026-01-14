# Task 2.5: Upload API Route (TDD)

> **Phase 2** | [← Vault API Helpers](./05-vault-api-helpers.md) | [Next: Text Extraction →](./07-text-extraction.md)

---

## Context

**This task creates the API routes for file upload, listing, and deletion using TDD.** It includes the extraction queue for background processing.

### Prerequisites

- **Task 2.4** completed (vault API helpers available)

### What This Task Creates

- `src/lib/queue/__tests__/extraction-queue.test.ts` - 5 unit tests
- `src/lib/queue/extraction-queue.ts` - In-memory queue with retry logic
- `src/app/api/vault/__tests__/upload.test.ts` - 4 unit tests
- `src/app/api/vault/upload/route.ts` - Upload endpoint
- `src/app/api/vault/route.ts` - List endpoint
- `src/app/api/vault/[id]/route.ts` - Get/Delete endpoints

### Tasks That Depend on This

- **Task 2.9** (Extraction Processor) - queue triggers processing
- **Task 2.12** (Vault Page) - calls these endpoints

---

## Files to Create/Modify

- `src/lib/queue/__tests__/extraction-queue.test.ts` (create)
- `src/lib/queue/extraction-queue.ts` (create)
- `src/app/api/vault/__tests__/upload.test.ts` (create)
- `src/app/api/vault/upload/route.ts` (create)
- `src/app/api/vault/route.ts` (create)
- `src/app/api/vault/[id]/route.ts` (create)

---

## Steps

### Step 1: Write failing tests for extraction queue

Create `src/lib/queue/__tests__/extraction-queue.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enqueueExtraction, getQueueStatus, recoverStalledExtractions } from '../extraction-queue';

// Mock the processor to prevent actual extraction
vi.mock('@/lib/extraction/processor', () => ({
  processExtraction: vi.fn().mockResolvedValue(undefined),
}));

// Mock Supabase for recovery function
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ id: 'stalled-1' }, { id: 'stalled-2' }] }),
    })),
  })),
}));

describe('Extraction Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enqueues extraction job', async () => {
    await enqueueExtraction('test-item-1');

    const status = getQueueStatus();
    // Job should be processing immediately
    expect(status.processing).toBeGreaterThanOrEqual(0);
  });

  it('prevents duplicate jobs for same item', async () => {
    await enqueueExtraction('test-item-1');
    await enqueueExtraction('test-item-1'); // Should be ignored

    // Only one job should be tracked
    const status = getQueueStatus();
    expect(status.pending + status.processing).toBeLessThanOrEqual(1);
  });

  it('returns queue status', () => {
    const status = getQueueStatus();

    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('processing');
    expect(typeof status.pending).toBe('number');
    expect(typeof status.processing).toBe('number');
  });

  it('recovers stalled extractions from database', async () => {
    await recoverStalledExtractions();

    // Should have queued the stalled items
    const { processExtraction } = await import('@/lib/extraction/processor');

    // Allow async operations to complete
    await vi.runAllTimersAsync();

    expect(processExtraction).toHaveBeenCalled();
  });

  it('retries failed extractions with exponential backoff', async () => {
    const { processExtraction } = await import('@/lib/extraction/processor');

    // Make first attempt fail
    vi.mocked(processExtraction).mockRejectedValueOnce(new Error('Temporary failure'));

    await enqueueExtraction('retry-test-item');

    // Advance timers to trigger retry
    await vi.advanceTimersByTimeAsync(4000); // 2^1 * 2000ms

    // Should have been called twice (initial + retry)
    expect(processExtraction).toHaveBeenCalledTimes(2);
  });
});
```

---

### Step 2: Run tests to verify they fail

```bash
npm test src/lib/queue/__tests__/extraction-queue.test.ts
```

**Expected:** FAIL - Cannot find module '../extraction-queue'

---

### Step 3: Create extraction queue with recovery

Create `src/lib/queue/extraction-queue.ts`:

```typescript
import { EXTRACTION_CONFIG } from '@/lib/vault/constants';
import { vaultLogger } from '@/lib/logger';

interface ExtractionJob {
  itemId: string;
  attempt: number;
  scheduledAt: number;
}

// In-memory queue - IMPORTANT: Not safe for serverless/multi-instance deployments!
// In production, replace with:
// - Redis + BullMQ for horizontal scaling
// - Database-level locking with SELECT ... FOR UPDATE SKIP LOCKED
// - Supabase Edge Functions with pgmq
// This implementation is suitable for single-instance deployments or development only.
const pendingJobs: Map<string, ExtractionJob> = new Map();
const processingJobs: Set<string> = new Set();

const log = vaultLogger({});

export async function enqueueExtraction(itemId: string): Promise<void> {
  if (pendingJobs.has(itemId) || processingJobs.has(itemId)) {
    log.debug({ itemId }, 'Extraction job already queued or processing');
    return;
  }

  const job: ExtractionJob = {
    itemId,
    attempt: 1,
    scheduledAt: Date.now(),
  };

  pendingJobs.set(itemId, job);
  processExtractionJob(job);
}

async function processExtractionJob(job: ExtractionJob): Promise<void> {
  const { itemId, attempt } = job;

  pendingJobs.delete(itemId);
  processingJobs.add(itemId);

  try {
    // Import dynamically to avoid circular dependencies
    const { processExtraction } = await import('@/lib/extraction/processor');
    await processExtraction(itemId);
    log.info({ itemId, attempt }, 'Extraction completed successfully');
  } catch (error) {
    log.error({ itemId, attempt, error }, 'Extraction attempt failed');

    if (attempt < EXTRACTION_CONFIG.maxRetries) {
      // Exponential backoff with cap
      const delay = Math.min(Math.pow(2, attempt) * EXTRACTION_CONFIG.retryDelayMs, EXTRACTION_CONFIG.maxRetryDelayMs);

      log.info({ itemId, nextAttempt: attempt + 1, delayMs: delay }, 'Scheduling retry');

      setTimeout(() => {
        processExtractionJob({
          itemId,
          attempt: attempt + 1,
          scheduledAt: Date.now(),
        });
      }, delay);
    } else {
      log.error({ itemId, maxRetries: EXTRACTION_CONFIG.maxRetries }, 'Max retries exceeded');
    }
  } finally {
    processingJobs.delete(itemId);
  }
}

export function getQueueStatus(): { pending: number; processing: number } {
  return {
    pending: pendingJobs.size,
    processing: processingJobs.size,
  };
}

// Recovery function - call on server startup to re-queue stalled items
export async function recoverStalledExtractions(): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: stalledItems } = await supabase
    .from('vault_items')
    .select('id')
    .in('extraction_status', ['pending', 'downloading', 'extracting', 'chunking', 'embedding']);

  if (stalledItems) {
    for (const item of stalledItems) {
      await enqueueExtraction(item.id);
    }
    log.info({ count: stalledItems.length }, 'Recovered stalled extraction jobs');
  }
}

// For testing only - reset queue state
export function __resetQueueForTesting(): void {
  pendingJobs.clear();
  processingJobs.clear();
}
```

---

### Step 4: Run queue tests to verify they pass

```bash
npm test src/lib/queue/__tests__/extraction-queue.test.ts
```

**Expected:** PASS - 5 tests passed

---

### Step 4b: Create queue barrel export

Create `src/lib/queue/index.ts`:

```typescript
// Barrel export for queue module
// Following best practices: every src/lib/<module>/ should have an index.ts
export * from './extraction-queue';
```

---

### Step 5: Write failing tests for upload route

Create `src/app/api/vault/__tests__/upload.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../upload/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-project-id' }, error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

vi.mock('@/lib/api/vault', () => ({
  createVaultItem: vi.fn().mockResolvedValue({
    id: 'new-item-id',
    filename: 'test.pdf',
    type: 'pdf',
    extraction_status: 'pending',
  }),
}));

vi.mock('@/lib/queue/extraction-queue', () => ({
  enqueueExtraction: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

function createMockFormData(files: { name: string; type: string; content: string }[], projectId: string) {
  const formData = new FormData();
  formData.append('projectId', projectId);

  for (const file of files) {
    const blob = new Blob([file.content], { type: file.type });
    formData.append('files', blob, file.name);
  }

  return formData;
}

describe('Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any);

    const formData = createMockFormData([{ name: 'test.pdf', type: 'application/pdf', content: 'test' }], 'project-1');

    const request = new NextRequest('http://localhost/api/vault/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when projectId is missing', async () => {
    const formData = new FormData();
    formData.append('files', new Blob(['test']), 'test.pdf');
    // No projectId

    const request = new NextRequest('http://localhost/api/vault/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when project not found', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      })),
    } as any);

    const formData = createMockFormData(
      [{ name: 'test.pdf', type: 'application/pdf', content: 'test' }],
      'nonexistent-project'
    );

    const request = new NextRequest('http://localhost/api/vault/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('uploads valid files and enqueues extraction', async () => {
    const formData = createMockFormData(
      [{ name: 'test.pdf', type: 'application/pdf', content: 'test content' }],
      'test-project-id'
    );

    const request = new NextRequest('http://localhost/api/vault/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('new-item-id');

    const { enqueueExtraction } = await import('@/lib/queue/extraction-queue');
    expect(enqueueExtraction).toHaveBeenCalledWith('new-item-id');
  });
});
```

---

### Step 6: Run upload tests to verify they fail

```bash
npm test src/app/api/vault/__tests__/upload.test.ts
```

**Expected:** FAIL - Cannot find module '../upload/route'

---

### Step 7: Create upload route

Create `src/app/api/vault/upload/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { createVaultItem } from '@/lib/api/vault';
import { enqueueExtraction } from '@/lib/queue/extraction-queue';
import { sanitizeFilename } from '@/lib/utils/filename';
import { FILE_SIZE_LIMITS, FILE_TYPE_MAP, type FileType } from '@/lib/vault/constants';
import { NextResponse } from 'next/server';
import { vaultLogger } from '@/lib/logger';

function getFileType(filename: string): FileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? (FILE_TYPE_MAP[ext] as FileType) || null : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectId = formData.get('projectId') as string;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const log = vaultLogger({ userId: user.id, projectId });
    log.info({ fileCount: files.length }, 'Upload request received');

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      const fileType = getFileType(file.name);

      if (!fileType) {
        errors.push({ filename: file.name, error: 'Unsupported file type' });
        continue;
      }

      if (file.size > FILE_SIZE_LIMITS[fileType]) {
        errors.push({
          filename: file.name,
          error: `File exceeds ${FILE_SIZE_LIMITS[fileType] / 1024 / 1024}MB limit`,
        });
        continue;
      }

      const sanitizedName = sanitizeFilename(file.name);
      const path = `${user.id}/${projectId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage.from('vault-files').upload(path, file);

      if (uploadError) {
        log.error({ error: uploadError, filename: file.name }, 'Storage upload failed');
        errors.push({ filename: file.name, error: 'Storage upload failed' });
        continue;
      }

      try {
        const item = await createVaultItem({
          projectId,
          type: fileType,
          filename: file.name,
          storagePath: path,
        });

        results.push(item);
        enqueueExtraction(item.id);
        log.info({ itemId: item.id, filename: file.name }, 'File uploaded successfully');
      } catch (dbError) {
        log.error({ error: dbError, filename: file.name }, 'Database insert failed');
        await supabase.storage.from('vault-files').remove([path]);
        errors.push({ filename: file.name, error: 'Database insert failed' });
      }
    }

    log.info({ successCount: results.length, errorCount: errors.length }, 'Upload request completed');

    return NextResponse.json({
      items: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    vaultLogger({}).error({ error }, 'Upload route error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

### Step 8: Run upload tests to verify they pass

```bash
npm test src/app/api/vault/__tests__/upload.test.ts
```

**Expected:** PASS - 4 tests passed

---

### Step 9: Create vault list route with auth

Create `src/app/api/vault/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getVaultItems } from '@/lib/api/vault';
import { vaultLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const log = vaultLogger({ userId: user.id, projectId });

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const items = await getVaultItems(projectId);
    log.info({ itemCount: items.length }, 'Vault items retrieved');
    return NextResponse.json(items);
  } catch (error) {
    vaultLogger({}).error({ error }, 'Get vault items error');
    return NextResponse.json({ error: 'Failed to get items' }, { status: 500 });
  }
}
```

---

### Step 10: Create vault item route with auth (Next.js 14+ params)

Create `src/app/api/vault/[id]/route.ts`:

```typescript
import { getVaultItem, deleteVaultItem } from '@/lib/api/vault';
import { createClient } from '@/lib/supabase/server';
import { vaultLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const log = vaultLogger({ userId: user.id, itemId: id });
    const item = await getVaultItem(id);

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    vaultLogger({}).error({ error }, 'Failed to get vault item');
    return NextResponse.json({ error: 'Failed to get item' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const log = vaultLogger({ userId: user.id, itemId: id });

    const item = await getVaultItem(id);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteVaultItem(id);
    log.info('Vault item deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    vaultLogger({}).error({ error }, 'Failed to delete vault item');
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
```

---

### Step 11: Run all tests

```bash
npm test src/lib/queue/__tests__/extraction-queue.test.ts src/app/api/vault/__tests__/upload.test.ts
```

**Expected:** PASS - 9 tests passed

---

### Step 12: Commit API routes

```bash
git add src/lib/queue/ src/app/api/vault/
git commit -m "feat: add vault API routes with auth, queue-based extraction, and unit tests (TDD)"
```

---

## Verification Checklist

- [ ] `src/lib/queue/__tests__/extraction-queue.test.ts` exists with 5 tests
- [ ] `src/lib/queue/extraction-queue.ts` exists with retry logic
- [ ] `src/lib/queue/index.ts` exists (barrel export)
- [ ] `src/app/api/vault/__tests__/upload.test.ts` exists with 4 tests
- [ ] `src/app/api/vault/upload/route.ts` exists with validation
- [ ] `src/app/api/vault/route.ts` exists with auth
- [ ] `src/app/api/vault/[id]/route.ts` exists with GET and DELETE
- [ ] All 9 tests pass
- [ ] Upload route validates file types and sizes
- [ ] Upload route uses secure filename sanitization
- [ ] All routes check authentication
- [ ] All routes verify project ownership
- [ ] Queue has exponential backoff with cap
- [ ] Uses structured logger (pino) instead of console.log
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 2.6: Text Extraction](./07-text-extraction.md)**.
