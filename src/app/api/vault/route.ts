import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { handleApiError, ApiError, ErrorCodes } from '@/lib/api';
import { getVaultItems } from '@/lib/api/vault';

const logger = createLogger({ module: 'api-vault' });

/**
 * Verifies that the user owns the project.
 */
async function verifyProjectOwnership(projectId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('projects').select('id, user_id').eq('id', projectId).single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to verify project ownership');
  }

  if (data.user_id !== userId) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this project');
  }
}

/**
 * GET /api/vault
 * Lists all vault items for a project.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    // Get projectId from query params
    const projectId = request.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'projectId is required');
    }

    // Verify project ownership
    await verifyProjectOwnership(projectId, user.id);

    // Get vault items
    const items = await getVaultItems(projectId);

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to list vault items');
  }
}
