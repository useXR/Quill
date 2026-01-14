# Task 7: Documents CRUD

> **Phase 1** | [← Projects CRUD](./07-projects-crud.md) | [Next: Autosave Hook →](./09-autosave-hook.md)

---

## Context

**This task implements CRUD for documents with version conflict detection.** Documents belong to projects and store TipTap JSON content.

### Prerequisites

- **Task 6** completed (Projects CRUD - documents belong to projects)
- **Task 0** completed (Documents table and RLS policies)

### What This Task Creates

- `src/lib/api/schemas/document.ts` - Zod validation schemas
- `src/lib/api/__tests__/documents.test.ts` - API tests
- `src/lib/api/documents.ts` - Documents API helpers
- `src/app/api/documents/route.ts` - List/create API (with structured logging)
- `src/app/api/documents/[id]/route.ts` - Get/update/delete API (with structured logging)

### Tasks That Depend on This

- **Task 8** (Autosave Hook) - Uses document update API

---

## Files to Create/Modify

- `src/lib/api/schemas/document.ts` (create)
- `src/lib/api/__tests__/documents.test.ts` (create)
- `src/lib/api/documents.ts` (create)
- `src/app/api/documents/route.ts` (create)
- `src/app/api/documents/[id]/route.ts` (create)

---

## Steps

### Step 7.1: Create document validation schemas

Create `src/lib/api/schemas/document.ts`:

```typescript
import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim(),
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim().optional(),
  content: z.any().optional(),
  content_text: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
```

### Step 7.2: Write the failing test for documents API

Create `src/lib/api/__tests__/documents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocuments, getDocument, createDocument, updateDocument, deleteDocument } from '../documents';
import { ApiError } from '../errors';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Documents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDocuments', () => {
    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await expect(getDocuments('project-123')).rejects.toThrow(ApiError);
    });

    it('should return documents for a project', async () => {
      const mockDocs = [
        { id: 'doc-1', title: 'Doc 1', sort_order: 0 },
        { id: 'doc-2', title: 'Doc 2', sort_order: 1 },
      ];
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockDocs, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await getDocuments('project-123');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Doc 1');
    });
  });

  describe('updateDocument', () => {
    it('should throw CONFLICT on version mismatch', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { version: 5 }, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await expect(updateDocument('doc-1', { title: 'New', expectedVersion: 3 })).rejects.toThrow('Version conflict');
    });
  });
});
```

### Step 7.3: Run test to verify it fails

```bash
npm test src/lib/api/__tests__/documents.test.ts
```

**Expected:** FAIL - module '../documents' not found

### Step 7.4: Implement documents API helpers

Create `src/lib/api/documents.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { ApiError, ErrorCodes } from './errors';

type Document = Database['public']['Tables']['documents']['Row'];

export async function getDocuments(projectId: string): Promise<Document[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data || [];
}

export async function getDocument(id: string): Promise<Document | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function createDocument(input: { project_id: string; title: string }): Promise<Document> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  // Get max sort_order for this project
  const { data: maxOrder } = await supabase
    .from('documents')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (maxOrder?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      content: { type: 'doc', content: [] },
      content_text: '',
      sort_order: sortOrder,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function updateDocument(
  id: string,
  input: { title?: string; content?: unknown; content_text?: string; expectedVersion?: number }
): Promise<Document> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  // Version conflict detection
  if (input.expectedVersion !== undefined) {
    const { data: current } = await supabase.from('documents').select('version').eq('id', id).single();

    if (current && current.version !== input.expectedVersion) {
      throw new ApiError(409, ErrorCodes.CONFLICT, 'Version conflict detected');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.content !== undefined) updateData.content = input.content;
  if (input.content_text !== undefined) updateData.content_text = input.content_text;
  if (input.expectedVersion !== undefined) updateData.version = input.expectedVersion + 1;

  const { data, error } = await supabase.from('documents').update(updateData).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}
```

### Step 7.5: Run test to verify it passes

```bash
npm test src/lib/api/__tests__/documents.test.ts
```

**Expected:** PASS

### Step 7.6: Create documents API routes

Create `src/app/api/documents/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDocuments, createDocument } from '@/lib/api/documents';
import { CreateDocumentSchema } from '@/lib/api/schemas/document';
import { formatZodError, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const documents = await getDocuments(projectId);
    return NextResponse.json(documents);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get documents');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = CreateDocumentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const document = await createDocument(result.data);
    logger.info({ documentId: document.id, projectId: document.project_id }, 'Document created');
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to create document');
  }
}
```

Create `src/app/api/documents/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDocument, updateDocument, deleteDocument } from '@/lib/api/documents';
import { UpdateDocumentSchema } from '@/lib/api/schemas/document';
import { ApiError, formatZodError, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const document = await getDocument(id);

    if (!document) {
      return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get document');
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateDocumentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const document = await updateDocument(id, result.data);
    logger.info({ documentId: id, version: document.version }, 'Document updated');
    return NextResponse.json(document);
  } catch (error) {
    // Special handling: Log version conflicts at info level (expected in concurrent editing)
    if (error instanceof ApiError && error.code === 'CONFLICT') {
      logger.info({ documentId: (await params).id }, 'Document version conflict');
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return handleApiError(error, logger, 'Failed to update document');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteDocument(id);
    logger.info({ documentId: id }, 'Document deleted');
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to delete document');
  }
}
```

### Step 7.7: Commit

```bash
git add src/lib/api/schemas/document.ts src/lib/api/documents.ts src/lib/api/__tests__/documents.test.ts src/app/api/documents
git commit -m "feat: add documents CRUD with version conflict detection"
```

---

## Verification Checklist

- [ ] Document validation schemas created
- [ ] Documents API tests pass
- [ ] API routes use `handleApiError` for consistent error handling
- [ ] API routes use `formatZodError` for validation errors
- [ ] Documents ordered by sort_order
- [ ] Version conflict detection works (logged at info level)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 8: Autosave Hook](./09-autosave-hook.md)**.
