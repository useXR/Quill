/**
 * Claude Code CLI integration with structured edit commands.
 *
 * Uses Claude Code CLI with --json-schema to get structured edit
 * instructions that we execute locally. This uses the user's
 * Claude subscription instead of API credits.
 */

import { spawn } from 'child_process';
import { createLogger } from '@/lib/logger';
import { sanitizePrompt, sanitizeContext } from './sanitize';

const logger = createLogger({ module: 'cli-tools' });

/**
 * Schema for edit commands that Claude can return
 */
export const EDIT_COMMAND_SCHEMA = {
  type: 'object',
  properties: {
    thinking: {
      type: 'string',
      description: 'Brief explanation of what changes to make',
    },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['replace', 'insert', 'delete'],
          },
          find_text: {
            type: 'string',
            description: 'Text to find (for replace/delete)',
          },
          new_text: {
            type: 'string',
            description: 'Replacement or insertion text',
          },
          position: {
            type: 'string',
            enum: ['before', 'after', 'start', 'end'],
            description: 'For insert: where to place new_text relative to find_text',
          },
          replace_all: {
            type: 'boolean',
            description: 'Replace/delete all occurrences',
          },
        },
        required: ['action'],
      },
    },
    response: {
      type: 'string',
      description: 'Natural language response to show the user',
    },
  },
  required: ['response'],
};

/**
 * A single edit command
 */
export interface EditCommand {
  action: 'replace' | 'insert' | 'delete';
  find_text?: string;
  new_text?: string;
  position?: 'before' | 'after' | 'start' | 'end';
  replace_all?: boolean;
}

/**
 * Structured response from Claude
 */
export interface StructuredEditResponse {
  thinking?: string;
  edits?: EditCommand[];
  response: string;
}

/**
 * Result of executing edits
 */
export interface EditExecutionResult {
  success: boolean;
  newContent: string;
  editsApplied: number;
  errors: string[];
}

/**
 * Execute edit commands on document content
 */
export function executeEdits(content: string, edits: EditCommand[]): EditExecutionResult {
  let newContent = content;
  let editsApplied = 0;
  const errors: string[] = [];

  for (const edit of edits) {
    try {
      switch (edit.action) {
        case 'replace': {
          if (!edit.find_text) {
            errors.push('Replace action requires find_text');
            continue;
          }
          if (!newContent.includes(edit.find_text)) {
            errors.push(`Text not found: "${edit.find_text.slice(0, 30)}..."`);
            continue;
          }
          if (edit.replace_all) {
            const regex = new RegExp(escapeRegex(edit.find_text), 'g');
            newContent = newContent.replace(regex, edit.new_text || '');
          } else {
            newContent = newContent.replace(edit.find_text, edit.new_text || '');
          }
          editsApplied++;
          break;
        }

        case 'insert': {
          if (!edit.new_text) {
            errors.push('Insert action requires new_text');
            continue;
          }
          if (edit.position === 'start') {
            newContent = edit.new_text + newContent;
          } else if (edit.position === 'end') {
            newContent = newContent + edit.new_text;
          } else if (edit.find_text) {
            if (!newContent.includes(edit.find_text)) {
              errors.push(`Anchor text not found: "${edit.find_text.slice(0, 30)}..."`);
              continue;
            }
            if (edit.position === 'before') {
              newContent = newContent.replace(edit.find_text, edit.new_text + edit.find_text);
            } else {
              newContent = newContent.replace(edit.find_text, edit.find_text + edit.new_text);
            }
          } else {
            errors.push('Insert requires position (start/end) or find_text with position (before/after)');
            continue;
          }
          editsApplied++;
          break;
        }

        case 'delete': {
          if (!edit.find_text) {
            errors.push('Delete action requires find_text');
            continue;
          }
          if (!newContent.includes(edit.find_text)) {
            errors.push(`Text not found: "${edit.find_text.slice(0, 30)}..."`);
            continue;
          }
          if (edit.replace_all) {
            const regex = new RegExp(escapeRegex(edit.find_text), 'g');
            newContent = newContent.replace(regex, '');
          } else {
            newContent = newContent.replace(edit.find_text, '');
          }
          editsApplied++;
          break;
        }
      }
    } catch (err) {
      errors.push(`Error executing ${edit.action}: ${err}`);
    }
  }

  return {
    success: errors.length === 0,
    newContent,
    editsApplied,
    errors,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Options for chat with CLI
 */
export interface ChatWithCliOptions {
  userMessage: string;
  documentContent: string;
  documentTitle?: string;
  timeout?: number;
}

/**
 * Result from CLI chat
 */
export interface ChatWithCliResult {
  response: string;
  edits?: EditCommand[];
  executionResult?: EditExecutionResult;
  rawOutput?: string;
}

/**
 * Chat with Claude Code CLI using structured output for document editing.
 *
 * Uses the user's Claude subscription via the CLI instead of API credits.
 */
export async function chatWithCli(options: ChatWithCliOptions): Promise<ChatWithCliResult> {
  const { userMessage, documentContent, documentTitle = 'Untitled', timeout = 120000 } = options;

  const systemPrompt = `You are a document editing assistant. The user is working on a document titled "${documentTitle}".

DOCUMENT CONTENT:
${documentContent}

When the user asks you to edit the document, include an "edits" array with specific edit commands.
When just discussing or answering questions, only include a "response".

Edit command format:
- action: "replace" - find_text + new_text (set replace_all for all occurrences)
- action: "insert" - new_text + either (position: "start"/"end") or (find_text + position: "before"/"after")
- action: "delete" - find_text (set replace_all for all occurrences)

Always include a friendly "response" explaining what you did or answering their question.`;

  const sanitizedMessage = sanitizePrompt(userMessage);

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      sanitizedMessage,
      '--system-prompt',
      systemPrompt,
      '--json-schema',
      JSON.stringify(EDIT_COMMAND_SCHEMA),
      '--output-format',
      'json',
      '--no-session-persistence',
      '--tools',
      '', // Disable tools - we only want text output
    ];

    logger.info({ userMessage: sanitizedMessage.slice(0, 50) }, 'Starting CLI chat');

    const proc = spawn('claude', args, {
      shell: false,
      env: process.env as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin?.end();

    let stdout = '';
    let stderr = '';

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('CLI timeout'));
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        logger.error({ code, stderr }, 'CLI exited with error');
        reject(new Error(stderr || `CLI exited with code ${code}`));
        return;
      }

      try {
        // Parse the JSON output
        const parsed = JSON.parse(stdout) as StructuredEditResponse;

        const result: ChatWithCliResult = {
          response: parsed.response,
          edits: parsed.edits,
          rawOutput: stdout,
        };

        // Execute edits if any
        if (parsed.edits && parsed.edits.length > 0) {
          result.executionResult = executeEdits(documentContent, parsed.edits);
          logger.info(
            { editsApplied: result.executionResult.editsApplied, errors: result.executionResult.errors },
            'Edits executed'
          );
        }

        resolve(result);
      } catch (err) {
        logger.error({ err, stdout }, 'Failed to parse CLI output');
        // Return raw response if JSON parsing fails
        resolve({
          response: stdout,
          rawOutput: stdout,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}
