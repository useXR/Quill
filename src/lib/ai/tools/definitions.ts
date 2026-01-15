/**
 * Document editing tool definitions for Claude.
 *
 * These tools allow Claude to make precise edits to documents.
 * Claude automatically decides when to use them based on user intent.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages';

/**
 * Tool for replacing text at a specific position in the document.
 */
export const REPLACE_TEXT_TOOL: Tool = {
  name: 'replace_text',
  description: `Replace a specific piece of text in the document with new text. Use this tool when the user wants to:
- Change specific words or phrases (e.g., "change ice cream to Oreos")
- Fix typos or errors
- Update terminology throughout the document
- Reword sentences or paragraphs

You must provide the exact text to find and the replacement text. The tool will replace the FIRST occurrence found. For multiple replacements, call this tool multiple times.

IMPORTANT: Always quote the exact text you want to replace, including punctuation and whitespace.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      find_text: {
        type: 'string',
        description:
          'The exact text to find and replace. Must match exactly including case, punctuation, and whitespace.',
      },
      replace_with: {
        type: 'string',
        description: 'The new text to insert in place of the found text.',
      },
      replace_all: {
        type: 'boolean',
        description:
          'If true, replace ALL occurrences of the text. If false (default), only replace the first occurrence.',
      },
    },
    required: ['find_text', 'replace_with'],
  },
};

/**
 * Tool for inserting text at a specific location.
 */
export const INSERT_TEXT_TOOL: Tool = {
  name: 'insert_text',
  description: `Insert new text at a specific location in the document. Use this tool when the user wants to:
- Add new content to the document
- Insert a new paragraph or sentence
- Add text before or after existing content

Specify either a position to insert at, or text to insert before/after.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      text_to_insert: {
        type: 'string',
        description: 'The new text to insert into the document.',
      },
      insert_after: {
        type: 'string',
        description: 'Insert the new text immediately AFTER this text. The anchor text must match exactly.',
      },
      insert_before: {
        type: 'string',
        description: 'Insert the new text immediately BEFORE this text. The anchor text must match exactly.',
      },
      at_position: {
        type: 'string',
        enum: ['start', 'end'],
        description: 'Insert at the start or end of the document. Use this if no anchor text is appropriate.',
      },
    },
    required: ['text_to_insert'],
  },
};

/**
 * Tool for deleting text from the document.
 */
export const DELETE_TEXT_TOOL: Tool = {
  name: 'delete_text',
  description: `Remove specific text from the document. Use this tool when the user wants to:
- Delete words, sentences, or paragraphs
- Remove redundant content
- Clear specific sections

The text to delete must match exactly. For safety, this tool only deletes the first occurrence unless delete_all is true.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      text_to_delete: {
        type: 'string',
        description: 'The exact text to remove from the document. Must match exactly including case and whitespace.',
      },
      delete_all: {
        type: 'boolean',
        description:
          'If true, delete ALL occurrences of the text. If false (default), only delete the first occurrence.',
      },
    },
    required: ['text_to_delete'],
  },
};

/**
 * Tool for getting a section of the document to understand context.
 */
export const GET_DOCUMENT_SECTION_TOOL: Tool = {
  name: 'get_document_section',
  description: `Retrieve a specific section of the document to better understand the context before making edits. Use this tool when you need to:
- See what text surrounds a particular phrase
- Understand the structure of a section before editing
- Verify exact text before making changes

This is a read-only tool that doesn't modify the document.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      search_text: {
        type: 'string',
        description: 'Text to search for. Returns surrounding context.',
      },
      section: {
        type: 'string',
        enum: ['start', 'end', 'all'],
        description: 'Get content from start, end, or all of the document.',
      },
      char_limit: {
        type: 'number',
        description: 'Maximum characters to return (default 500).',
      },
    },
    required: [],
  },
};

/**
 * All document editing tools.
 */
export const DOCUMENT_TOOLS: Tool[] = [
  REPLACE_TEXT_TOOL,
  INSERT_TEXT_TOOL,
  DELETE_TEXT_TOOL,
  GET_DOCUMENT_SECTION_TOOL,
];
