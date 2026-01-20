/**
 * Unified chat handler that can use either:
 * 1. Anthropic SDK (API) - requires ANTHROPIC_API_KEY
 * 2. Claude Code CLI - uses user's subscription
 *
 * Set CHAT_BACKEND=cli to use CLI, otherwise defaults to API if key is available.
 */

import { chatWithTools, ChatWithToolsResult } from './tools';
import { editWithCli, FileEditResult } from './cli-file-edit';
import { runCLIStream, CLIStreamResult } from './cli-stream';
import { createLogger } from '@/lib/logger';
import { sanitizePrompt } from './sanitize';

const logger = createLogger({ module: 'chat-handler' });

export type ChatBackend = 'api' | 'cli';

/**
 * Determine which backend to use based on configuration
 */
export function getChatBackend(): ChatBackend {
  // Check explicit preference
  if (process.env.CHAT_BACKEND === 'cli') {
    return 'cli';
  }

  // Default to API if key is available
  if (process.env.ANTHROPIC_API_KEY) {
    return 'api';
  }

  // Fall back to CLI
  return 'cli';
}

export interface ChatOptions {
  userMessage: string;
  documentContent: string;
  documentTitle?: string;
  onTextChunk?: (text: string) => void;
  onToolCall?: (toolId: string, toolName: string, input: unknown) => void;
  onToolResult?: (toolId: string, toolName: string, result: { success: boolean; message: string }) => void;
  onThinking?: (thinking: string) => void;
  onStats?: (stats: { inputTokens: number; outputTokens: number; durationMs: number }) => void;
}

export interface ChatResult {
  response: string;
  modifiedContent?: string;
  wasModified: boolean;
  backend: ChatBackend;
}

/**
 * Chat with Claude using the configured backend.
 *
 * Automatically selects between API and CLI based on:
 * 1. CHAT_BACKEND environment variable
 * 2. ANTHROPIC_API_KEY availability
 */
export async function chat(options: ChatOptions): Promise<ChatResult> {
  const backend = getChatBackend();

  logger.info({ backend }, 'Using chat backend');

  if (backend === 'api') {
    return chatWithApi(options);
  } else {
    return chatWithCliBackend(options);
  }
}

/**
 * Chat using Anthropic API with tool support
 */
async function chatWithApi(options: ChatOptions): Promise<ChatResult> {
  const { userMessage, documentContent, documentTitle, onTextChunk, onToolCall, onToolResult } = options;

  const result: ChatWithToolsResult = await chatWithTools({
    userMessage,
    documentContent,
    documentTitle,
    onTextChunk,
    onToolCall: onToolCall ? (name, input) => onToolCall(crypto.randomUUID(), name, input) : undefined,
    onToolResult: onToolResult
      ? (name, res) => onToolResult(crypto.randomUUID(), name, { success: res.success, message: res.message })
      : undefined,
  });

  return {
    response: result.response,
    modifiedContent: result.modifiedContent,
    wasModified: result.wasModified,
    backend: 'api',
  };
}

/**
 * Chat using Claude Code CLI with built-in file editing tools.
 *
 * This approach writes the document to a temp file, lets Claude edit it
 * using its native Edit tool, then reads the result back.
 *
 * Now uses stream-json output for real-time visibility into tool usage.
 */
async function chatWithCliBackend(options: ChatOptions): Promise<ChatResult> {
  const { userMessage, documentContent, documentTitle, onTextChunk, onToolCall, onToolResult, onThinking, onStats } =
    options;

  // Check if we should use streaming (preferred) or fallback to basic CLI
  const useStreaming = process.env.CLI_USE_STREAMING !== 'false';

  if (!useStreaming) {
    // Fallback to basic CLI without streaming
    return chatWithCliBasic(options);
  }

  // Import temp file utilities
  const { writeFile, readFile, unlink, mkdtemp } = await import('fs/promises');
  const { join } = await import('path');
  const { tmpdir } = await import('os');

  // Create temp directory and file
  const tempDir = await mkdtemp(join(tmpdir(), 'quill-'));
  const sanitizedTitle = (documentTitle || 'document').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
  const tempFile = join(tempDir, `${sanitizedTitle}.txt`);

  logger.info({ tempFile }, 'Writing document to temp file for CLI stream');

  try {
    // Write document content to temp file
    await writeFile(tempFile, documentContent, 'utf-8');

    // Build system prompt with document context
    const systemPromptAddition = `You are helping edit a document. The document is saved at: ${tempFile}

INSTRUCTIONS:
1. Read the file at ${tempFile} to see the current content
2. Make the requested changes using the Edit tool
3. After editing, briefly confirm what you changed

IMPORTANT: Make changes directly to the file using your Edit tool. Do NOT just describe the changes - actually apply them to the file.`;

    // Track tool calls for correlation
    const toolCallMap = new Map<string, string>();

    // Run CLI with streaming output
    const result: CLIStreamResult = await runCLIStream({
      prompt: sanitizePrompt(userMessage),
      appendSystemPrompt: systemPromptAddition,
      allowedTools: ['Read', 'Edit', 'Write'],
      callbacks: {
        onText: onTextChunk,
        onThinking,
        onToolCall: (toolId, toolName, input) => {
          toolCallMap.set(toolId, toolName);
          onToolCall?.(toolId, toolName, input);
        },
        onToolResult: (toolId, success, content) => {
          const toolName = toolCallMap.get(toolId) || 'unknown';
          onToolResult?.(toolId, toolName, {
            success,
            message: success ? `${toolName} completed` : content.slice(0, 100),
          });
        },
        onStats,
        onError: (error) => {
          logger.error({ error }, 'CLI stream error');
        },
      },
    });

    // Read the modified file
    const modifiedContent = await readFile(tempFile, 'utf-8');
    const wasModified = modifiedContent !== documentContent;

    logger.info(
      { wasModified, originalLength: documentContent.length, newLength: modifiedContent.length },
      'CLI stream file edit complete'
    );

    return {
      response: result.fullText,
      modifiedContent: wasModified ? modifiedContent : undefined,
      wasModified,
      backend: 'cli',
    };
  } finally {
    // Cleanup temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Fallback to basic CLI without streaming (for compatibility).
 */
async function chatWithCliBasic(options: ChatOptions): Promise<ChatResult> {
  const { userMessage, documentContent, documentTitle, onTextChunk, onToolCall, onToolResult } = options;

  // Notify that we're using file-based editing
  const toolId = crypto.randomUUID();
  onToolCall?.(toolId, 'file_edit', { document: documentTitle });

  const result: FileEditResult = await editWithCli({
    userMessage,
    documentContent,
    documentTitle,
    onOutput: onTextChunk,
  });

  // Notify completion
  onToolResult?.(toolId, 'file_edit', {
    success: true,
    message: result.wasModified ? 'Document updated' : 'No changes made',
  });

  return {
    response: result.response,
    modifiedContent: result.wasModified ? result.modifiedContent : undefined,
    wasModified: result.wasModified,
    backend: 'cli',
  };
}
