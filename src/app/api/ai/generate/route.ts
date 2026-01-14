/**
 * SSE streaming endpoint for AI text generation.
 *
 * Accepts a prompt and streams the AI response using Server-Sent Events.
 */
import { NextRequest } from 'next/server';
import { ClaudeStream } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
import type { StreamChunk } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { prompt } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const streamId = crypto.randomUUID();
  const encoder = new TextEncoder();

  console.log('[AI Generate] Starting stream for prompt:', prompt.substring(0, 100) + '...');

  const stream = new ReadableStream({
    async start(controller) {
      const claudeStream = new ClaudeStream();
      let controllerClosed = false;

      const safeEnqueue = (data: Uint8Array) => {
        if (!controllerClosed && !request.signal.aborted) {
          try {
            controller.enqueue(data);
          } catch {
            controllerClosed = true;
          }
        }
      };

      const safeClose = () => {
        if (!controllerClosed) {
          try {
            controller.close();
            controllerClosed = true;
          } catch {
            controllerClosed = true;
          }
        }
      };

      request.signal.addEventListener('abort', () => {
        console.log('[AI Generate] Request aborted');
        claudeStream.cancel();
        safeClose();
      });

      console.log('[AI Generate] Calling claudeStream.stream()');
      await claudeStream.stream(prompt, {
        onChunk: (chunk: StreamChunk) => {
          console.log('[AI Generate] Received chunk:', chunk.sequence, chunk.content?.substring(0, 50));
          const data = JSON.stringify(chunk);
          safeEnqueue(encoder.encode(`data: ${data}\n\n`));
        },
        onComplete: () => {
          console.log('[AI Generate] Stream complete');
          safeEnqueue(encoder.encode('data: [DONE]\n\n'));
          safeClose();
        },
        onError: (error) => {
          console.log('[AI Generate] Stream error:', error);
          const errorData = JSON.stringify({ error });
          safeEnqueue(encoder.encode(`data: ${errorData}\n\n`));
          safeClose();
        },
      });
      console.log('[AI Generate] claudeStream.stream() returned');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Stream-Id': streamId,
    },
  });
}
