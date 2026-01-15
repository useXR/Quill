/**
 * Chat handler with tool support using Anthropic SDK.
 *
 * This module handles chat requests with automatic tool calling
 * for document editing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { DOCUMENT_TOOLS } from './definitions';
import { executeTool, ToolResult } from './executor';
import { createLogger } from '@/lib/logger';
import type {
  MessageParam,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';

const logger = createLogger({ module: 'chat-with-tools' });

/**
 * Options for chat with tools.
 */
export interface ChatWithToolsOptions {
  /** The user's message */
  userMessage: string;
  /** Current document content (plain text) */
  documentContent: string;
  /** Document title for context */
  documentTitle?: string;
  /** Callback for streaming text chunks */
  onTextChunk?: (text: string) => void;
  /** Callback when a tool is called */
  onToolCall?: (toolName: string, input: unknown) => void;
  /** Callback when a tool completes */
  onToolResult?: (toolName: string, result: ToolResult) => void;
  /** Maximum tool calls before stopping (safety limit) */
  maxToolCalls?: number;
}

/**
 * Result of chat with tools.
 */
export interface ChatWithToolsResult {
  /** The assistant's final text response */
  response: string;
  /** The modified document content (if any edits were made) */
  modifiedContent?: string;
  /** Whether the document was modified */
  wasModified: boolean;
  /** List of tool calls made */
  toolCalls: Array<{ name: string; input: unknown; result: ToolResult }>;
}

/**
 * Handle a chat request with automatic tool calling.
 *
 * This function:
 * 1. Sends the user message to Claude with document context
 * 2. If Claude wants to use a tool, executes it and continues
 * 3. Loops until Claude provides a final response (no more tool calls)
 * 4. Returns the response and any document modifications
 */
export async function chatWithTools(options: ChatWithToolsOptions): Promise<ChatWithToolsResult> {
  const {
    userMessage,
    documentContent,
    documentTitle = 'Untitled',
    onTextChunk,
    onToolCall,
    onToolResult,
    maxToolCalls = 10,
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  // Track document state for tool execution
  let currentContent = documentContent;
  let wasModified = false;
  const toolCalls: Array<{ name: string; input: unknown; result: ToolResult }> = [];

  // Build conversation history
  const messages: MessageParam[] = [
    {
      role: 'user',
      content: userMessage,
    },
  ];

  // System prompt with document context
  const systemPrompt = `You are a helpful AI assistant for academic grant writing. You have access to the user's document and can make edits using the provided tools.

## Current Document: "${documentTitle}"

${documentContent}

## Instructions

- When the user asks you to edit, change, or modify the document, use the appropriate tool (replace_text, insert_text, or delete_text).
- For simple questions or discussions about the document, respond conversationally without using tools.
- When making edits, be precise with the text you're searching for - it must match exactly.
- After making edits, briefly confirm what you changed.
- If you're unsure about exact text, use get_document_section to check first.`;

  let finalResponse = '';
  let toolCallCount = 0;

  // Tool loop - continue until Claude stops using tools
  while (toolCallCount < maxToolCalls) {
    logger.info({ messageCount: messages.length, toolCallCount }, 'Sending message to Claude');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: DOCUMENT_TOOLS,
      messages,
    });

    // Process response content
    const assistantContent: ContentBlock[] = [];
    let hasToolUse = false;

    for (const block of response.content) {
      assistantContent.push(block);

      if (block.type === 'text') {
        finalResponse += block.text;
        onTextChunk?.(block.text);
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        toolCallCount++;

        const toolUse = block as ToolUseBlock;
        logger.info({ toolName: toolUse.name, input: toolUse.input }, 'Tool called');
        onToolCall?.(toolUse.name, toolUse.input);

        // Execute the tool
        const result = executeTool(toolUse.name, toolUse.input, currentContent);

        // Update document content if modified
        if (result.success && result.newContent !== undefined) {
          currentContent = result.newContent;
          wasModified = true;
        }

        toolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          result,
        });

        onToolResult?.(toolUse.name, result);
      }
    }

    // Add assistant response to messages
    messages.push({
      role: 'assistant',
      content: assistantContent,
    });

    // If no tool use, we're done
    if (!hasToolUse || response.stop_reason === 'end_turn') {
      break;
    }

    // Build tool results for the next turn
    const toolResults: ToolResultBlockParam[] = [];
    for (const block of assistantContent) {
      if (block.type === 'tool_use') {
        const toolUse = block as ToolUseBlock;
        const call = toolCalls.find(
          (c) => c.name === toolUse.name && JSON.stringify(c.input) === JSON.stringify(toolUse.input)
        );

        if (call) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: call.result.success
              ? call.result.message + (call.result.data ? '\n' + JSON.stringify(call.result.data) : '')
              : `Error: ${call.result.message}`,
          });
        }
      }
    }

    // Add tool results as user message
    messages.push({
      role: 'user',
      content: toolResults,
    });
  }

  if (toolCallCount >= maxToolCalls) {
    logger.warn({ maxToolCalls }, 'Reached maximum tool calls limit');
  }

  return {
    response: finalResponse,
    modifiedContent: wasModified ? currentContent : undefined,
    wasModified,
    toolCalls,
  };
}
