import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatHistory, clearChatHistory } from '@/lib/api/chat';
import { rateLimit } from '@/lib/rate-limit';
import { unauthorizedError, validationError, rateLimitError, serverError } from '@/lib/api/error-response';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

// Domain logger for chat operations (Best Practice: Domain child loggers)
const logger = createLogger({ domain: 'chat', route: 'history' });

// Rate limit: 100 requests per minute for GET, 10 for DELETE
const rateLimitGet = rateLimit({ limit: 100, window: 60 });
const rateLimitDelete = rateLimit({ limit: 10, window: 60 });

const querySchema = z.object({
  projectId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  // Rate limit check
  const rateLimitResult = await rateLimitGet(user.id);
  if (!rateLimitResult.success) {
    logger.warn({ userId: user.id }, 'Rate limit exceeded for chat history GET');
    return rateLimitError(rateLimitResult.retryAfter!);
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: searchParams.get('projectId'),
    documentId: searchParams.get('documentId') || undefined,
    limit: searchParams.get('limit') || undefined,
    cursor: searchParams.get('cursor') || undefined,
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const result = await getChatHistory(parsed.data.projectId, parsed.data.documentId ?? undefined, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor ?? undefined,
    });
    logger.info({ userId: user.id, projectId: parsed.data.projectId }, 'Chat history fetched');
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error, userId: user.id, projectId: parsed.data.projectId }, 'Failed to fetch chat history');
    return serverError('Failed to fetch chat history');
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  // Rate limit check for DELETE
  const rateLimitResult = await rateLimitDelete(user.id);
  if (!rateLimitResult.success) {
    logger.warn({ userId: user.id }, 'Rate limit exceeded for chat history DELETE');
    return rateLimitError(rateLimitResult.retryAfter!);
  }

  const { projectId, documentId } = await request.json();

  if (!projectId) {
    return validationError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['projectId'],
          message: 'projectId is required',
        },
      ])
    );
  }

  try {
    await clearChatHistory(projectId, documentId);
    logger.info({ userId: user.id, projectId, documentId }, 'Chat history cleared');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error, userId: user.id, projectId }, 'Failed to clear chat history');
    return serverError('Failed to clear chat history');
  }
}
