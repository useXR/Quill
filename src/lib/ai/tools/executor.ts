/**
 * Tool executor for document editing tools.
 *
 * Executes tool calls from Claude and returns results.
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'tool-executor' });

/**
 * Result of a tool execution.
 */
export interface ToolResult {
  success: boolean;
  message: string;
  /** The modified document content (only for mutating tools) */
  newContent?: string;
  /** Data returned by the tool (for read-only tools) */
  data?: unknown;
}

/**
 * Input for replace_text tool.
 */
interface ReplaceTextInput {
  find_text: string;
  replace_with: string;
  replace_all?: boolean;
}

/**
 * Input for insert_text tool.
 */
interface InsertTextInput {
  text_to_insert: string;
  insert_after?: string;
  insert_before?: string;
  at_position?: 'start' | 'end';
}

/**
 * Input for delete_text tool.
 */
interface DeleteTextInput {
  text_to_delete: string;
  delete_all?: boolean;
}

/**
 * Input for get_document_section tool.
 */
interface GetDocumentSectionInput {
  search_text?: string;
  section?: 'start' | 'end' | 'all';
  char_limit?: number;
}

/**
 * Execute a tool call and return the result.
 */
export function executeTool(toolName: string, input: unknown, documentContent: string): ToolResult {
  logger.info({ toolName, input }, 'Executing tool');

  switch (toolName) {
    case 'replace_text':
      return executeReplaceText(input as ReplaceTextInput, documentContent);
    case 'insert_text':
      return executeInsertText(input as InsertTextInput, documentContent);
    case 'delete_text':
      return executeDeleteText(input as DeleteTextInput, documentContent);
    case 'get_document_section':
      return executeGetDocumentSection(input as GetDocumentSectionInput, documentContent);
    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      };
  }
}

/**
 * Execute replace_text tool.
 */
function executeReplaceText(input: ReplaceTextInput, content: string): ToolResult {
  const { find_text, replace_with, replace_all = false } = input;

  if (!content.includes(find_text)) {
    return {
      success: false,
      message: `Text not found in document: "${find_text.slice(0, 50)}${find_text.length > 50 ? '...' : ''}"`,
    };
  }

  let newContent: string;
  let count: number;

  if (replace_all) {
    const regex = new RegExp(escapeRegex(find_text), 'g');
    count = (content.match(regex) || []).length;
    newContent = content.replace(regex, replace_with);
  } else {
    count = 1;
    newContent = content.replace(find_text, replace_with);
  }

  logger.info({ find_text: find_text.slice(0, 30), replace_with: replace_with.slice(0, 30), count }, 'Text replaced');

  return {
    success: true,
    message: `Replaced ${count} occurrence${count > 1 ? 's' : ''} of "${find_text.slice(0, 30)}${find_text.length > 30 ? '...' : ''}" with "${replace_with.slice(0, 30)}${replace_with.length > 30 ? '...' : ''}"`,
    newContent,
  };
}

/**
 * Execute insert_text tool.
 */
function executeInsertText(input: InsertTextInput, content: string): ToolResult {
  const { text_to_insert, insert_after, insert_before, at_position } = input;

  let newContent: string;
  let position: string;

  if (at_position === 'start') {
    newContent = text_to_insert + content;
    position = 'at start';
  } else if (at_position === 'end') {
    newContent = content + text_to_insert;
    position = 'at end';
  } else if (insert_after) {
    if (!content.includes(insert_after)) {
      return {
        success: false,
        message: `Anchor text not found: "${insert_after.slice(0, 50)}${insert_after.length > 50 ? '...' : ''}"`,
      };
    }
    newContent = content.replace(insert_after, insert_after + text_to_insert);
    position = `after "${insert_after.slice(0, 30)}${insert_after.length > 30 ? '...' : ''}"`;
  } else if (insert_before) {
    if (!content.includes(insert_before)) {
      return {
        success: false,
        message: `Anchor text not found: "${insert_before.slice(0, 50)}${insert_before.length > 50 ? '...' : ''}"`,
      };
    }
    newContent = content.replace(insert_before, text_to_insert + insert_before);
    position = `before "${insert_before.slice(0, 30)}${insert_before.length > 30 ? '...' : ''}"`;
  } else {
    return {
      success: false,
      message: 'Must specify insert_after, insert_before, or at_position',
    };
  }

  logger.info({ text_length: text_to_insert.length, position }, 'Text inserted');

  return {
    success: true,
    message: `Inserted ${text_to_insert.length} characters ${position}`,
    newContent,
  };
}

/**
 * Execute delete_text tool.
 */
function executeDeleteText(input: DeleteTextInput, content: string): ToolResult {
  const { text_to_delete, delete_all = false } = input;

  if (!content.includes(text_to_delete)) {
    return {
      success: false,
      message: `Text not found in document: "${text_to_delete.slice(0, 50)}${text_to_delete.length > 50 ? '...' : ''}"`,
    };
  }

  let newContent: string;
  let count: number;

  if (delete_all) {
    const regex = new RegExp(escapeRegex(text_to_delete), 'g');
    count = (content.match(regex) || []).length;
    newContent = content.replace(regex, '');
  } else {
    count = 1;
    newContent = content.replace(text_to_delete, '');
  }

  logger.info({ text_length: text_to_delete.length, count }, 'Text deleted');

  return {
    success: true,
    message: `Deleted ${count} occurrence${count > 1 ? 's' : ''} of "${text_to_delete.slice(0, 30)}${text_to_delete.length > 30 ? '...' : ''}"`,
    newContent,
  };
}

/**
 * Execute get_document_section tool.
 */
function executeGetDocumentSection(input: GetDocumentSectionInput, content: string): ToolResult {
  const { search_text, section, char_limit = 500 } = input;

  if (search_text) {
    const index = content.indexOf(search_text);
    if (index === -1) {
      return {
        success: false,
        message: `Text not found: "${search_text.slice(0, 50)}${search_text.length > 50 ? '...' : ''}"`,
      };
    }

    // Get context around the found text
    const contextStart = Math.max(0, index - Math.floor(char_limit / 2));
    const contextEnd = Math.min(content.length, index + search_text.length + Math.floor(char_limit / 2));
    const context = content.slice(contextStart, contextEnd);

    return {
      success: true,
      message: `Found text at position ${index}`,
      data: {
        context,
        position: index,
        prefix: contextStart > 0 ? '...' : '',
        suffix: contextEnd < content.length ? '...' : '',
      },
    };
  }

  if (section === 'start') {
    return {
      success: true,
      message: `First ${char_limit} characters of document`,
      data: {
        content: content.slice(0, char_limit),
        suffix: content.length > char_limit ? '...' : '',
      },
    };
  }

  if (section === 'end') {
    const start = Math.max(0, content.length - char_limit);
    return {
      success: true,
      message: `Last ${char_limit} characters of document`,
      data: {
        content: content.slice(start),
        prefix: start > 0 ? '...' : '',
      },
    };
  }

  // Return all or up to limit
  return {
    success: true,
    message: `Document content (${content.length} characters)`,
    data: {
      content: content.slice(0, char_limit),
      total_length: content.length,
      suffix: content.length > char_limit ? '...' : '',
    },
  };
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
