import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getProjects, createProject, handleApiError, formatZodError, CreateProjectSchema } from '@/lib/api';

const logger = createLogger({ module: 'api-projects' });

/**
 * GET /api/projects
 * List all projects for the authenticated user with cursor pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await getProjects({ cursor, limit });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, logger, 'Failed to list projects');
  }
}

/**
 * POST /api/projects
 * Create a new project.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = CreateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: formatZodError(validation.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const project = await createProject(validation.data);

    logger.info({ projectId: project.id }, 'Project created via API');

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to create project');
  }
}
