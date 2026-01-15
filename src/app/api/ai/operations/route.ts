import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentOperations } from '@/lib/api/ai-operations';
import { unauthorizedError, validationError, serverError } from '@/lib/api/error-response';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

// Domain logger for AI operations (Best Practice: Domain child loggers)
const logger = createLogger({ domain: 'ai', route: 'operations' });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!documentId) {
    return validationError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['documentId'],
          message: 'documentId is required',
        },
      ])
    );
  }

  try {
    const operations = await getRecentOperations(documentId, limit);
    logger.info({ userId: user.id, documentId, count: operations.length }, 'Fetched AI operations');
    return NextResponse.json(operations);
  } catch (error) {
    logger.error({ error, userId: user.id, documentId }, 'Failed to fetch operations');
    return serverError('Failed to fetch operations');
  }
}
