/**
 * CLI Stream Processor for Claude Code JSONL output.
 *
 * Parses JSONL streaming output from Claude Code CLI when using
 * `--output-format stream-json --include-partial-messages`
 *
 * Maps CLI events to typed callbacks for real-time UI updates.
 */

import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'cli-stream' });

// JSONL event types from Claude Code CLI
export interface CLIInitEvent {
  type: 'init';
  session_id: string;
}

export interface CLIAssistantEvent {
  type: 'assistant';
  message: {
    content: CLIContentBlock[];
  };
}

export interface CLIResultEvent {
  type: 'result';
  duration_ms?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export type CLIEvent = CLIInitEvent | CLIAssistantEvent | CLIResultEvent;

// Content block types
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | { type: 'text'; text: string }[];
  is_error?: boolean;
}

export type CLIContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

// Callback types for stream processor
export interface CLIStreamCallbacks {
  onText?: (text: string) => void;
  onThinking?: (thinking: string) => void;
  onToolCall?: (toolId: string, toolName: string, input: unknown) => void;
  onToolResult?: (toolId: string, success: boolean, content: string) => void;
  onStats?: (stats: { inputTokens: number; outputTokens: number; durationMs: number }) => void;
  onError?: (error: Error) => void;
}

export interface CLIStreamOptions {
  prompt: string;
  appendSystemPrompt?: string;
  allowedTools?: string[];
  timeout?: number;
  callbacks: CLIStreamCallbacks;
}

export interface CLIStreamResult {
  fullText: string;
  exitCode: number;
}

/**
 * Track pending tool calls for correlation with results
 */
interface PendingToolCall {
  id: string;
  name: string;
  input: unknown;
}

/**
 * Run Claude CLI with stream-json output and process events in real-time.
 */
export function runCLIStream(options: CLIStreamOptions): Promise<CLIStreamResult> {
  const { prompt, appendSystemPrompt, allowedTools = [], timeout = 120000, callbacks } = options;

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose', // Required for stream-json with -p
      '--no-session-persistence',
      '--dangerously-skip-permissions',
    ];

    if (appendSystemPrompt) {
      args.push('--append-system-prompt', appendSystemPrompt);
    }

    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }

    logger.info({ promptLength: prompt.length, allowedTools }, 'Starting CLI stream');

    const proc: ChildProcess = spawn('claude', args, {
      shell: false,
      env: process.env as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin?.end();

    let fullText = '';
    let buffer = '';
    const pendingToolCalls = new Map<string, PendingToolCall>();
    // Track last seen text to avoid duplicates from partial messages
    let lastSeenText = '';

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('CLI stream timeout'));
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as CLIEvent;
          logger.debug({ eventType: event.type }, 'Processing CLI event');
          processEvent(event, {
            callbacks,
            pendingToolCalls,
            lastSeenText,
            setLastSeenText: (text: string) => {
              lastSeenText = text;
            },
            appendFullText: (text: string) => {
              fullText += text;
            },
          });
        } catch {
          // Skip malformed JSON lines
          logger.debug({ line: line.slice(0, 100) }, 'Skipping malformed JSON line');
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      logger.debug({ stderr: text }, 'CLI stderr');
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as CLIEvent;
          processEvent(event, {
            callbacks,
            pendingToolCalls,
            lastSeenText,
            setLastSeenText: (text: string) => {
              lastSeenText = text;
            },
            appendFullText: (text: string) => {
              fullText += text;
            },
          });
        } catch {
          // Ignore
        }
      }

      resolve({
        fullText,
        exitCode: code ?? 0,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      callbacks.onError?.(err);
      reject(err);
    });
  });
}

interface ProcessEventContext {
  callbacks: CLIStreamCallbacks;
  pendingToolCalls: Map<string, PendingToolCall>;
  lastSeenText: string;
  setLastSeenText: (text: string) => void;
  appendFullText: (text: string) => void;
}

/**
 * Process a single CLI event and invoke appropriate callbacks.
 */
function processEvent(event: CLIEvent, context: ProcessEventContext): void {
  const { callbacks, pendingToolCalls, lastSeenText, setLastSeenText, appendFullText } = context;

  if (event.type === 'assistant' && event.message?.content) {
    logger.debug({ numBlocks: event.message.content.length }, 'Processing assistant message');
    for (const block of event.message.content) {
      logger.debug({ blockType: block.type }, 'Processing content block');
      switch (block.type) {
        case 'text': {
          // With partial messages, we get cumulative text
          // Only emit the new portion
          const currentText = block.text;
          if (currentText.length > lastSeenText.length && currentText.startsWith(lastSeenText)) {
            const newText = currentText.slice(lastSeenText.length);
            callbacks.onText?.(newText);
            appendFullText(newText);
          } else if (currentText !== lastSeenText) {
            // Text changed in unexpected way, emit all
            callbacks.onText?.(currentText);
            appendFullText(currentText);
          }
          setLastSeenText(currentText);
          break;
        }

        case 'thinking': {
          callbacks.onThinking?.(block.thinking);
          break;
        }

        case 'tool_use': {
          // Store for correlation with result
          pendingToolCalls.set(block.id, {
            id: block.id,
            name: block.name,
            input: block.input,
          });
          callbacks.onToolCall?.(block.id, block.name, block.input);
          break;
        }

        case 'tool_result': {
          const toolCall = pendingToolCalls.get(block.tool_use_id);
          const success = !block.is_error;

          // Extract content string
          let contentStr: string;
          if (typeof block.content === 'string') {
            contentStr = block.content;
          } else if (Array.isArray(block.content)) {
            contentStr = block.content.map((c) => (typeof c === 'string' ? c : c.text)).join('\n');
          } else {
            contentStr = String(block.content);
          }

          callbacks.onToolResult?.(block.tool_use_id, success, contentStr);

          // Clean up
          if (toolCall) {
            pendingToolCalls.delete(block.tool_use_id);
          }
          break;
        }
      }
    }
  } else if (event.type === 'result') {
    // Stats are at the top level in result events
    if (event.usage && event.duration_ms !== undefined) {
      callbacks.onStats?.({
        inputTokens: event.usage.input_tokens,
        outputTokens: event.usage.output_tokens,
        durationMs: event.duration_ms,
      });
    }
  }
}

/**
 * Parse a single JSONL line into a CLI event.
 * Useful for testing.
 */
export function parseCLIEvent(line: string): CLIEvent | null {
  try {
    return JSON.parse(line) as CLIEvent;
  } catch {
    return null;
  }
}
