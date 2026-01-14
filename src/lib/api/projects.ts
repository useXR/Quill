import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { ApiError, ErrorCodes } from './errors';
import type { PaginatedResponse } from './types';
import type { Project, ProjectStatus } from '@/lib/supabase/types';
import type { CreateProjectInput, UpdateProjectInput } from './schemas/project';

const logger = createLogger({ module: 'projects-api' });

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface GetProjectsOptions {
  limit?: number;
  cursor?: string;
}

/**
 * Get all projects for the authenticated user with cursor-based pagination.
 */
export async function getProjects(options: GetProjectsOptions = {}): Promise<PaginatedResponse<Project>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const limit = Math.min(options.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  let query = supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there are more

  // Apply cursor if provided
  if (options.cursor) {
    query = query.lt('updated_at', options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error, userId: user.id }, 'Failed to fetch projects');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch projects');
  }

  const projects = data || [];
  const hasMore = projects.length > limit;

  // Remove the extra item we fetched
  if (hasMore) {
    projects.pop();
  }

  const nextCursor = hasMore && projects.length > 0 ? projects[projects.length - 1].updated_at : null;

  return {
    items: projects,
    nextCursor,
  };
}

/**
 * Get a single project by ID.
 */
export async function getProject(id: string): Promise<Project> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    logger.error({ error, projectId: id, userId: user.id }, 'Failed to fetch project');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch project');
  }

  return data;
}

/**
 * Create a new project for the authenticated user.
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      title: input.title,
      description: input.description,
      user_id: user.id,
      status: 'draft' as ProjectStatus,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error, userId: user.id }, 'Failed to create project');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to create project');
  }

  logger.info({ projectId: data.id, userId: user.id }, 'Project created');

  return data;
}

/**
 * Update an existing project.
 */
export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    updateData.title = input.title;
  }

  if (input.description !== undefined) {
    updateData.description = input.description;
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
  }

  const { data, error } = await supabase.from('projects').update(updateData).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    logger.error({ error, projectId: id, userId: user.id }, 'Failed to update project');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to update project');
  }

  logger.info({ projectId: id, userId: user.id }, 'Project updated');

  return data;
}

/**
 * Delete a project by ID.
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  const { error } = await supabase.from('projects').delete().eq('id', id);

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    logger.error({ error, projectId: id, userId: user.id }, 'Failed to delete project');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to delete project');
  }

  logger.info({ projectId: id, userId: user.id }, 'Project deleted');
}
