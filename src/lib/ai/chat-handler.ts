/**
 * Unified chat handler that can use either:
 * 1. Anthropic SDK (API) - requires ANTHROPIC_API_KEY
 * 2. Claude Code CLI - uses user's subscription
 *
 * Set CHAT_BACKEND=cli to use CLI, otherwise defaults to API if key is available.
 */

import { chatWithTools, ChatWithToolsResult } from './tools';
import { editWithCli, FileEditResult } from './cli-file-edit';
import { createLogger } from '@/lib/logger';

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
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolResult?: (toolName: string, result: { success: boolean; message: string }) => void;
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
    onToolCall,
    onToolResult: onToolResult
      ? (name, res) => onToolResult(name, { success: res.success, message: res.message })
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
 */
async function chatWithCliBackend(options: ChatOptions): Promise<ChatResult> {
  const { userMessage, documentContent, documentTitle, onTextChunk, onToolCall, onToolResult } = options;

  // Notify that we're using file-based editing
  onToolCall?.('file_edit', { document: documentTitle });

  const result: FileEditResult = await editWithCli({
    userMessage,
    documentContent,
    documentTitle,
    onOutput: onTextChunk,
  });

  // Notify completion
  onToolResult?.('file_edit', {
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
