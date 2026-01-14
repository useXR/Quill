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

  const stream = new ReadableStream({
    async start(controller) {
      const claudeStream = new ClaudeStream();

      request.signal.addEventListener('abort', () => {
        claudeStream.cancel();
        controller.close();
      });

      await claudeStream.stream(prompt, {
        onChunk: (chunk: StreamChunk) => {
          if (request.signal.aborted) return;
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        },
        onComplete: () => {
          if (!request.signal.aborted) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        },
        onError: (error) => {
          if (!request.signal.aborted) {
            const errorData = JSON.stringify({ error });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });
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
