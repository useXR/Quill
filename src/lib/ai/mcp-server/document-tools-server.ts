#!/usr/bin/env node
/**
 * MCP Server for Document Editing Tools
 *
 * This server exposes document editing tools to Claude Code via the
 * Model Context Protocol (MCP). It communicates via stdio.
 *
 * Tools provided:
 * - replace_text: Replace specific text in the document
 * - insert_text: Insert text at a location
 * - delete_text: Remove text from the document
 * - get_document_section: Read document content
 *
 * Usage:
 *   node document-tools-server.js
 *
 * The server reads document content from stdin and writes tool results to stdout.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';

// In-memory document state (will be set by the parent process)
let documentContent = '';
let documentTitle = 'Untitled';

/**
 * Tool definitions matching our existing tools
 */
const TOOLS: Tool[] = [
  {
    name: 'replace_text',
    description: `Replace a specific piece of text in the document with new text. Use this when the user wants to change words, fix typos, or update terminology. The find_text must match exactly.`,
    inputSchema: {
      type: 'object',
      properties: {
        find_text: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        replace_with: {
          type: 'string',
          description: 'The new text to insert',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences (default: false)',
        },
      },
      required: ['find_text', 'replace_with'],
    },
  },
  {
    name: 'insert_text',
    description: `Insert new text at a specific location in the document. Specify either insert_after, insert_before, or at_position.`,
    inputSchema: {
      type: 'object',
      properties: {
        text_to_insert: {
          type: 'string',
          description: 'The new text to insert',
        },
        insert_after: {
          type: 'string',
          description: 'Insert after this exact text',
        },
        insert_before: {
          type: 'string',
          description: 'Insert before this exact text',
        },
        at_position: {
          type: 'string',
          enum: ['start', 'end'],
          description: 'Insert at start or end of document',
        },
      },
      required: ['text_to_insert'],
    },
  },
  {
    name: 'delete_text',
    description: `Remove specific text from the document. The text must match exactly.`,
    inputSchema: {
      type: 'object',
      properties: {
        text_to_delete: {
          type: 'string',
          description: 'The exact text to remove',
        },
        delete_all: {
          type: 'boolean',
          description: 'Delete all occurrences (default: false)',
        },
      },
      required: ['text_to_delete'],
    },
  },
  {
    name: 'get_document_section',
    description: `Read a section of the document. Use to understand context before making edits.`,
    inputSchema: {
      type: 'object',
      properties: {
        search_text: {
          type: 'string',
          description: 'Text to search for (returns surrounding context)',
        },
        section: {
          type: 'string',
          enum: ['start', 'end', 'all'],
          description: 'Get content from start, end, or all',
        },
        char_limit: {
          type: 'number',
          description: 'Maximum characters to return (default: 500)',
        },
      },
    },
  },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Execute a tool and return the result
 */
function executeTool(
  name: string,
  args: Record<string, unknown>
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  switch (name) {
    case 'replace_text': {
      const findText = args.find_text as string;
      const replaceWith = args.replace_with as string;
      const replaceAll = (args.replace_all as boolean) || false;

      if (!documentContent.includes(findText)) {
        return {
          content: [{ type: 'text', text: `Error: Text not found: "${findText.slice(0, 50)}..."` }],
          isError: true,
        };
      }

      let count = 1;
      if (replaceAll) {
        const regex = new RegExp(escapeRegex(findText), 'g');
        count = (documentContent.match(regex) || []).length;
        documentContent = documentContent.replace(regex, replaceWith);
      } else {
        documentContent = documentContent.replace(findText, replaceWith);
      }

      return {
        content: [{ type: 'text', text: `Replaced ${count} occurrence(s). Document updated.` }],
      };
    }

    case 'insert_text': {
      const textToInsert = args.text_to_insert as string;
      const insertAfter = args.insert_after as string | undefined;
      const insertBefore = args.insert_before as string | undefined;
      const atPosition = args.at_position as 'start' | 'end' | undefined;

      if (atPosition === 'start') {
        documentContent = textToInsert + documentContent;
      } else if (atPosition === 'end') {
        documentContent = documentContent + textToInsert;
      } else if (insertAfter) {
        if (!documentContent.includes(insertAfter)) {
          return {
            content: [{ type: 'text', text: `Error: Anchor text not found: "${insertAfter.slice(0, 50)}..."` }],
            isError: true,
          };
        }
        documentContent = documentContent.replace(insertAfter, insertAfter + textToInsert);
      } else if (insertBefore) {
        if (!documentContent.includes(insertBefore)) {
          return {
            content: [{ type: 'text', text: `Error: Anchor text not found: "${insertBefore.slice(0, 50)}..."` }],
            isError: true,
          };
        }
        documentContent = documentContent.replace(insertBefore, textToInsert + insertBefore);
      } else {
        return {
          content: [{ type: 'text', text: 'Error: Must specify insert_after, insert_before, or at_position' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Inserted ${textToInsert.length} characters. Document updated.` }],
      };
    }

    case 'delete_text': {
      const textToDelete = args.text_to_delete as string;
      const deleteAll = (args.delete_all as boolean) || false;

      if (!documentContent.includes(textToDelete)) {
        return {
          content: [{ type: 'text', text: `Error: Text not found: "${textToDelete.slice(0, 50)}..."` }],
          isError: true,
        };
      }

      let count = 1;
      if (deleteAll) {
        const regex = new RegExp(escapeRegex(textToDelete), 'g');
        count = (documentContent.match(regex) || []).length;
        documentContent = documentContent.replace(regex, '');
      } else {
        documentContent = documentContent.replace(textToDelete, '');
      }

      return {
        content: [{ type: 'text', text: `Deleted ${count} occurrence(s). Document updated.` }],
      };
    }

    case 'get_document_section': {
      const searchText = args.search_text as string | undefined;
      const section = args.section as 'start' | 'end' | 'all' | undefined;
      const charLimit = (args.char_limit as number) || 500;

      if (searchText) {
        const index = documentContent.indexOf(searchText);
        if (index === -1) {
          return {
            content: [{ type: 'text', text: `Text not found: "${searchText.slice(0, 50)}..."` }],
            isError: true,
          };
        }

        const contextStart = Math.max(0, index - Math.floor(charLimit / 2));
        const contextEnd = Math.min(documentContent.length, index + searchText.length + Math.floor(charLimit / 2));
        const context = documentContent.slice(contextStart, contextEnd);
        const prefix = contextStart > 0 ? '...' : '';
        const suffix = contextEnd < documentContent.length ? '...' : '';

        return {
          content: [{ type: 'text', text: `${prefix}${context}${suffix}` }],
        };
      }

      if (section === 'start') {
        const content = documentContent.slice(0, charLimit);
        const suffix = documentContent.length > charLimit ? '...' : '';
        return {
          content: [{ type: 'text', text: `${content}${suffix}` }],
        };
      }

      if (section === 'end') {
        const start = Math.max(0, documentContent.length - charLimit);
        const prefix = start > 0 ? '...' : '';
        return {
          content: [{ type: 'text', text: `${prefix}${documentContent.slice(start)}` }],
        };
      }

      // Return all or up to limit
      const content = documentContent.slice(0, charLimit);
      const suffix = documentContent.length > charLimit ? '...' : '';
      return {
        content: [
          {
            type: 'text',
            text: `Document "${documentTitle}" (${documentContent.length} chars):\n\n${content}${suffix}`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

/**
 * Main server setup
 */
async function main() {
  const server = new Server(
    {
      name: 'quill-document-tools',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle call_tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return executeTool(name, args as Record<string, unknown>);
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Read initial document content from environment or first stdin message
  if (process.env.DOCUMENT_CONTENT) {
    documentContent = process.env.DOCUMENT_CONTENT;
  }
  if (process.env.DOCUMENT_TITLE) {
    documentTitle = process.env.DOCUMENT_TITLE;
  }
}

main().catch(console.error);
