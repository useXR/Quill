/**
 * Streaming module for real-time AI response delivery.
 *
 * This module handles streaming responses from Claude CLI, providing
 * chunk-by-chunk delivery with heartbeat keepalive and cancellation support.
 */
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { sanitizePrompt, sanitizeContext } from './sanitize';
import { categorizeError } from './errors';
import { AI } from '@/lib/constants/ai';
import type { ClaudeError } from './types';

/**
 * A single chunk of streaming content from Claude CLI.
 */
export interface StreamChunk {
  /** Unique identifier for this stream session */
  id: string;
  /** Sequential number of this chunk (0-indexed) */
  sequence: number;
  /** Content received in this chunk */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Error information if this chunk represents a failure */
  error?: ClaudeError;
}

/**
 * Callbacks for handling streaming events.
 */
export interface StreamCallbacks {
  /** Called for each chunk of content received */
  onChunk: (chunk: StreamChunk) => void;
  /** Called when the stream completes successfully */
  onComplete: () => void;
  /** Called when an error occurs */
  onError: (error: ClaudeError) => void;
}

/**
 * Manages streaming response from Claude CLI process.
 *
 * Provides chunk-by-chunk delivery with heartbeat keepalive,
 * cancellation support, and partial content recovery on error.
 */
export class ClaudeStream {
  private process: ChildProcess | null = null;
  private chunks: StreamChunk[] = [];
  private buffer = '';
  private sequence = 0;
  private cancelled = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private streamId: string = '';

  /**
   * Start streaming a response from Claude CLI.
   *
   * @param prompt - The prompt to send to Claude
   * @param callbacks - Callbacks for handling stream events
   * @param options - Optional context and timeout configuration
   */
  async stream(
    prompt: string,
    callbacks: StreamCallbacks,
    options: { context?: string; timeout?: number } = {}
  ): Promise<void> {
    const { context, timeout = AI.DEFAULT_TIMEOUT_MS } = options;

    this.streamId = randomUUID();
    this.chunks = [];
    this.buffer = '';
    this.sequence = 0;
    this.cancelled = false;

    return new Promise<void>((resolve) => {
      try {
        const sanitizedPrompt = sanitizePrompt(prompt);
        const sanitizedContext = context ? sanitizeContext(context) : undefined;

        const args = [
          '-p',
          sanitizedPrompt,
          '--output-format',
          'stream-json',
          '--verbose',
          '--disable-slash-commands', // Skip skill/command loading
          '--tools',
          '', // Disable all tools - we just need text generation
          '--no-session-persistence', // Don't save session to disk
          '--dangerously-skip-permissions', // Skip permission prompts
        ];
        if (sanitizedContext) {
          args.push('--context', sanitizedContext);
        }

        // Pass full environment to ensure PATH includes nvm, homebrew, etc.
        // Use stdio: 'pipe' and close stdin immediately to prevent waiting for input
        this.process = spawn('claude', args, {
          shell: false,
          env: process.env as NodeJS.ProcessEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Close stdin immediately - we're not sending any input
        if (this.process.stdin) {
          this.process.stdin.end();
        }

        let errorOutput = '';

        // Set up timeout
        this.timeoutTimer = setTimeout(() => {
          if (!this.cancelled) {
            this.cleanup();
            const error = categorizeError('Timeout: Stream exceeded maximum duration', this.getContent());
            callbacks.onError(error);
            resolve();
          }
        }, timeout);

        // Set up heartbeat for connection keepalive
        this.heartbeatTimer = setInterval(() => {
          if (!this.cancelled && this.process) {
            // Heartbeat - just check if process is still alive
            // The process itself doesn't need us to send anything
          }
        }, AI.HEARTBEAT_INTERVAL_MS);

        this.process.stdout!.on('data', (data: Buffer) => {
          if (this.cancelled) return;

          const dataStr = data.toString();
          this.buffer += dataStr;
          const lines = this.buffer.split('\n');
          this.buffer = lines.pop() || '';

          for (const line of lines.filter(Boolean)) {
            try {
              const parsed = JSON.parse(line);

              // Handle Claude Code protocol format
              // Look for assistant messages with content
              if (parsed.type === 'assistant' && parsed.message?.content) {
                for (const block of parsed.message.content) {
                  if (block.type === 'text' && block.text) {
                    const chunk: StreamChunk = {
                      id: this.streamId,
                      sequence: this.sequence++,
                      content: block.text,
                      done: false,
                    };
                    this.chunks.push(chunk);
                    callbacks.onChunk(chunk);
                  }
                }
              }
              // Also handle simple content format as fallback
              else if (parsed.content !== undefined && typeof parsed.content === 'string') {
                const chunk: StreamChunk = {
                  id: this.streamId,
                  sequence: this.sequence++,
                  content: parsed.content,
                  done: false,
                };
                this.chunks.push(chunk);
                callbacks.onChunk(chunk);
              }
            } catch {
              // Skip malformed JSON lines - non-fatal
            }
          }
        });

        this.process.stderr!.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        this.process.on('close', (code: number | null) => {
          if (this.cancelled) {
            resolve();
            return;
          }

          this.cleanup();

          if (code !== 0) {
            const error = categorizeError(errorOutput || `Exit code ${code}`, this.getContent());
            // Emit final chunk with error
            const errorChunk: StreamChunk = {
              id: this.streamId,
              sequence: this.sequence++,
              content: '',
              done: true,
              error,
            };
            this.chunks.push(errorChunk);
            callbacks.onChunk(errorChunk);
            callbacks.onError(error);
          } else {
            // Emit final done chunk
            const doneChunk: StreamChunk = {
              id: this.streamId,
              sequence: this.sequence++,
              content: '',
              done: true,
            };
            this.chunks.push(doneChunk);
            callbacks.onChunk(doneChunk);
            callbacks.onComplete();
          }

          resolve();
        });

        this.process.on('error', (err: Error) => {
          if (this.cancelled) {
            resolve();
            return;
          }

          this.cleanup();
          const error = categorizeError(err, this.getContent());

          // Emit error chunk
          const errorChunk: StreamChunk = {
            id: this.streamId,
            sequence: this.sequence++,
            content: '',
            done: true,
            error,
          };
          this.chunks.push(errorChunk);
          callbacks.onChunk(errorChunk);
          callbacks.onError(error);

          resolve();
        });
      } catch (err) {
        this.cleanup();
        const error = categorizeError(err as Error);
        callbacks.onError(error);
        resolve();
      }
    });
  }

  /**
   * Cancel the current streaming operation.
   */
  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  /**
   * Get all content received so far, concatenated.
   */
  getContent(): string {
    return this.chunks.map((c) => c.content).join('');
  }

  /**
   * Get all chunks received so far.
   */
  getChunks(): StreamChunk[] {
    return [...this.chunks];
  }

  /**
   * Get all chunks received after a specific sequence number.
   *
   * @param sequence - Return chunks with sequence greater than this
   */
  getChunksAfter(sequence: number): StreamChunk[] {
    return this.chunks.filter((c) => c.sequence > sequence);
  }

  /**
   * Clean up timers and process.
   */
  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

/**
 * Convenience function for streaming Claude responses with simple callbacks.
 *
 * @param prompt - The prompt to send to Claude
 * @param onChunk - Called with content string for each chunk
 * @param onComplete - Called when stream completes successfully
 * @param onError - Called with error message string on failure
 * @param timeout - Optional timeout in milliseconds
 * @returns A cancel function to abort the stream
 */
export function streamClaude(
  prompt: string,
  onChunk: (content: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  timeout?: number
): () => void {
  const stream = new ClaudeStream();

  stream.stream(
    prompt,
    {
      onChunk: (chunk) => {
        if (chunk.content) {
          onChunk(chunk.content);
        }
      },
      onComplete,
      onError: (error) => {
        onError(error.message);
      },
    },
    { timeout }
  );

  return () => stream.cancel();
}
