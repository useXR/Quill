# Task 6: Projects CRUD

> **Phase 1** | [← Auth Middleware](./06-auth-middleware.md) | [Next: Documents CRUD →](./08-documents-crud.md)

---

## Context

**This task implements full CRUD for projects.** Provides the organizational structure for grant documents.

### Prerequisites

- **Task 5** completed (Auth middleware protecting routes)
- **Task 0** completed (Projects table and RLS policies)

### What This Task Creates

- `src/lib/api/schemas/project.ts` - Zod validation schemas
- `src/lib/api/projects.ts` - Projects API helpers
- `src/lib/api/__tests__/projects.test.ts` - API tests
- `src/app/api/projects/route.ts` - List/create API (with structured logging)
- `src/app/api/projects/[id]/route.ts` - Get/update/delete API (with structured logging)
- `src/components/projects/ProjectCard.tsx` - Project card component
- `src/components/projects/ProjectList.tsx` - Projects list
- `src/components/projects/NewProjectForm.tsx` - Create project form
- `src/app/projects/page.tsx` - Projects list page
- `src/app/projects/new/page.tsx` - New project page
- `src/app/projects/[id]/page.tsx` - Project detail page

### Tasks That Depend on This

- **Task 7** (Documents CRUD) - Documents belong to projects

---

## Files to Create/Modify

- `src/lib/api/schemas/project.ts` (create)
- `src/lib/api/projects.ts` (create)
- `src/lib/api/__tests__/projects.test.ts` (create)
- `src/app/api/projects/route.ts` (create)
- `src/app/api/projects/[id]/route.ts` (create)
- `src/components/projects/ProjectCard.tsx` (create)
- `src/components/projects/ProjectList.tsx` (create)
- `src/components/projects/NewProjectForm.tsx` (create)
- `src/app/projects/page.tsx` (create)
- `src/app/projects/new/page.tsx` (create)
- `src/app/projects/[id]/page.tsx` (create)

---

## Steps

### Step 6.1: Create validation schemas

Create `src/lib/api/schemas/project.ts`:

```typescript
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
});

export const UpdateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim().optional(),
  status: z.enum(['draft', 'submitted', 'funded']).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
```

### Step 6.2: Write the failing test for projects API

Create `src/lib/api/__tests__/projects.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProjects, createProject } from '../projects';
import { ApiError } from '../errors';
import { createMockSupabaseClient, createUnauthenticatedMock } from '@/test-utils';

// Mock the server client to return our mock
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Projects API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const mockClient = createUnauthenticatedMock();
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockClient);

      await expect(getProjects()).rejects.toThrow(ApiError);
    });

    it('should return paginated projects for authenticated user', async () => {
      const mockProjects = [{ id: '1', title: 'Project 1', updated_at: new Date().toISOString() }];
      const mockClient = createMockSupabaseClient({ userId: 'user123' });

      // Configure the mock to return projects
      const queryBuilder = mockClient.from('projects');
      queryBuilder.limit = vi.fn().mockResolvedValue({
        data: mockProjects,
        count: 1,
        error: null,
      });

      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockClient);

      const result = await getProjects();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Project 1');
    });
  });

  describe('createProject', () => {
    it('should create project with valid data', async () => {
      const mockProject = { id: '123', title: 'New Project', status: 'draft' };
      const mockClient = createMockSupabaseClient({ userId: 'user123' });

      // Configure the mock to return the created project
      const queryBuilder = mockClient.from('projects');
      queryBuilder.mockResolve(mockProject);

      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockClient);

      const result = await createProject({ title: 'New Project' });

      expect(result.title).toBe('New Project');
    });
  });
});
```

**Note:** This test uses `createMockSupabaseClient` and `createUnauthenticatedMock` from `@/test-utils` for consistent mock patterns across the codebase. See `docs/best-practices/testing-best-practices.md` for more details.

### Step 6.3: Run test to verify it fails

```bash
npm test src/lib/api/__tests__/projects.test.ts
```

**Expected:** FAIL - module '../projects' not found

### Step 6.4: Implement projects API helpers

Create `src/lib/api/projects.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { PaginatedResponse } from './types';
import { ApiError, ErrorCodes } from './errors';

type Project = Database['public']['Tables']['projects']['Row'];

export interface GetProjectsOptions {
  cursor?: string;
  limit?: number;
}

export async function getProjects(options: GetProjectsOptions = {}): Promise<PaginatedResponse<Project>> {
  const { cursor, limit = 20 } = options;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
    query = query.lt('updated_at', decodedCursor);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  const hasMore = (data?.length || 0) > limit;
  const items = hasMore ? data?.slice(0, limit) : data;

  return {
    items: items || [],
    nextCursor: hasMore && items?.length ? Buffer.from(items[items.length - 1].updated_at).toString('base64') : null,
    totalCount: count || undefined,
  };
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase.from('projects').select('*').eq('id', id).eq('user_id', user.id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function createProject(input: { title: string; description?: string }): Promise<Project> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function updateProject(
  id: string,
  input: { title?: string; status?: 'draft' | 'submitted' | 'funded' }
): Promise<Project> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}
```

### Step 6.5: Run test to verify it passes

```bash
npm test src/lib/api/__tests__/projects.test.ts
```

**Expected:** PASS

### Step 6.6: Create API routes

Create `src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/api/projects';
import { CreateProjectSchema } from '@/lib/api/schemas/project';
import { formatZodError, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = Number(searchParams.get('limit')) || 20;

    const result = await getProjects({ cursor, limit });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get projects');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = CreateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const project = await createProject(result.data);
    logger.info({ projectId: project.id }, 'Project created');
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to create project');
  }
}
```

Create `src/app/api/projects/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getProject, updateProject, deleteProject } from '@/lib/api/projects';
import { UpdateProjectSchema } from '@/lib/api/schemas/project';
import { formatZodError, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get project');
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const project = await updateProject(id, result.data);
    logger.info({ projectId: id }, 'Project updated');
    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to update project');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteProject(id);
    logger.info({ projectId: id }, 'Project deleted');
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to delete project');
  }
}
```

### Step 6.7: Create UI components

Create the following components:

- `src/components/projects/ProjectCard.tsx`
- `src/components/projects/ProjectList.tsx`
- `src/components/projects/NewProjectForm.tsx`

See original plan for full implementation.

### Step 6.8: Create pages

Create the following pages:

- `src/app/projects/page.tsx`
- `src/app/projects/new/page.tsx`
- `src/app/projects/[id]/page.tsx`

See original plan for full implementation.

### Step 6.9: Commit

```bash
git add src/lib/api/schemas src/lib/api/projects.ts src/lib/api/__tests__ src/app/api/projects src/components/projects src/app/projects
git commit -m "feat: add projects CRUD with validation, pagination, and UI"
```

---

## Verification Checklist

- [ ] Validation schemas created
- [ ] Projects API tests pass
- [ ] API routes use `handleApiError` for consistent error handling
- [ ] API routes use `formatZodError` for validation errors
- [ ] ProjectCard component renders
- [ ] ProjectList shows projects
- [ ] NewProjectForm creates projects
- [ ] Projects list page works
- [ ] New project page works
- [ ] Project detail page works
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 7: Documents CRUD](./08-documents-crud.md)**.
