import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveChatMessage } from '@/lib/api/chat';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizePrompt } from '@/lib/ai/sanitize';
import { createAuditLog } from '@/lib/api/audit';
import { createLogger } from '@/lib/logger';
import { AI } from '@/lib/constants/ai';
import { chat, getChatBackend } from '@/lib/ai/chat-handler';
import { extractTextFromTipTap } from '@/lib/editor/extract-text';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const { content, documentId, projectId } = parsed.data;

  // Sanitize user input
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

  // Audit log the AI operation
  await createAuditLog('ai:chat', {
    userId: user.id,
    documentId,
    projectId,
    operationId,
  });

  const backend = getChatBackend();
  logger.info({ userId: user.id, documentId, projectId, operationId, backend }, 'Starting AI chat');

  // Save user message
  await saveChatMessage({ projectId, documentId, role: 'user', content: sanitizedContent });

  // Fetch document content - extract fresh text from JSON to ensure correct formatting
  let documentContent = '';
  let documentTitle = 'Untitled';
  try {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('title, content')
      .eq('id', documentId)
      .single();

    if (!docError && document) {
      documentTitle = document.title || 'Untitled';
      // Extract text freshly from TipTap JSON for proper formatting
      documentContent = extractTextFromTipTap(document.content);
    }
  } catch (error) {
    logger.warn({ error, documentId, operationId }, 'Failed to fetch document');
  }

  // Stream response with tool support
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (data: Uint8Array) => {
        try {
          controller.enqueue(data);
        } catch {
          // Controller may be closed
        }
      };

      try {
        const result = await chat({
          userMessage: sanitizedContent,
          documentContent,
          documentTitle,
          onTextChunk: (text) => {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`));
          },
          onToolCall: (toolName, input) => {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName, input })}\n\n`));
          },
          onToolResult: (toolName, toolResult) => {
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_result', tool: toolName, success: toolResult.success, message: toolResult.message })}\n\n`
              )
            );
          },
        });

        // Save assistant response
        await saveChatMessage({ projectId, documentId, role: 'assistant', content: result.response });

        // If document was modified, update it in the database
        if (result.wasModified && result.modifiedContent) {
          logger.info({ documentId, operationId, backend: result.backend }, 'Document modified by AI');

          // Update the document content_text
          const { error: updateError } = await supabase
            .from('documents')
            .update({
              content_text: result.modifiedContent,
              updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

          if (updateError) {
            logger.error({ error: updateError, documentId }, 'Failed to update document');
          }

          // Send document update event
          safeEnqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'document_updated',
                content: result.modifiedContent,
              })}\n\n`
            )
          );
        }

        logger.info({ userId: user.id, documentId, operationId }, 'AI chat completed');
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (error) {
        logger.error({ error, userId: user.id, operationId }, 'AI chat error');
        safeEnqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' })}\n\n`
          )
        );
        controller.close();
      }
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
