import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamClaude } from '@/lib/ai/streaming';
import { createAIOperation } from '@/lib/api/ai-operations';
import { generateDiff } from '@/lib/ai/diff-generator';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizePrompt, sanitizeContext } from '@/lib/ai/sanitize';
import { createAuditLog } from '@/lib/api/audit';
import { createLogger } from '@/lib/logger';
import { AI } from '@/lib/constants/ai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Domain logger for AI global edit operations (Best Practice: AI Domain Logger from Phase 3)
const logger = createLogger({ domain: 'ai', route: 'global-edit' });

// Rate limit: 10 global edit requests per minute per user (expensive operation)
const rateLimitGlobalEdit = rateLimit({ limit: 10, window: 60 });

const requestSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  instruction: z.string().min(1).max(AI.MAX_PROMPT_LENGTH),
  currentContent: z.string().max(AI.MAX_CONTEXT_SIZE),
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

  // Rate limit check (more restrictive for expensive global edits)
  const rateLimitResult = await rateLimitGlobalEdit(user.id);
  if (!rateLimitResult.success) {
    logger.warn({ userId: user.id, operationId }, 'Rate limit exceeded for global edit');
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

  const { documentId, projectId, instruction, currentContent } = parsed.data;

  // Sanitize user input before passing to CLI (Best Practice: CLI Input Sanitization)
  let sanitizedInstruction: string;
  let sanitizedContent: string;
  try {
    sanitizedInstruction = sanitizePrompt(instruction);
    sanitizedContent = sanitizeContext(currentContent);
  } catch (error) {
    logger.warn({ error, userId: user.id, operationId }, 'Input sanitization failed');
    return new Response(JSON.stringify({ error: 'Invalid input', code: 'SANITIZATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Audit log the global edit operation (Best Practice: AI Audit Events with ai: prefix)
  await createAuditLog('ai:global-edit', {
    userId: user.id,
    documentId,
    projectId,
    operationId,
    instructionLength: sanitizedInstruction.length,
    contentLength: sanitizedContent.length,
  });

  logger.info({ userId: user.id, documentId, projectId, operationId }, 'Starting global edit operation');

  const operation = await createAIOperation({
    documentId,
    operationType: 'global',
    inputSummary: sanitizedInstruction,
    snapshotBefore: { content: sanitizedContent },
  });

  const prompt = `You are an expert editor. Apply the following instruction to the document.

INSTRUCTION: ${sanitizedInstruction}

CURRENT DOCUMENT:
${sanitizedContent}

Respond ONLY with the complete edited document. No explanations.`;

  const encoder = new TextEncoder();
  let fullContent = '';

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = streamClaude(
        prompt,
        (chunk) => {
          fullContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
        },
        async () => {
          const diff = generateDiff(sanitizedContent, fullContent);

          await supabase.from('ai_operations').update({ output_content: fullContent }).eq('id', operation.id);

          logger.info(
            { userId: user.id, documentId, operationId: operation.id, diffCount: diff.length },
            'Global edit completed'
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                operationId: operation.id,
                modifiedContent: fullContent,
                diff,
              })}\n\n`
            )
          );
          controller.close();
        },
        (error) => {
          logger.error({ error, userId: user.id, operationId: operation.id }, 'Global edit stream error');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`));
          controller.close();
        }
      );

      request.signal.addEventListener('abort', () => {
        logger.info({ userId: user.id, operationId: operation.id }, 'Global edit aborted by client');
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
