import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Use vi.hoisted to define mocks before they're used in vi.mock (which is hoisted)
const mocks = vi.hoisted(() => {
  return {
    spawn: vi.fn(),
    mockPdfParse: vi.fn(),
  };
});

// Mock child_process - provide our own minimal mock with default export
vi.mock('child_process', () => {
  const mockModule = {
    spawn: mocks.spawn,
    ChildProcess: class {},
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Mock pdf-parse for fallback tests
vi.mock('pdf-parse', () => ({
  default: mocks.mockPdfParse,
}));

// Helper to create a mock process with proper async event emission
function createMockProcess(stdout: string, stderr: string, exitCode: number) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  // Emit events asynchronously (like real spawn)
  setImmediate(() => {
    if (stdout) proc.stdout.emit('data', stdout);
    if (stderr) proc.stderr.emit('data', stderr);
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('PDF extraction with pymupdf4llm', () => {
  const originalEnv = process.env.FEATURE_PYMUPDF_EXTRACTION;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Enable the pymupdf4llm feature for these tests
    process.env.FEATURE_PYMUPDF_EXTRACTION = 'true';
    // Set up pdf-parse mock implementation for fallback tests
    mocks.mockPdfParse.mockImplementation(async (buffer: Buffer) => {
      if (buffer.length === 0) {
        throw new Error('Empty buffer');
      }
      return { text: 'Fallback extracted text', numpages: 1 };
    });
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.FEATURE_PYMUPDF_EXTRACTION;
    } else {
      process.env.FEATURE_PYMUPDF_EXTRACTION = originalEnv;
    }
  });

  it('extracts text and sections from valid PDF', async () => {
    const mockOutput = JSON.stringify({
      success: true,
      markdown: '# Introduction\n\nThis is the intro.\n\n## Methods\n\nThis is methods.',
      sections: [
        {
          level: 1,
          title: 'Introduction',
          heading_context: 'Introduction',
          content: 'This is the intro.',
          start_line: 0,
        },
        {
          level: 2,
          title: 'Methods',
          heading_context: 'Introduction > Methods',
          content: 'This is methods.',
          start_line: 4,
        },
      ],
      page_count: 5,
      error: null,
    });

    mocks.spawn.mockImplementation(() => createMockProcess(mockOutput, '', 0) as any);

    // Dynamic import after setting env var
    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf content'));

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Introduction');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading_context).toBe('Introduction');
    expect(result.pageCount).toBeDefined();
    expect(result.pageCount).toBe(5);
  });

  it('handles Python script errors gracefully', async () => {
    mocks.spawn.mockImplementation(() => createMockProcess('', 'Python error', 1) as any);

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf content'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles empty buffer', async () => {
    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.alloc(0));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Empty buffer');
  });

  it('preserves heading context in sections', async () => {
    const mockOutput = JSON.stringify({
      success: true,
      markdown: '# Methods\n\n## Participants\n\nContent here.',
      sections: [
        { level: 1, title: 'Methods', heading_context: 'Methods', content: '', start_line: 0 },
        {
          level: 2,
          title: 'Participants',
          heading_context: 'Methods > Participants',
          content: 'Content here.',
          start_line: 2,
        },
      ],
      page_count: 1,
      error: null,
    });

    mocks.spawn.mockImplementation(() => createMockProcess(mockOutput, '', 0) as any);

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf'));

    expect(result.sections[1].heading_context).toBe('Methods > Participants');
  });

  it('handles PDF with no extractable text (image-only)', async () => {
    const mockOutput = JSON.stringify({
      success: true,
      markdown: '',
      sections: [],
      page_count: 5,
      error: null,
    });

    mocks.spawn.mockImplementation(() => createMockProcess(mockOutput, '', 0) as any);

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf'));

    expect(result.success).toBe(true);
    expect(result.markdown).toBe('');
    expect(result.sections).toHaveLength(0);
    expect(result.pageCount).toBe(5);
  });

  it('handles invalid JSON output from Python', async () => {
    mocks.spawn.mockImplementation(() => createMockProcess('not valid json {{{', '', 0) as any);

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain('parse');
  });

  it('handles truncated JSON output from Python', async () => {
    mocks.spawn.mockImplementation(() => createMockProcess('{"success": true, "markdown": "...', '', 0) as any);

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles spawn error (Python not found)', async () => {
    mocks.spawn.mockImplementation(() => {
      const proc = new EventEmitter() as any;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn();

      setImmediate(() => {
        proc.emit('error', new Error('spawn python3 ENOENT'));
      });

      return proc;
    });

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('pdf'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain('python');
  });

  it('falls back to pdf-parse when Python fails and fallback enabled', async () => {
    mocks.spawn.mockImplementation(() => createMockProcess('', 'Python crashed', 1) as any);

    const { extractPdfText } = await import('../pdf');
    const result = await extractPdfText(Buffer.from('valid pdf content'), { useFallback: true });

    // Should succeed via pdf-parse fallback
    expect(result.success).toBe(true);
    expect(result.text).toBe('Fallback extracted text');
    // Verify fallback result shape
    expect(result.sections).toHaveLength(0); // Fallback has no section awareness
    expect(result.markdown).toBe('Fallback extracted text'); // markdown equals text for fallback
    // Verify mockPdfParse was called
    expect(mocks.mockPdfParse).toHaveBeenCalled();
  });
});

describe('Legacy PDF extraction (pdf-parse)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Disable pymupdf feature for legacy tests
    delete process.env.FEATURE_PYMUPDF_EXTRACTION;
    // Set up pdf-parse mock implementation
    mocks.mockPdfParse.mockImplementation(async (buffer: Buffer) => {
      if (buffer.length === 0) {
        throw new Error('Empty buffer');
      }
      return { text: 'Fallback extracted text', numpages: 1 };
    });
  });

  it('extracts text from valid PDF buffer', async () => {
    const { extractPdfTextLegacy } = await import('../pdf');
    const result = await extractPdfTextLegacy(Buffer.from('mock pdf'));

    expect(result.success).toBe(true);
    expect(result.text).toBe('Fallback extracted text');
    expect(mocks.mockPdfParse).toHaveBeenCalled();
  });

  it('handles empty buffer', async () => {
    const { extractPdfTextLegacy } = await import('../pdf');
    const result = await extractPdfTextLegacy(Buffer.alloc(0));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Empty buffer');
  });
});
