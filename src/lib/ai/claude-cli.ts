/**
 * Claude CLI wrapper with process management and retry logic.
 *
 * This module spawns Claude CLI subprocesses, parses their streaming JSON output,
 * handles errors, and implements retry logic for transient failures.
 */
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import type { ClaudeRequest, ClaudeResponse, CLIStatus, AIProvider } from './types';
import { categorizeError, isRetryableError } from './errors';
import { sanitizePrompt, sanitizeContext } from './sanitize';
import { AI } from '@/lib/constants/ai';

const execPromise = promisify(exec);

/**
 * Manages Claude CLI process lifecycle, queuing, and retry logic.
 */
class ClaudeProcessManager {
  private activeProcess: ChildProcess | null = null;
  private queue: Array<{
    request: ClaudeRequest;
    resolve: (response: ClaudeResponse) => void;
  }> = [];
  private processing = false;

  /**
   * Queue a request for Claude CLI invocation.
   */
  async invoke(request: ClaudeRequest): Promise<ClaudeResponse> {
    return new Promise((resolve) => {
      this.queue.push({ request, resolve });
      this.processQueue();
    });
  }

  /**
   * Process queued requests sequentially.
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { request, resolve } = this.queue.shift()!;

    try {
      const response = await this.executeWithRetry(request);
      resolve(response);
    } catch (error) {
      resolve({
        content: '',
        error: categorizeError(error as Error),
      });
    } finally {
      this.processing = false;
      this.activeProcess = null;
      this.processQueue();
    }
  }

  /**
   * Execute with retry logic for transient failures.
   */
  private async executeWithRetry(request: ClaudeRequest, attempt = 0): Promise<ClaudeResponse> {
    const response = await this.execute(request);

    if (response.error && isRetryableError(response.error) && attempt < AI.MAX_RETRIES) {
      const delay = response.error.retryAfterMs || AI.RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return this.executeWithRetry(request, attempt + 1);
    }

    return response;
  }

  /**
   * Execute a single Claude CLI invocation.
   */
  private execute(request: ClaudeRequest): Promise<ClaudeResponse> {
    const { prompt, context, timeout = AI.DEFAULT_TIMEOUT_MS } = request;

    return new Promise((resolve) => {
      try {
        const sanitizedPrompt = sanitizePrompt(prompt);
        const sanitizedContext = context ? sanitizeContext(context) : undefined;

        const args = ['-p', sanitizedPrompt, '--output-format', 'stream-json'];
        if (sanitizedContext) {
          args.push('--context', sanitizedContext);
        }

        this.activeProcess = spawn('claude', args, {
          timeout,
          shell: false,
          env: { PATH: process.env.PATH, HOME: process.env.HOME } as unknown as NodeJS.ProcessEnv,
        });

        let output = '';
        let errorOutput = '';
        let content = '';

        this.activeProcess.stdout!.on('data', (data) => {
          output += data.toString();
          const lines = output.split('\n');
          output = lines.pop() || '';

          for (const line of lines.filter(Boolean)) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.content) {
                content += parsed.content;
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        });

        this.activeProcess.stderr!.on('data', (data) => {
          errorOutput += data.toString();
        });

        this.activeProcess!.on('close', (code) => {
          // Only treat as error if exit code is non-zero
          // stderr with exit code 0 (warnings) should not be treated as errors
          if (code !== 0) {
            const error = categorizeError(errorOutput || `Exit code ${code}`, content);
            resolve({
              content: error.partialContent || '',
              partial: !!error.partialContent,
              error,
            });
          } else {
            resolve({ content });
          }
        });

        this.activeProcess!.on('error', (err) => {
          resolve({
            content: '',
            error: categorizeError(err, content),
          });
        });
      } catch (err) {
        resolve({
          content: '',
          error: categorizeError(err as Error),
        });
      }
    });
  }

  /**
   * Cancel any in-progress CLI operation.
   */
  cancel(): void {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
  }
}

const processManager = new ClaudeProcessManager();

/**
 * Invoke Claude CLI with a prompt and optional context.
 *
 * @param request - The request containing prompt, context, and timeout
 * @returns A response with content or error information
 */
export async function invokeClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  return processManager.invoke(request);
}

/**
 * Cancel any in-progress Claude CLI operation.
 */
export function cancelClaude(): void {
  processManager.cancel();
}

/**
 * Compare semantic versions.
 * Returns true if version is less than minVersion.
 */
function isVersionLessThan(version: string, minVersion: string): boolean {
  const vParts = version.split('.').map(Number);
  const mParts = minVersion.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const v = vParts[i] || 0;
    const m = mParts[i] || 0;
    if (v < m) return true;
    if (v > m) return false;
  }
  return false;
}

/**
 * Validate Claude CLI installation, version, and authentication status.
 *
 * @returns A CLIStatus object indicating the current state of the CLI
 */
export async function validateClaudeCLI(): Promise<CLIStatus> {
  try {
    const { stdout } = await execPromise('claude --version');
    const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);

    if (!versionMatch) {
      return { status: 'error', message: 'Could not parse CLI version' };
    }

    const version = versionMatch[1];

    if (isVersionLessThan(version, AI.MINIMUM_CLI_VERSION)) {
      return {
        status: 'outdated',
        version,
        message: `Claude CLI ${version} found, but ${AI.MINIMUM_CLI_VERSION}+ required`,
      };
    }

    try {
      await execPromise('claude -p "test" --max-turns 1', { timeout: AI.CLI_AUTH_TEST_TIMEOUT_MS });
      return { status: 'ready', version };
    } catch {
      return { status: 'auth_required', version, message: 'Please run: claude login' };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { status: 'not_installed' };
    }
    return { status: 'error', message: err.message };
  }
}

/**
 * Claude CLI provider implementing the AIProvider interface.
 *
 * This class wraps the CLI functions to provide a consistent interface
 * that can be swapped with other providers (e.g., direct API) in the future.
 */
export class ClaudeCLIProvider implements AIProvider {
  /**
   * Generate a complete response from Claude CLI.
   */
  async generate(request: ClaudeRequest): Promise<ClaudeResponse> {
    return invokeClaude(request);
  }

  /**
   * Stream response chunks from Claude CLI.
   * Note: Use streamClaude for actual streaming implementation.
   */
  async *stream(_request: ClaudeRequest): AsyncIterable<string> {
    throw new Error('Use streamClaude for streaming');
  }

  /**
   * Cancel any in-progress CLI operation.
   */
  cancel(): void {
    cancelClaude();
  }

  /**
   * Get the current CLI status including version and authentication state.
   */
  getStatus(): Promise<CLIStatus> {
    return validateClaudeCLI();
  }
}
