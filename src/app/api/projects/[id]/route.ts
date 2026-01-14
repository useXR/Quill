import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  getProject,
  updateProject,
  deleteProject,
  handleApiError,
  formatZodError,
  UpdateProjectSchema,
} from '@/lib/api';

const logger = createLogger({ module: 'api-project-detail' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]
 * Get a single project by ID.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to get project');
  }
}

/**
 * PATCH /api/projects/[id]
 * Update a project.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validation = UpdateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const project = await updateProject(id, validation.data);

    logger.info({ projectId: id }, 'Project updated via API');

    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to update project');
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteProject(id);

    logger.info({ projectId: id }, 'Project deleted via API');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to delete project');
  }
}
