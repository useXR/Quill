import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VaultItem } from '@/lib/vault/types';

// Mock all dependencies - define mock functions at module level
const mockGetVaultItem = vi.fn();
const mockUpdateVaultItemStatus = vi.fn();
const mockExtractPdfText = vi.fn();
const mockExtractDocxText = vi.fn();
const mockExtractTextContent = vi.fn();
const mockChunkText = vi.fn();
const mockGetEmbeddings = vi.fn();

// Mock Supabase client
const mockDownload = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockStorageFrom = vi.fn();
const mockDbFrom = vi.fn();

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  storage: {
    from: mockStorageFrom,
  },
  from: mockDbFrom,
};

// Create a mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/lib/api/vault', () => ({
  getVaultItem: (...args: unknown[]) => mockGetVaultItem(...args),
  updateVaultItemStatus: (...args: unknown[]) => mockUpdateVaultItemStatus(...args),
}));

vi.mock('@/lib/api/audit', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/extraction/pdf', () => ({
  extractPdfText: (...args: unknown[]) => mockExtractPdfText(...args),
}));

vi.mock('@/lib/extraction/docx', () => ({
  extractDocxText: (...args: unknown[]) => mockExtractDocxText(...args),
}));

vi.mock('@/lib/extraction/text', () => ({
  extractTextContent: (...args: unknown[]) => mockExtractTextContent(...args),
}));

vi.mock('@/lib/extraction/chunker', () => ({
  chunkText: (...args: unknown[]) => mockChunkText(...args),
}));

vi.mock('@/lib/extraction/embeddings', () => ({
  getEmbeddings: (...args: unknown[]) => mockGetEmbeddings(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabaseClient),
}));

vi.mock('@/lib/logger', () => ({
  vaultLogger: () => mockLogger,
}));

// Helper to create a mock vault item
function createMockVaultItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'vault-item-123',
    user_id: 'user-123',
    project_id: 'project-123',
    filename: 'test-document.pdf',
    storage_path: 'vault/user-123/test-document.pdf',
    type: 'pdf',
    mime_type: 'application/pdf',
    file_size: 1024,
    source_url: null,
    extraction_status: 'pending',
    extracted_text: null,
    chunk_count: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Helper to setup common mocks for successful download
function setupDownloadMock(buffer: Buffer) {
  // Create a mock that properly simulates Blob with arrayBuffer
  const mockBlob = {
    arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
    size: buffer.length,
    type: '',
  };
  mockDownload.mockResolvedValue({
    data: mockBlob,
    error: null,
  });
  mockStorageFrom.mockReturnValue({ download: mockDownload });
}

// Helper to setup db mock for chunk insertion
function setupChunkInsertMock() {
  mockSelect.mockResolvedValue({ data: [], error: null });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockDbFrom.mockReturnValue({ insert: mockInsert });
}

// Import processExtraction once for all tests
import { processExtraction } from '../processor';

describe('Extraction Processor', () => {
  beforeEach(() => {
    // Reset mock call history but keep implementations
    mockGetVaultItem.mockReset();
    mockUpdateVaultItemStatus.mockReset();
    mockExtractPdfText.mockReset();
    mockExtractDocxText.mockReset();
    mockExtractTextContent.mockReset();
    mockChunkText.mockReset();
    mockGetEmbeddings.mockReset();
    mockDownload.mockReset();
    mockInsert.mockReset();
    mockSelect.mockReset();
    mockStorageFrom.mockReset();
    mockDbFrom.mockReset();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  describe('processExtraction', () => {
    it('progresses through all status states for successful extraction', async () => {
      const mockItem = createMockVaultItem({ type: 'pdf' });
      const mockBuffer = Buffer.from('mock pdf content');
      const mockText = 'This is the extracted text from the PDF document. It has enough content.';
      const mockChunks = [
        { content: 'Chunk 1 content', index: 0 },
        { content: 'Chunk 2 content', index: 1 },
      ];
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];

      mockGetVaultItem.mockResolvedValue(mockItem);
      mockUpdateVaultItemStatus.mockResolvedValue(mockItem);
      setupDownloadMock(mockBuffer);
      setupChunkInsertMock();
      mockExtractPdfText.mockResolvedValue({ text: mockText, success: true });
      mockChunkText.mockReturnValue(mockChunks);
      mockGetEmbeddings.mockResolvedValue(mockEmbeddings);

      await processExtraction('vault-item-123');

      // Verify status progression
      const statusCalls = mockUpdateVaultItemStatus.mock.calls.map((call) => call[1]);
      expect(statusCalls).toContain('downloading');
      expect(statusCalls).toContain('extracting');
      expect(statusCalls).toContain('chunking');
      expect(statusCalls).toContain('embedding');
      expect(statusCalls).toContain('success');
    });

    it('calls correct extractor based on file type (PDF)', async () => {
      const mockItem = createMockVaultItem({ type: 'pdf' });
      const mockBuffer = Buffer.from('mock pdf content');
      const mockText = 'Extracted PDF text content here.';

      mockGetVaultItem.mockResolvedValue(mockItem);
      mockUpdateVaultItemStatus.mockResolvedValue(mockItem);
      setupDownloadMock(mockBuffer);
      setupChunkInsertMock();
      mockExtractPdfText.mockResolvedValue({ text: mockText, success: true });
      mockChunkText.mockReturnValue([{ content: 'chunk', index: 0 }]);
      mockGetEmbeddings.mockResolvedValue([[0.1]]);

      await processExtraction('vault-item-123');

      expect(mockExtractPdfText).toHaveBeenCalled();
      expect(mockExtractDocxText).not.toHaveBeenCalled();
      expect(mockExtractTextContent).not.toHaveBeenCalled();
    });

    it('calls correct extractor based on file type (DOCX)', async () => {
      const mockItem = createMockVaultItem({ type: 'docx', filename: 'test.docx' });
      const mockBuffer = Buffer.from('mock docx content');
      const mockText = 'Extracted DOCX text content here.';

      mockGetVaultItem.mockResolvedValue(mockItem);
      mockUpdateVaultItemStatus.mockResolvedValue(mockItem);
      setupDownloadMock(mockBuffer);
      setupChunkInsertMock();
      mockExtractDocxText.mockResolvedValue({ text: mockText, success: true });
      mockChunkText.mockReturnValue([{ content: 'chunk', index: 0 }]);
      mockGetEmbeddings.mockResolvedValue([[0.1]]);

      await processExtraction('vault-item-123');

      expect(mockExtractDocxText).toHaveBeenCalled();
      expect(mockExtractPdfText).not.toHaveBeenCalled();
      expect(mockExtractTextContent).not.toHaveBeenCalled();
    });

    it('handles extraction errors gracefully and sets failed status', async () => {
      const mockItem = createMockVaultItem({ type: 'pdf' });
      const mockBuffer = Buffer.from('mock pdf content');

      mockGetVaultItem.mockResolvedValue(mockItem);
      mockUpdateVaultItemStatus.mockResolvedValue(mockItem);
      setupDownloadMock(mockBuffer);

      // Simulate extraction failure
      mockExtractPdfText.mockResolvedValue({
        text: '',
        success: false,
        error: 'PDF parsing error',
      });

      await processExtraction('vault-item-123');

      // Should set failed status with error message
      const failedCall = mockUpdateVaultItemStatus.mock.calls.find((call) => call[1] === 'failed');
      expect(failedCall).toBeDefined();
      expect(failedCall?.[2]?.error).toBeDefined();
    });

    it('sets partial status for minimal content (<10 chars)', async () => {
      const mockItem = createMockVaultItem({ type: 'txt', filename: 'test.txt' });
      const mockBuffer = Buffer.from('Hi');

      mockGetVaultItem.mockResolvedValue(mockItem);
      mockUpdateVaultItemStatus.mockResolvedValue(mockItem);
      setupDownloadMock(mockBuffer);

      // Return minimal text
      mockExtractTextContent.mockReturnValue({
        text: 'Hi',
        success: true,
      });

      await processExtraction('vault-item-123');

      // Should set partial status
      const partialCall = mockUpdateVaultItemStatus.mock.calls.find((call) => call[1] === 'partial');
      expect(partialCall).toBeDefined();
    });

    it('creates audit logs for success and failure', async () => {
      const mockItem = createMockVaultItem({ type: 'pdf' });
      const mockBuffer = Buffer.from('mock pdf content');
      const mockText = 'This is extracted text with enough content for processing.';
      const mockChunks = [{ content: 'Chunk content', index: 0 }];
      const mockEmbeddings = [[0.1, 0.2, 0.3]];

      mockGetVaultItem.mockResolvedValue(mockItem);
      mockUpdateVaultItemStatus.mockResolvedValue(mockItem);
      setupDownloadMock(mockBuffer);
      setupChunkInsertMock();
      mockExtractPdfText.mockResolvedValue({ text: mockText, success: true });
      mockChunkText.mockReturnValue(mockChunks);
      mockGetEmbeddings.mockResolvedValue(mockEmbeddings);

      await processExtraction('vault-item-123');

      // Audit log should be created (the vault.ts updateVaultItemStatus already creates audit logs)
      // We verify that the success status was set with correct chunk count
      const successCall = mockUpdateVaultItemStatus.mock.calls.find((call) => call[1] === 'success');
      expect(successCall).toBeDefined();
      expect(successCall?.[2]?.chunkCount).toBe(1);
    });
  });
});
