# Task 4.5: API Helpers

> **Phase 4** | [← Diff Utilities](./04-diff-utilities.md) | [Next: API Routes →](./06-api-routes.md)

---

## Context

**This task creates helper functions for chat history, AI operations, and Claude CLI streaming.** These utilities abstract database operations and subprocess management for the API layer.

### Design System Note

While API helpers are backend code (no UI), their error responses map to frontend toast/error displays following `docs/design-system.md`:

| Error Type       | Frontend Display   | Design Tokens                        |
| ---------------- | ------------------ | ------------------------------------ |
| Validation error | Inline form error  | `text-error text-sm`                 |
| Rate limit       | Toast notification | `bg-warning-light text-warning-dark` |
| Server error     | Toast notification | `bg-error-light text-error`          |
| Streaming error  | Chat error banner  | `bg-error-light text-error`          |

Error messages should be user-friendly strings displayed with `font-ui`.

### Prerequisites

- **Task 4.2** completed (Intent detection)
- **Task 4.3** completed (Chat components)
- **Task 4.4** completed (Diff utilities)

### What This Task Creates

- `src/lib/api/chat.ts` - Chat history helpers
- `src/lib/api/ai-operations.ts` - AI operations CRUD
- `src/lib/ai/streaming.ts` - Claude CLI streaming helper
- Test files for each module

### Tasks That Depend on This

- **Task 4.6** (API Routes) - Uses all three helper modules

---

## Files to Create/Modify

- `src/lib/api/chat.ts` (create)
- `src/lib/api/__tests__/chat.test.ts` (create)
- `src/lib/api/ai-operations.ts` (create)
- `src/lib/api/__tests__/ai-operations.test.ts` (create)
- `src/lib/ai/streaming.ts` (create)
- `src/lib/ai/__tests__/streaming.test.ts` (create)

---

## Task 15: Chat History API Helpers

### Step 1: Write failing test for chat API helpers

Create `src/lib/api/__tests__/chat.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { getChatHistory, saveChatMessage, clearChatHistory } from '../chat';
import { createClient } from '@/lib/supabase/server';

describe('Chat API helpers', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  describe('getChatHistory', () => {
    it('should fetch paginated chat history', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [{ id: '1', role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00Z' }],
        error: null,
      });

      const result = await getChatHistory('project-1', 'doc-1', { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].content).toBe('Hello');
      expect(result.hasMore).toBe(false);
    });
  });

  describe('saveChatMessage', () => {
    it('should save message and return it', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: '1', role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      const result = await saveChatMessage({
        projectId: 'project-1',
        documentId: 'doc-1',
        role: 'user',
        content: 'Hello',
      });

      expect(result.content).toBe('Hello');
      expect(result.role).toBe('user');
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/api/__tests__/chat.test.ts
```

**Expected:** FAIL - module not found

### Step 3: Write chat API helpers

Create `src/lib/api/chat.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

// Database row type for type-safe queries (Best Practice: Type database query results)
interface ChatHistoryRow {
  id: string;
  project_id: string;
  document_id: string | null;
  role: string;
  content: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getChatHistory(
  projectId: string,
  documentId?: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedResult<ChatMessage>> {
  const { limit = 50, cursor } = options;
  const supabase = await createClient();

  let query = supabase
    .from('chat_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
    .returns<ChatHistoryRow[]>();

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) throw error;

  const hasMore = (data?.length || 0) > limit;
  const items = hasMore ? data!.slice(0, limit) : data || [];
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return {
    data: items.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: new Date(row.created_at),
    })),
    nextCursor,
    hasMore,
  };
}

export async function saveChatMessage(data: {
  projectId: string;
  documentId?: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<ChatMessage> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('chat_history')
    .insert({
      project_id: data.projectId,
      document_id: data.documentId || null,
      role: data.role,
      content: data.content,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at),
  };
}

export async function clearChatHistory(projectId: string, documentId?: string): Promise<void> {
  const supabase = await createClient();

  let query = supabase.from('chat_history').delete().eq('project_id', projectId);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { error } = await query;
  if (error) throw error;
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/api/__tests__/chat.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/api/chat.ts src/lib/api/__tests__/chat.test.ts
git commit -m "feat: add chat history API helpers"
```

---

## Task 16: AI Operations API Helpers

### Step 1: Write failing test for AI operations helpers

Create `src/lib/api/__tests__/ai-operations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createAIOperation, getRecentOperations, updateAIOperationStatus } from '../ai-operations';
import { createClient } from '@/lib/supabase/server';

describe('AI Operations helpers', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  describe('createAIOperation', () => {
    it('should create operation with snapshot', async () => {
      const mockOperation = {
        id: 'op-1',
        document_id: 'doc-1',
        operation_type: 'global',
        input_summary: 'Test edit',
        snapshot_before: { content: 'Original' },
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.single.mockResolvedValue({ data: mockOperation, error: null });

      const result = await createAIOperation({
        documentId: 'doc-1',
        operationType: 'global',
        inputSummary: 'Test edit',
        snapshotBefore: { content: 'Original' },
      });

      expect(result.id).toBe('op-1');
      expect(result.status).toBe('pending');
    });
  });

  describe('getRecentOperations', () => {
    it('should fetch recent accepted/partial operations', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [{ id: 'op-1', status: 'accepted' }],
        error: null,
      });

      const result = await getRecentOperations('doc-1', 10);

      expect(result).toHaveLength(1);
      expect(mockSupabase.in).toHaveBeenCalledWith('status', ['accepted', 'partial']);
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/api/__tests__/ai-operations.test.ts
```

**Expected:** FAIL - module not found

### Step 3: Write AI operations helpers

Create `src/lib/api/ai-operations.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

interface AIOperation {
  id: string;
  document_id: string;
  operation_type: string;
  input_summary: string;
  snapshot_before: Record<string, unknown>;
  output_content: string | null;
  status: string;
  created_at: string;
}

export async function createAIOperation(data: {
  documentId: string;
  operationType: 'selection' | 'cursor' | 'global';
  inputSummary: string;
  snapshotBefore: { content: string; selection?: { from: number; to: number } };
}): Promise<AIOperation> {
  const supabase = await createClient();

  const { data: operation, error } = await supabase
    .from('ai_operations')
    .insert({
      document_id: data.documentId,
      operation_type: data.operationType,
      input_summary: data.inputSummary,
      snapshot_before: data.snapshotBefore,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return operation;
}

export async function updateAIOperationStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'partial',
  outputContent?: string
): Promise<AIOperation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ai_operations')
    .update({
      status,
      output_content: outputContent,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentOperations(documentId: string, limit = 10): Promise<AIOperation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ai_operations')
    .select('*')
    .eq('document_id', documentId)
    .in('status', ['accepted', 'partial'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getOperationById(id: string): Promise<AIOperation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('ai_operations').select('*').eq('id', id).single();

  if (error) return null;
  return data;
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/api/__tests__/ai-operations.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/api/ai-operations.ts src/lib/api/__tests__/ai-operations.test.ts
git commit -m "feat: add AI operations API helpers"
```

---

## Task 17: Claude CLI Streaming Helper

### Step 1: Write failing test for streaming helper

Create `src/lib/ai/__tests__/streaming.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

import { streamClaude } from '../streaming';

describe('streamClaude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should spawn claude CLI with correct arguments', () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as any).mockReturnValue(mockProc);

    streamClaude('test prompt', vi.fn(), vi.fn(), vi.fn());

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', 'test prompt', '--output-format', 'stream-json'],
      expect.any(Object)
    );
  });

  it('should return cleanup function that kills process', () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as any).mockReturnValue(mockProc);

    const cleanup = streamClaude('test', vi.fn(), vi.fn(), vi.fn());
    cleanup();

    expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/streaming.test.ts
```

**Expected:** FAIL - module not found

### Step 3: Write streaming helper

Create `src/lib/ai/streaming.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import { logger } from '@/lib/logger';
import { AI } from '@/lib/constants/ai';

// Domain logger for AI streaming operations (Best Practice: Domain child loggers)
function streamLogger(context: { streamId?: string }) {
  return logger.child({ domain: 'ai-stream', ...context });
}

export function streamClaude(
  prompt: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  timeout = AI.STREAM_TIMEOUT_MS ?? 120000
): () => void {
  const streamId = crypto.randomUUID();
  const log = streamLogger({ streamId });
  let proc: ChildProcess | null = null;
  let killed = false;

  try {
    log.info('Starting Claude CLI stream');

    proc = spawn('claude', ['-p', prompt, '--output-format', 'stream-json'], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      if (killed) return;

      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.content) {
            onChunk(parsed.content);
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      if (killed) return;
      // Use structured logger instead of console.error (Best Practice: Structured logging)
      log.warn({ stderr: data.toString() }, 'Claude CLI stderr output');
    });

    proc.on('close', (code) => {
      if (killed) return;

      if (code === 0) {
        log.info('Claude CLI stream completed successfully');
        onComplete();
      } else {
        log.error({ exitCode: code }, 'Claude CLI exited with error');
        onError(`Process exited with code ${code}`);
      }
    });

    proc.on('error', (err) => {
      if (killed) return;
      log.error({ error: err.message }, 'Claude CLI process error');
      onError(err.message);
    });
  } catch (err) {
    log.error({ error: err }, 'Failed to start Claude CLI');
    onError(err instanceof Error ? err.message : 'Failed to start Claude CLI');
  }

  return () => {
    killed = true;
    log.info('Cancelling Claude CLI stream');
    proc?.kill('SIGTERM');
  };
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/streaming.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/streaming.ts src/lib/ai/__tests__/streaming.test.ts
git commit -m "feat: add Claude CLI streaming helper"
```

---

---

## Task 17b: Create Barrel Exports (Best Practice)

Per code organization best practices, create barrel exports for clean imports.

### Step 1: Create API barrel export

Create `src/lib/api/index.ts`:

```typescript
// Chat history helpers
export { getChatHistory, saveChatMessage, clearChatHistory, type ChatMessage, type PaginatedResult } from './chat';

// AI operations helpers
export { createAIOperation, updateAIOperationStatus, getRecentOperations, getOperationById } from './ai-operations';
```

### Step 2: Create AI barrel export

Create `src/lib/ai/index.ts`:

```typescript
// Intent detection
export { detectChatMode, isDestructiveEdit, type ChatMode, type ModeDetectionResult } from './intent-detection';

// Diff utilities
export { generateDiff, getDiffStats, applyDiffChanges, type DiffChange } from './diff-generator';

// Streaming
export { streamClaude } from './streaming';
```

### Step 3: Commit

```bash
git add src/lib/api/index.ts src/lib/ai/index.ts
git commit -m "feat: add barrel exports for api and ai modules"
```

---

## Verification Checklist

- [ ] getChatHistory returns paginated results
- [ ] saveChatMessage saves and returns message
- [ ] clearChatHistory deletes messages
- [ ] createAIOperation creates with pending status
- [ ] getRecentOperations filters by accepted/partial
- [ ] streamClaude spawns with correct arguments
- [ ] streamClaude cleanup kills process
- [ ] Barrel exports created for `@/lib/api` and `@/lib/ai`
- [ ] All tests pass: `npm test src/lib/api/__tests__/ src/lib/ai/__tests__/streaming.test.ts`
- [ ] Changes committed (4 commits for Tasks 15-17b)

---

## Next Steps

After this task, proceed to **[Task 4.6: API Routes](./06-api-routes.md)**.
