import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { ApiError, ErrorCodes } from './errors';
import type { Citation } from '@/lib/supabase/types';

const logger = createLogger({ module: 'citations-api' });

/**
 * Get all citations for a project.
 */
export async function getCitations(projectId: string): Promise<Citation[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
  }

  // Verify user owns the project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
  }

  const { data, error } = await supabase
    .from('citations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error, projectId, userId: user.id }, 'Failed to fetch citations');
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch citations');
  }

  return data || [];
}
