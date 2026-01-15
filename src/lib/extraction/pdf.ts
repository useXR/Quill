import { spawn, type ChildProcess } from 'child_process';
import { writeFile, unlink, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import pdfParse from 'pdf-parse';
import { vaultLogger } from '@/lib/logger';
import type { Section } from './chunker';

/**
 * Result of PDF extraction with structured sections.
 * Uses Section interface from chunker for consistency.
 */
export interface PdfExtractionResult {
  text: string;
  markdown: string;
  sections: Section[];
  success: boolean;
  error?: string;
  pageCount?: number;
}

/**
 * Legacy interface for backward compatibility.
 */
export interface ExtractionResult {
  text: string;
  success: boolean;
  error?: string;
  pageCount?: number;
}

/**
 * Options for PDF extraction.
 */
export interface PdfExtractionOptions {
  /** Use pdf-parse fallback if Python extraction fails (default: true) */
  useFallback?: boolean;
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
}

/**
 * Feature flag for pymupdf4llm extraction.
 * Set FEATURE_PYMUPDF_EXTRACTION=true to enable (disabled by default for safe rollout).
 *
 * NOTE: Feature is OPT-IN for gradual rollout. Set FEATURE_PYMUPDF_EXTRACTION=true
 * after validating in test environment.
 */
const USE_PYMUPDF = process.env.FEATURE_PYMUPDF_EXTRACTION === 'true';

/**
 * Path to the Python extraction script.
 *
 * IMPORTANT for serverless deployments: process.cwd() may not point to the application
 * root in environments like Vercel. Use PDF_EXTRACT_SCRIPT env var to specify the
 * absolute path to the script in production.
 */
const PYTHON_SCRIPT = process.env.PDF_EXTRACT_SCRIPT || join(process.cwd(), 'scripts', 'extract_pdf.py');

/**
 * Path to Python executable.
 * Uses venv Python by default if it exists, otherwise falls back to system python3.
 * Can be overridden with PYTHON_PATH env var.
 */
const PYTHON_VENV = join(process.cwd(), 'scripts', 'venv', 'bin', 'python3');
const PYTHON_PATH = process.env.PYTHON_PATH || PYTHON_VENV;

/**
 * Default timeout for Python subprocess (2 minutes).
 */
const DEFAULT_TIMEOUT_MS = 120000;

const log = vaultLogger({});

/**
 * Extracts text from PDF using legacy pdf-parse library.
 * Used as fallback when Python extraction fails.
 */
export async function extractPdfTextLegacy(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const result = await pdfParse(buffer);
    return {
      text: result.text,
      success: true,
      pageCount: result.numpages,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    log.error({ error: errorMessage }, 'Legacy PDF extraction failed');
    return {
      text: '',
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Extracts text and structure from a PDF buffer using pymupdf4llm.
 * Falls back to pdf-parse if Python extraction fails (unless disabled).
 *
 * @param buffer - The PDF file as a Buffer
 * @param options - Extraction options
 * @returns PdfExtractionResult with markdown, sections, and text
 */
export async function extractPdfText(buffer: Buffer, options: PdfExtractionOptions = {}): Promise<PdfExtractionResult> {
  const { useFallback = true, timeout = DEFAULT_TIMEOUT_MS } = options;

  // Handle empty buffer
  if (!buffer || buffer.length === 0) {
    log.warn('PDF extraction failed: empty buffer');
    return {
      text: '',
      markdown: '',
      sections: [],
      success: false,
      error: 'Empty buffer provided',
    };
  }

  // Skip pymupdf4llm if feature flag is disabled
  if (!USE_PYMUPDF) {
    log.info('pymupdf4llm disabled, using pdf-parse');
    return convertLegacyResult(await extractPdfTextLegacy(buffer));
  }

  let tempDir: string | null = null;
  let tempFile: string | null = null;

  try {
    // Create temp file for the PDF
    tempDir = await mkdtemp(join(tmpdir(), 'quill-pdf-'));
    tempFile = join(tempDir, 'input.pdf');
    await writeFile(tempFile, buffer, { mode: 0o600 }); // Restrictive permissions

    // Call Python script
    const result = await runPythonExtraction(tempFile, timeout);

    if (result.success) {
      return result;
    }

    // Python failed - try fallback if enabled
    if (useFallback) {
      log.warn({ error: result.error }, 'pymupdf4llm failed, falling back to pdf-parse');
      return convertLegacyResult(await extractPdfTextLegacy(buffer));
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    log.error({ error: errorMessage }, 'PDF extraction failed');

    // Try fallback on any error
    if (useFallback) {
      log.warn('Attempting pdf-parse fallback after error');
      try {
        return convertLegacyResult(await extractPdfTextLegacy(buffer));
      } catch (fallbackErr) {
        log.error({ error: fallbackErr }, 'Fallback also failed');
      }
    }

    return {
      text: '',
      markdown: '',
      sections: [],
      success: false,
      error: errorMessage,
    };
  } finally {
    // Cleanup temp files
    if (tempFile) {
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Converts legacy ExtractionResult to PdfExtractionResult.
 */
function convertLegacyResult(legacy: ExtractionResult): PdfExtractionResult {
  return {
    text: legacy.text,
    markdown: legacy.text, // No markdown formatting from pdf-parse
    sections: [], // No section awareness from pdf-parse
    success: legacy.success,
    error: legacy.error,
    pageCount: legacy.pageCount,
  };
}

/**
 * Runs the Python extraction script and parses output.
 * Implements proper timeout handling with SIGTERM/SIGKILL.
 */
async function runPythonExtraction(pdfPath: string, timeout: number): Promise<PdfExtractionResult> {
  return new Promise((resolve) => {
    let resolved = false;
    let proc: ChildProcess | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let killTimeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (killTimeoutId) clearTimeout(killTimeoutId);
    };

    const resolveOnce = (result: PdfExtractionResult) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    try {
      log.info({ pythonPath: PYTHON_PATH, script: PYTHON_SCRIPT }, 'Spawning Python extraction');
      proc = spawn(PYTHON_PATH, [PYTHON_SCRIPT, pdfPath]);
    } catch (err) {
      resolveOnce({
        text: '',
        markdown: '',
        sections: [],
        success: false,
        error: `Failed to spawn Python: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
      return;
    }

    let stdout = '';
    let stderr = '';

    // Set up timeout with SIGTERM, then SIGKILL
    timeoutId = setTimeout(() => {
      log.warn({ timeout }, 'Python extraction timed out, sending SIGTERM');
      proc?.kill('SIGTERM');

      // Give it 5 seconds to cleanup, then force kill
      killTimeoutId = setTimeout(() => {
        // Check if already resolved to avoid incorrect warning log
        if (!resolved) {
          log.warn('Python process did not exit, sending SIGKILL');
          proc?.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      log.error({ error: err.message }, 'Failed to spawn Python process');
      resolveOnce({
        text: '',
        markdown: '',
        sections: [],
        success: false,
        error: `Failed to run Python script: ${err.message}. Is python3 installed?`,
      });
    });

    proc.on('close', (code) => {
      if (resolved) return; // Already handled by error event

      cleanup();

      if (code !== 0) {
        log.error({ code, stderr }, 'Python script exited with error');
        resolveOnce({
          text: '',
          markdown: '',
          sections: [],
          success: false,
          error: stderr || `Python script exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);

        if (!result.success) {
          resolveOnce({
            text: '',
            markdown: '',
            sections: [],
            success: false,
            error: result.error || 'Extraction failed',
          });
          return;
        }

        // Convert markdown to plain text for backward compatibility
        const plainText = result.markdown
          .replace(/^#{1,6}\s+/gm, '') // Remove heading markers
          .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.+?)\*/g, '$1') // Remove italic
          .replace(/`(.+?)`/g, '$1') // Remove code
          .trim();

        resolveOnce({
          text: plainText,
          markdown: result.markdown,
          sections: result.sections || [],
          success: true,
          pageCount: result.page_count,
        });
      } catch (parseErr) {
        log.error({ error: parseErr, stdout: stdout.slice(0, 500) }, 'Failed to parse Python output');
        resolveOnce({
          text: '',
          markdown: '',
          sections: [],
          success: false,
          error: `Failed to parse extraction output: ${parseErr instanceof Error ? parseErr.message : 'invalid JSON'}`,
        });
      }
    });
  });
}
