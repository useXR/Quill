/**
 * Claude Code CLI integration using built-in file editing tools.
 *
 * This approach:
 * 1. Writes document content to a temp file
 * 2. Tells Claude to edit that file using its built-in Edit/Write tools
 * 3. Reads the modified file back
 *
 * This leverages Claude Code's native file editing capabilities
 * (using your subscription) without needing custom MCP servers.
 */

import { spawn } from 'child_process';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createLogger } from '@/lib/logger';
import { sanitizePrompt } from './sanitize';

const logger = createLogger({ module: 'cli-file-edit' });

export interface FileEditOptions {
  userMessage: string;
  documentContent: string;
  documentTitle?: string;
  timeout?: number;
  onOutput?: (text: string) => void;
}

export interface FileEditResult {
  response: string;
  modifiedContent: string;
  wasModified: boolean;
}

/**
 * Use Claude Code CLI to edit a document using its built-in file tools.
 *
 * This uses your Claude subscription (not API credits).
 */
export async function editWithCli(options: FileEditOptions): Promise<FileEditResult> {
  const { userMessage, documentContent, documentTitle = 'document', timeout = 120000, onOutput } = options;

  // Create temp directory and file
  const tempDir = await mkdtemp(join(tmpdir(), 'quill-'));
  const tempFile = join(tempDir, `${sanitizeFilename(documentTitle)}.txt`);

  logger.info({ tempFile }, 'Writing document to temp file');

  try {
    // Write document content to temp file
    await writeFile(tempFile, documentContent, 'utf-8');

    // Build system prompt addition with document context
    const systemPromptAddition = `You are helping edit a document. The document is saved at: ${tempFile}

INSTRUCTIONS:
1. Read the file at ${tempFile} to see the current content
2. Make the requested changes using the Edit tool
3. After editing, briefly confirm what you changed

IMPORTANT: Make changes directly to the file using your Edit tool. Do NOT just describe the changes - actually apply them to the file.`;

    // Run Claude CLI with file editing tools enabled
    const result = await runClaude({
      prompt: sanitizePrompt(userMessage),
      appendSystemPrompt: systemPromptAddition,
      allowedTools: ['Read', 'Edit', 'Write'],
      timeout,
      onOutput,
    });

    // Read the modified file
    const modifiedContent = await readFile(tempFile, 'utf-8');
    const wasModified = modifiedContent !== documentContent;

    logger.info(
      { wasModified, originalLength: documentContent.length, newLength: modifiedContent.length },
      'File edit complete'
    );

    return {
      response: result.output,
      modifiedContent,
      wasModified,
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

interface RunClaudeOptions {
  prompt: string;
  appendSystemPrompt?: string;
  allowedTools?: string[];
  timeout?: number;
  onOutput?: (text: string) => void;
}

interface RunClaudeResult {
  output: string;
  exitCode: number;
}

/**
 * Run Claude CLI and capture output
 */
function runClaude(options: RunClaudeOptions): Promise<RunClaudeResult> {
  const { prompt, appendSystemPrompt, allowedTools = [], timeout = 120000, onOutput } = options;

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      prompt,
      '--output-format',
      'text',
      '--no-session-persistence',
      '--dangerously-skip-permissions', // Allow file edits without prompts
    ];

    // Append to system prompt (preserves Claude Code's default prompt)
    if (appendSystemPrompt) {
      args.push('--append-system-prompt', appendSystemPrompt);
    }

    // Add allowed tools if specified
    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }

    logger.info({ promptLength: prompt.length, allowedTools }, 'Starting Claude CLI');

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
      reject(new Error('Claude CLI timeout'));
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0 && code !== null) {
        logger.warn({ code, stderr }, 'Claude CLI exited with non-zero code');
      }

      resolve({
        output: stdout,
        exitCode: code ?? 0,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Sanitize filename for temp file
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50) || 'document';
}
