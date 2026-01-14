export const FILE_SIZE_LIMITS = {
  pdf: 100 * 1024 * 1024, // 100 MB
  docx: 50 * 1024 * 1024, // 50 MB
  txt: 10 * 1024 * 1024, // 10 MB
} as const;

export const TOTAL_STORAGE_PER_USER = 1024 * 1024 * 1024; // 1 GB
export const TOTAL_STORAGE_PER_PROJECT = 500 * 1024 * 1024; // 500 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const FILE_TYPE_MAP: Record<string, keyof typeof FILE_SIZE_LIMITS> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
};

export const CHUNK_CONFIG = {
  maxSize: 2000, // chars per chunk (optimized for academic text)
  overlap: 200, // 10% overlap for context preservation
  minSize: 50, // minimum chunk size to avoid empty chunks
} as const;

export const EXTRACTION_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 2000,
  maxRetryDelayMs: 30000, // Cap exponential backoff at 30s
  timeoutMs: 120000, // 2 minutes max per file
} as const;

export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
  maxTokensPerChunk: 8191,
} as const;

export type FileType = keyof typeof FILE_SIZE_LIMITS;

export const RETENTION = {
  SOFT_DELETE_GRACE_PERIOD_DAYS: 7,
  AUDIT_LOGS_DAYS: 90,
} as const;
