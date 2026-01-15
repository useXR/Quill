import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
import { saveChatMessage } from '@/lib/api/chat';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizePrompt } from '@/lib/ai/sanitize';
import { createAuditLog } from '@/lib/api/audit';
import { createLogger } from '@/lib/logger';
import { AI } from '@/lib/constants/ai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Domain logger for AI chat operations (Best Practice: AI Domain Logger from Phase 3)
const logger = createLogger({ domain: 'ai', route: 'chat' });

// Rate limit: 20 AI chat requests per minute per user
const rateLimitChat = rateLimit({ limit: 20, window: 60 });

const requestSchema = z.object({
  content: z.string().min(1).max(AI.MAX_PROMPT_LENGTH),
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  mode: z.enum(['discussion', 'global_edit', 'research']).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const operationId = crypto.randomUUID();

  // Rate limit check
  const rateLimitResult = await rateLimitChat(user.id);
  if (!rateLimitResult.success) {
    logger.warn({ userId: user.id, operationId }, 'Rate limit exceeded for AI chat');
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { content, documentId, projectId, mode } = parsed.data;

  // Sanitize user input before passing to CLI (Best Practice: CLI Input Sanitization)
  let sanitizedContent: string;
  try {
    sanitizedContent = sanitizePrompt(content);
  } catch (error) {
    logger.warn({ error, userId: user.id, operationId }, 'Input sanitization failed');
    return new Response(JSON.stringify({ error: 'Invalid input', code: 'SANITIZATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Audit log the AI operation (Best Practice: AI Audit Events with ai: prefix)
  await createAuditLog('ai:chat', {
    userId: user.id,
    documentId,
    projectId,
    mode,
    operationId,
  });

  logger.info({ userId: user.id, documentId, projectId, mode, operationId }, 'Starting AI chat stream');

  await saveChatMessage({ projectId, documentId, role: 'user', content: sanitizedContent });

  let systemPrompt = 'You are a helpful AI assistant for academic grant writing.';
  if (mode === 'global_edit') {
    systemPrompt += ' The user wants to make changes to their document.';
  } else if (mode === 'research') {
    systemPrompt += ' Help find relevant research and citations.';
  }

  const fullPrompt = `${systemPrompt}\n\nUser: ${sanitizedContent}`;
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = streamClaude(
        fullPrompt,
        (chunk) => {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
        },
        async () => {
          await saveChatMessage({ projectId, documentId, role: 'assistant', content: fullResponse });
          logger.info({ userId: user.id, documentId, operationId }, 'AI chat stream completed');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        },
        (error) => {
          logger.error({ error, userId: user.id, operationId }, 'AI chat stream error');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`));
          controller.close();
        }
      );

      request.signal.addEventListener('abort', () => {
        logger.info({ userId: user.id, operationId }, 'AI chat stream aborted by client');
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Operation-Id': operationId,
    },
  });
}
