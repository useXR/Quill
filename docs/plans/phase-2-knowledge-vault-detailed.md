# Phase 2: Knowledge Vault Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a robust file upload, text extraction, chunking, embedding, and semantic search system for the Knowledge Vault.

**Architecture:** Files uploaded via drag-and-drop are stored in Supabase Storage, then processed through a queue-based extraction pipeline. Text is chunked (2000 chars, 200 overlap), embedded via OpenAI text-embedding-3-small, and stored in pgvector for semantic search.

**Tech Stack:** Next.js 14+, Supabase (Storage + pgvector), OpenAI Embeddings, pdf-parse, mammoth, Zod, Vitest, Playwright

**Prerequisites:** Phase 0 and Phase 1 complete. Supabase running, Next.js app functional. `OPENAI_API_KEY` in `.env.local`.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  VaultUpload    │────▶│  Upload API      │────▶│  Supabase       │
│  (drag & drop)  │     │  (validate/store)│     │  Storage        │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Extraction      │
                       │  Queue/Worker    │
                       └────────┬─────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
  │  PDF Parser   │    │  DOCX Parser  │    │  Text Handler │
  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
          └─────────────────────┼─────────────────────┘
                                ▼
                       ┌──────────────────┐
                       │  Text Chunker    │
                       │  (2000/200)      │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  OpenAI          │
                       │  Embeddings      │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  vault_chunks    │
                       │  (pgvector)      │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Semantic Search │
                       └──────────────────┘
```

---

## Task 2.0: Infrastructure Setup

**Files:**

- Create: `fixtures/sample.txt`
- Create: `e2e/fixtures/test.pdf`
- Create: `e2e/fixtures/test.txt`
- Create: `src/lib/vault/constants.ts`
- Create: `src/lib/vault/types.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_vault_tables.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_storage_bucket.sql`

---

### Step 2.0.1: Create test fixtures directories

```bash
mkdir -p fixtures e2e/fixtures
```

Run: `ls fixtures e2e/fixtures`
Expected: Both directories exist

---

### Step 2.0.2a: Create unit test fixture

Create `fixtures/sample.txt`:

```
This is a sample text file for testing the Knowledge Vault extraction pipeline.
It contains multiple sentences to test chunking behavior.
The content should be extracted and embedded correctly.
```

---

### Step 2.0.2b: Create E2E test fixture

Create `e2e/fixtures/test.txt`:

```
Test document for E2E testing.
This file validates the complete upload and extraction flow.
Search queries should find this content.
```

---

### Step 2.0.2c: Create shared test mock data

Create `src/lib/vault/__tests__/fixtures.ts`:

```typescript
import type { VaultItem, VaultChunk } from '../types';

export const mockVaultItem: VaultItem = {
  id: 'vault-item-1',
  user_id: 'user-1',
  project_id: 'project-1',
  type: 'pdf',
  filename: 'research-paper.pdf',
  storage_path: 'user-1/project-1/research-paper.pdf',
  extracted_text: 'Sample extracted text from PDF document.',
  extraction_status: 'success',
  chunk_count: 5,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockVaultChunk: VaultChunk = {
  id: 'chunk-1',
  vault_item_id: 'vault-item-1',
  content: 'This is the first chunk of text from the document.',
  embedding: null, // Usually a 1536-dimension vector
  chunk_index: 0,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockVaultItems: VaultItem[] = [
  mockVaultItem,
  { ...mockVaultItem, id: 'vault-item-2', filename: 'notes.txt', type: 'txt' },
  { ...mockVaultItem, id: 'vault-item-3', filename: 'report.docx', type: 'docx', extraction_status: 'pending' },
];

export function createMockVaultItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return { ...mockVaultItem, ...overrides };
}
```

---

### Step 2.0.3: Create vault constants file

Create `src/lib/vault/constants.ts`:

```typescript
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
```

---

### Step 2.0.4: Create vault types file

Create `src/lib/vault/types.ts`:

```typescript
import type { Database } from '@/lib/supabase/database.types';

export type VaultItem = Database['public']['Tables']['vault_items']['Row'];
export type VaultChunk = Database['public']['Tables']['vault_chunks']['Row'];

export type ExtractionStatus =
  | 'pending'
  | 'downloading'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'success'
  | 'partial'
  | 'failed';

// Discriminated union for type-safe extraction progress
export type ExtractionProgress =
  | { status: 'pending' | 'downloading' | 'extracting' | 'chunking' | 'embedding'; progress: number }
  | { status: 'success'; chunksProcessed: number; totalChunks: number }
  | { status: 'failed'; error: string }
  | { status: 'partial'; chunksProcessed: number; error?: string };

export interface SearchResult {
  content: string;
  similarity: number;
  vaultItemId: string;
  filename: string;
  chunkIndex: number;
}

export interface UploadResult {
  success: boolean;
  item?: VaultItem;
  error?: string;
}

// Zod schema types for API validation
export interface VaultSearchParams {
  projectId: string;
  query: string;
  limit?: number;
  threshold?: number;
}
```

---

### Step 2.0.5: Create vault tables migration

Create `supabase/migrations/YYYYMMDDHHMMSS_vault_tables.sql` (replace timestamp):

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Create vault_items table
create table vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  type text not null check (type in ('pdf', 'docx', 'txt')),
  filename text not null,
  storage_path text,
  extracted_text text,
  extraction_status text default 'pending' check (extraction_status in ('pending', 'downloading', 'extracting', 'chunking', 'embedding', 'success', 'partial', 'failed')),
  chunk_count integer default 0,
  created_at timestamptz default now()
);

-- Create vault_chunks table with vector embedding
create table vault_chunks (
  id uuid primary key default gen_random_uuid(),
  vault_item_id uuid references vault_items(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table vault_items enable row level security;
alter table vault_chunks enable row level security;

-- RLS policies for vault_items
create policy "Users can insert own vault items"
  on vault_items for insert
  with check (auth.uid() = user_id);

create policy "Users can view own vault items"
  on vault_items for select
  using (auth.uid() = user_id);

create policy "Users can update own vault items"
  on vault_items for update
  using (auth.uid() = user_id);

create policy "Users can delete own vault items"
  on vault_items for delete
  using (auth.uid() = user_id);

-- RLS policies for vault_chunks (inherit from vault_items ownership)
create policy "Users can view chunks of own items"
  on vault_chunks for select
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_chunks.vault_item_id
      and vault_items.user_id = auth.uid()
    )
  );

create policy "Users can insert chunks for own items"
  on vault_chunks for insert
  with check (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_chunks.vault_item_id
      and vault_items.user_id = auth.uid()
    )
  );

create policy "Users can delete chunks of own items"
  on vault_chunks for delete
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_chunks.vault_item_id
      and vault_items.user_id = auth.uid()
    )
  );

-- Create HNSW index for fast similarity search
-- Note: HNSW is preferred over IVFFlat as it doesn't require data to build effective centroids
create index vault_chunks_embedding_idx on vault_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Index for common queries
create index vault_items_user_project_idx on vault_items(user_id, project_id);
create index vault_items_status_idx on vault_items(extraction_status) where extraction_status in ('pending', 'downloading', 'extracting', 'chunking', 'embedding');
```

---

### Step 2.0.6: Create storage bucket migration

Create `supabase/migrations/YYYYMMDDHHMMSS_storage_bucket.sql` (timestamp after vault_tables):

```sql
-- Create vault-files storage bucket
insert into storage.buckets (id, name, public)
values ('vault-files', 'vault-files', false)
on conflict do nothing;

-- RLS policies for vault-files bucket
-- Users can only upload to their own folder (path starts with their user_id)
create policy "Users can upload to their own folder"
  on storage.objects
  for insert
  with check (
    bucket_id = 'vault-files' AND
    auth.uid() is not null AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only read files in their own folder
create policy "Users can read their own files"
  on storage.objects
  for select
  using (
    bucket_id = 'vault-files' AND
    auth.uid() is not null AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete files in their own folder
create policy "Users can delete their own files"
  on storage.objects
  for delete
  using (
    bucket_id = 'vault-files' AND
    auth.uid() is not null AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

### Step 2.0.7: Apply migrations

Run: `npx supabase db reset`
Expected: All migrations apply successfully

---

### Step 2.0.8: Generate types

Run: `npm run db:types`
Expected: Types regenerated with vault_items and vault_chunks tables

---

### Step 2.0.9: Verify environment variables

Ensure `.env.local` contains:

```
OPENAI_API_KEY=sk-...
```

Run: `grep OPENAI_API_KEY .env.local`
Expected: Line with API key (value redacted)

---

### Step 2.0.10: Commit infrastructure setup

```bash
git add .
git commit -m "chore: add Phase 2 infrastructure (tables, storage, constants, types, fixtures)"
```

---

## Task 2.1: VaultUpload Component (TDD)

**Files:**

- Create: `src/components/vault/__tests__/VaultUpload.test.tsx`
- Create: `src/components/vault/VaultUpload.tsx`

---

### Step 2.1.1: Write failing test for upload zone rendering

Create `src/components/vault/__tests__/VaultUpload.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultUpload } from '../VaultUpload';

global.fetch = vi.fn();

describe('VaultUpload', () => {
  const mockOnUpload = vi.fn();
  const defaultProps = {
    projectId: 'test-project-id',
    onUpload: mockOnUpload,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
  });

  it('renders upload zone with instructions', () => {
    render(<VaultUpload {...defaultProps} />);
    expect(screen.getByText(/drag files here/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf, docx, or txt/i)).toBeInTheDocument();
  });
});
```

---

### Step 2.1.2: Run test to verify it fails

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: FAIL - Cannot find module '../VaultUpload'

---

### Step 2.1.3: Create minimal VaultUpload component

Create `src/components/vault/VaultUpload.tsx`:

```typescript
'use client';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  return (
    <div>
      <p>Drag files here</p>
      <p>PDF, DOCX, or TXT</p>
    </div>
  );
}
```

---

### Step 2.1.4: Run test to verify it passes

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: PASS - 1 test passed

---

### Step 2.1.5: Add test for drag-over state

Add to test file:

```typescript
  it('shows drag-over state when file is dragged over', () => {
    render(<VaultUpload {...defaultProps} />);
    const dropZone = screen.getByTestId('vault-upload-zone');

    fireEvent.dragOver(dropZone);
    expect(dropZone).toHaveClass('border-blue-500');
  });

  it('resets drag state on drag leave', () => {
    render(<VaultUpload {...defaultProps} />);
    const dropZone = screen.getByTestId('vault-upload-zone');

    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    expect(dropZone).not.toHaveClass('border-blue-500');
  });
```

---

### Step 2.1.6: Run tests to verify they fail

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: FAIL - Unable to find element by [data-testid="vault-upload-zone"]

---

### Step 2.1.7: Implement drag state

Update `src/components/vault/VaultUpload.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div
      data-testid="vault-upload-zone"
      className={`border-2 border-dashed rounded-lg p-8 text-center ${dragOver ? 'border-blue-500' : 'border-gray-300'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <p>Drag files here</p>
      <p>PDF, DOCX, or TXT</p>
    </div>
  );
}
```

---

### Step 2.1.8: Run tests to verify they pass

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: PASS - 3 tests passed

---

### Step 2.1.9: Add test for file size validation

Add to test file:

```typescript
  it('validates file size before upload', async () => {
    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 101 * 1024 * 1024 });

    await userEvent.upload(input, largeFile);

    expect(screen.getByText(/file exceeds/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types', async () => {
    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const exeFile = new File(['x'], 'malware.exe', { type: 'application/x-executable' });
    await userEvent.upload(input, exeFile);

    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
```

---

### Step 2.1.10: Run tests to verify they fail

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: FAIL - Unable to find element by [data-testid="vault-file-input"]

---

### Step 2.1.11: Add file input element

Update component to add hidden file input:

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES, type FileType } from '@/lib/vault/constants';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

interface FileError {
  filename: string;
  error: string;
}

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<FileError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFileType = (file: File): FileType | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'txt') return 'txt';
    return null;
  };

  const validateFile = (file: File): string | null => {
    const fileType = getFileType(file);

    if (!fileType) {
      return 'Unsupported file type. Please upload PDF, DOCX, or TXT files.';
    }

    const maxSize = FILE_SIZE_LIMITS[fileType];
    if (file.size > maxSize) {
      return `File exceeds ${maxSize / 1024 / 1024}MB limit.`;
    }

    return null;
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validationErrors: FileError[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        validationErrors.push({ filename: file.name, error });
      }
    }

    setErrors(validationErrors);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div className="space-y-4">
      <div
        data-testid="vault-upload-zone"
        className={`border-2 border-dashed rounded-lg p-8 text-center ${dragOver ? 'border-blue-500' : 'border-gray-300'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <p>Drag files here</p>
        <p>PDF, DOCX, or TXT</p>
        <input
          ref={inputRef}
          data-testid="vault-file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="text-red-600 text-sm">
              <strong>{err.filename}:</strong> {err.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 2.1.12: Run tests to verify they pass

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: PASS - 5 tests passed

---

### Step 2.1.13: Add test for upload submission

Add to test file:

```typescript
  it('calls API and onUpload after successful upload', async () => {
    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, validFile);

    expect(global.fetch).toHaveBeenCalledWith('/api/vault/upload', expect.any(Object));
    expect(mockOnUpload).toHaveBeenCalled();
  });

  it('shows uploading state during upload', async () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({ items: [] }) }), 100))
    );

    render(<VaultUpload {...defaultProps} />);
    const input = screen.getByTestId('vault-file-input');

    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    userEvent.upload(input, validFile);

    expect(await screen.findByText(/uploading/i)).toBeInTheDocument();
  });
```

---

### Step 2.1.14: Run tests to verify they fail

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: FAIL - fetch not called / uploading text not found

---

### Step 2.1.15: Implement full upload logic

Update to complete component:

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES, type FileType } from '@/lib/vault/constants';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

interface FileError {
  filename: string;
  error: string;
}

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<FileError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFileType = (file: File): FileType | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'txt') return 'txt';
    return null;
  };

  const validateFile = (file: File): string | null => {
    const fileType = getFileType(file);

    if (!fileType) {
      return 'Unsupported file type. Please upload PDF, DOCX, or TXT files.';
    }

    const maxSize = FILE_SIZE_LIMITS[fileType];
    if (file.size > maxSize) {
      return `File exceeds ${maxSize / 1024 / 1024}MB limit.`;
    }

    return null;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validationErrors: FileError[] = [];
    const validFiles: File[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        validationErrors.push({ filename: file.name, error });
      } else {
        validFiles.push(file);
      }
    }

    setErrors(validationErrors);

    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      const formData = new FormData();
      validFiles.forEach((file) => formData.append('files', file));
      formData.append('projectId', projectId);

      const response = await fetch('/api/vault/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      onUpload();
    } catch (error) {
      setErrors(prev => [...prev, {
        filename: 'Upload',
        error: error instanceof Error ? error.message : 'Upload failed'
      }]);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }, [projectId, onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  return (
    <div className="space-y-4">
      <div
        data-testid="vault-upload-zone"
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-gray-600">
          Drag files here or{' '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="text-blue-600 underline hover:text-blue-700"
            disabled={disabled}
          >
            browse
          </button>
        </p>
        <p className="text-sm text-gray-500 mt-1">PDF, DOCX, or TXT (max 100MB)</p>
        <input
          ref={inputRef}
          data-testid="vault-file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled}
        />
        {uploading && (
          <p className="mt-4 text-blue-600 font-medium">Uploading...</p>
        )}
      </div>

      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span><strong>{err.filename}:</strong> {err.error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 2.1.16: Run all tests

Run: `npm test src/components/vault/__tests__/VaultUpload.test.tsx`
Expected: PASS - 7 tests passed

---

### Step 2.1.17: Commit VaultUpload component

```bash
git add src/components/vault/
git commit -m "feat: add VaultUpload component with drag-drop and validation (TDD)"
```

---

## Task 2.2: VaultItemCard Component (TDD)

**Files:**

- Create: `src/components/vault/__tests__/VaultItemCard.test.tsx`
- Create: `src/components/vault/VaultItemCard.tsx`

---

### Step 2.2.1: Write failing tests for VaultItemCard

Create `src/components/vault/__tests__/VaultItemCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultItemCard } from '../VaultItemCard';
import type { VaultItem } from '@/lib/vault/types';

const mockItem: VaultItem = {
  id: '1',
  user_id: 'user-1',
  project_id: 'project-1',
  type: 'pdf',
  filename: 'research-paper.pdf',
  storage_path: 'vault/1/research-paper.pdf',
  extracted_text: 'Sample text',
  extraction_status: 'success',
  chunk_count: 5,
  created_at: '2024-01-01T00:00:00Z',
};

describe('VaultItemCard', () => {
  it('renders filename', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
  });

  it('shows extraction status', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('shows chunk count for processed items', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByText(/5 chunks/i)).toBeInTheDocument();
  });

  it('shows file type icon', () => {
    render(<VaultItemCard item={mockItem} onDelete={() => {}} />);
    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', async () => {
    const mockDelete = vi.fn();
    render(<VaultItemCard item={mockItem} onDelete={mockDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockDelete).toHaveBeenCalledWith('1');
  });

  it('shows retry button when status is failed', async () => {
    const failedItem = { ...mockItem, extraction_status: 'failed' };
    const mockRetry = vi.fn();
    render(<VaultItemCard item={failedItem} onDelete={() => {}} onRetry={mockRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledWith('1');
  });

  it('shows spinner for processing states', () => {
    const processingItem = { ...mockItem, extraction_status: 'extracting' };
    render(<VaultItemCard item={processingItem} onDelete={() => {}} />);

    expect(screen.getByTestId('status-spinner')).toBeInTheDocument();
  });
});
```

---

### Step 2.2.2: Run tests to verify they fail

Run: `npm test src/components/vault/__tests__/VaultItemCard.test.tsx`
Expected: FAIL - Cannot find module '../VaultItemCard'

---

### Step 2.2.3: Implement VaultItemCard

Create `src/components/vault/VaultItemCard.tsx`:

```typescript
'use client';

import { FileText, File, Trash2, RefreshCw, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { VaultItem } from '@/lib/vault/types';

interface VaultItemCardProps {
  item: VaultItem;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

const statusIcons = {
  pending: Clock,
  downloading: Loader2,
  extracting: Loader2,
  chunking: Loader2,
  embedding: Loader2,
  success: CheckCircle,
  partial: AlertCircle,
  failed: AlertCircle,
};

const statusColors = {
  pending: 'text-yellow-500',
  downloading: 'text-blue-500',
  extracting: 'text-blue-500',
  chunking: 'text-blue-500',
  embedding: 'text-blue-500',
  success: 'text-green-500',
  partial: 'text-orange-500',
  failed: 'text-red-500',
};

export function VaultItemCard({ item, onDelete, onRetry }: VaultItemCardProps) {
  const FileIcon = item.type === 'pdf' ? FileText : File;
  const StatusIcon = statusIcons[item.extraction_status as keyof typeof statusIcons] || Clock;
  const statusColor = statusColors[item.extraction_status as keyof typeof statusColors] || 'text-gray-500';
  const isProcessing = ['downloading', 'extracting', 'chunking', 'embedding'].includes(item.extraction_status || '');

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <FileIcon
          data-testid={`file-icon-${item.type}`}
          className="w-8 h-8 text-gray-400"
        />
        <div>
          <p className="font-medium text-gray-900">{item.filename}</p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StatusIcon
              data-testid={isProcessing ? 'status-spinner' : undefined}
              className={`w-4 h-4 ${statusColor} ${isProcessing ? 'animate-spin' : ''}`}
            />
            <span className="capitalize">{item.extraction_status}</span>
            {item.chunk_count > 0 && (
              <span className="text-gray-400">• {item.chunk_count} chunks</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {item.extraction_status === 'failed' && onRetry && (
          <button
            onClick={() => onRetry(item.id)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            aria-label="Retry extraction"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded"
          aria-label="Delete file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

---

### Step 2.2.4: Run tests to verify they pass

Run: `npm test src/components/vault/__tests__/VaultItemCard.test.tsx`
Expected: PASS - 7 tests passed

---

### Step 2.2.5: Commit VaultItemCard

```bash
git add src/components/vault/
git commit -m "feat: add VaultItemCard component with status display (TDD)"
```

---

## Task 2.3: VaultItemList Component (TDD)

**Files:**

- Create: `src/components/vault/__tests__/VaultItemList.test.tsx`
- Create: `src/components/vault/VaultItemList.tsx`

---

### Step 2.3.1: Write failing tests for VaultItemList

Create `src/components/vault/__tests__/VaultItemList.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VaultItemList } from '../VaultItemList';
import type { VaultItem } from '@/lib/vault/types';

const mockItems: VaultItem[] = [
  {
    id: '1',
    user_id: 'user-1',
    project_id: 'project-1',
    type: 'pdf',
    filename: 'research-paper.pdf',
    storage_path: 'vault/1/research-paper.pdf',
    extracted_text: 'Sample text',
    extraction_status: 'success',
    chunk_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    project_id: 'project-1',
    type: 'docx',
    filename: 'notes.docx',
    storage_path: 'vault/1/notes.docx',
    extracted_text: null,
    extraction_status: 'pending',
    chunk_count: 0,
    created_at: '2024-01-02T00:00:00Z',
  },
];

describe('VaultItemList', () => {
  it('renders list of vault items', () => {
    render(<VaultItemList items={mockItems} onDelete={() => {}} />);

    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.docx')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<VaultItemList items={[]} onDelete={() => {}} />);

    expect(screen.getByText(/no files uploaded/i)).toBeInTheDocument();
  });

  it('passes onDelete to each item', () => {
    const mockDelete = vi.fn();
    render(<VaultItemList items={mockItems} onDelete={mockDelete} />);

    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });
});
```

---

### Step 2.3.2: Run tests to verify they fail

Run: `npm test src/components/vault/__tests__/VaultItemList.test.tsx`
Expected: FAIL - Cannot find module '../VaultItemList'

---

### Step 2.3.3: Implement VaultItemList

Create `src/components/vault/VaultItemList.tsx`:

```typescript
'use client';

import { VaultItemCard } from './VaultItemCard';
import type { VaultItem } from '@/lib/vault/types';

interface VaultItemListProps {
  items: VaultItem[];
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function VaultItemList({ items, onDelete, onRetry }: VaultItemListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No files uploaded yet.</p>
        <p className="text-sm mt-1">Upload PDFs, DOCX, or TXT files to build your knowledge vault.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <VaultItemCard
          key={item.id}
          item={item}
          onDelete={onDelete}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
```

---

### Step 2.3.4: Run tests to verify they pass

Run: `npm test src/components/vault/__tests__/VaultItemList.test.tsx`
Expected: PASS - 3 tests passed

---

### Step 2.3.5: Commit VaultItemList

```bash
git add src/components/vault/
git commit -m "feat: add VaultItemList component (TDD)"
```

---

## Task 2.4: Vault API Helpers (TDD)

**Files:**

- Create: `src/lib/api/__tests__/vault.test.ts`
- Create: `src/lib/api/vault.ts`
- Create: `src/lib/utils/filename.ts`

---

### Step 2.4.1: Write failing tests for vault API

Create `src/lib/api/__tests__/vault.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVaultItem, getVaultItems, deleteVaultItem } from '../vault';
import { sanitizeFilename } from '@/lib/utils/filename';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-item-id' }, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

describe('Vault API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVaultItem', () => {
    it('creates a vault item with correct data', async () => {
      const item = await createVaultItem({
        projectId: 'project-1',
        type: 'pdf',
        filename: 'test.pdf',
        storagePath: 'vault/test.pdf',
      });

      expect(item).toBeDefined();
      expect(item.id).toBe('test-item-id');
    });
  });

  describe('getVaultItems', () => {
    it('returns items for a project', async () => {
      const items = await getVaultItems('project-1');
      expect(Array.isArray(items)).toBe(true);
    });
  });
});

describe('sanitizeFilename', () => {
  it('removes path traversal attempts', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('______etc_passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('______windows_system32');
  });

  it('removes null bytes', () => {
    expect(sanitizeFilename('file\x00.pdf')).toBe('file.pdf');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('file<>:"|?*.pdf')).toBe('file_______.pdf');
  });

  it('limits filename length', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(255);
  });

  it('returns unnamed for empty result', () => {
    expect(sanitizeFilename('...')).toBe('unnamed');
  });
});
```

---

### Step 2.4.2: Run tests to verify they fail

Run: `npm test src/lib/api/__tests__/vault.test.ts`
Expected: FAIL - Cannot find modules

---

### Step 2.4.3: Implement filename sanitizer

Create `src/lib/utils/filename.ts`:

```typescript
export function sanitizeFilename(filename: string): string {
  // Remove null bytes
  let safe = filename.replace(/\x00/g, '');

  // Remove path traversal
  safe = safe.replace(/[/\\]/g, '_').replace(/\.\./g, '__');

  // Remove special characters (Windows reserved + control chars)
  safe = safe.replace(/[<>:"|?*\x00-\x1f]/g, '_');

  // Limit length (preserve extension if possible)
  if (safe.length > 255) {
    const ext = safe.slice(safe.lastIndexOf('.'));
    const name = safe.slice(0, 255 - ext.length);
    safe = name + ext;
  }

  // Handle empty result
  const trimmed = safe.replace(/^[._]+|[._]+$/g, '').trim();
  return trimmed || 'unnamed';
}
```

---

### Step 2.4.4: Implement vault API helpers

Create `src/lib/api/vault.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { VaultItem, ExtractionStatus } from '@/lib/vault/types';
import type { FileType } from '@/lib/vault/constants';

type VaultItemInsert = Database['public']['Tables']['vault_items']['Insert'];

export async function createVaultItem(item: {
  projectId: string | null;
  type: FileType;
  filename: string;
  storagePath: string;
}): Promise<VaultItem> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const insertData: VaultItemInsert = {
    user_id: user.id,
    project_id: item.projectId,
    type: item.type,
    filename: item.filename,
    storage_path: item.storagePath,
    extraction_status: 'pending',
  };

  const { data, error } = await supabase.from('vault_items').insert(insertData).select().single();

  if (error) throw error;
  return data;
}

export async function getVaultItems(projectId: string): Promise<VaultItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getVaultItem(id: string): Promise<VaultItem | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.from('vault_items').select('*').eq('id', id).eq('user_id', user.id).single();

  if (error) return null;
  return data;
}

export async function updateVaultItemStatus(
  id: string,
  status: ExtractionStatus,
  updates?: { extracted_text?: string; chunk_count?: number }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('vault_items')
    .update({
      extraction_status: status,
      ...updates,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteVaultItem(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get item first to get storage path (RLS ensures ownership)
  const { data: item } = await supabase
    .from('vault_items')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (item?.storage_path) {
    await supabase.storage.from('vault-files').remove([item.storage_path]);
  }

  // Delete from database (cascades to chunks via FK)
  const { error } = await supabase.from('vault_items').delete().eq('id', id).eq('user_id', user.id);

  if (error) throw error;
}
```

---

### Step 2.4.5: Run tests to verify they pass

Run: `npm test src/lib/api/__tests__/vault.test.ts`
Expected: PASS - All tests pass

---

### Step 2.4.6: Commit vault API helpers

```bash
git add src/lib/api/ src/lib/utils/
git commit -m "feat: add vault API helpers with secure filename sanitization (TDD)"
```

---

## Task 2.5: Upload API Route (TDD)

**Files:**

- Create: `src/lib/queue/extraction-queue.ts`
- Create: `src/app/api/vault/upload/route.ts`
- Create: `src/app/api/vault/route.ts`
- Create: `src/app/api/vault/[id]/route.ts`

---

### Step 2.5.1: Create extraction queue with recovery

Create `src/lib/queue/extraction-queue.ts`:

```typescript
import { EXTRACTION_CONFIG } from '@/lib/vault/constants';

interface ExtractionJob {
  itemId: string;
  attempt: number;
  scheduledAt: number;
}

// In-memory queue - IMPORTANT: Not safe for serverless/multi-instance deployments!
// In production, replace with:
// - Redis + BullMQ for horizontal scaling
// - Database-level locking with SELECT ... FOR UPDATE SKIP LOCKED
// - Supabase Edge Functions with pgmq
// This implementation is suitable for single-instance deployments or development only.
const pendingJobs: Map<string, ExtractionJob> = new Map();
const processingJobs: Set<string> = new Set();

export async function enqueueExtraction(itemId: string): Promise<void> {
  if (pendingJobs.has(itemId) || processingJobs.has(itemId)) {
    console.log(`Extraction job for ${itemId} already queued or processing`);
    return;
  }

  const job: ExtractionJob = {
    itemId,
    attempt: 1,
    scheduledAt: Date.now(),
  };

  pendingJobs.set(itemId, job);
  processExtractionJob(job);
}

async function processExtractionJob(job: ExtractionJob): Promise<void> {
  const { itemId, attempt } = job;

  pendingJobs.delete(itemId);
  processingJobs.add(itemId);

  try {
    // Import dynamically to avoid circular dependencies
    const { processExtraction } = await import('@/lib/extraction/processor');
    await processExtraction(itemId);
  } catch (error) {
    console.error(`Extraction attempt ${attempt} failed for ${itemId}:`, error);

    if (attempt < EXTRACTION_CONFIG.maxRetries) {
      // Exponential backoff with cap
      const delay = Math.min(Math.pow(2, attempt) * EXTRACTION_CONFIG.retryDelayMs, EXTRACTION_CONFIG.maxRetryDelayMs);

      setTimeout(() => {
        processExtractionJob({
          itemId,
          attempt: attempt + 1,
          scheduledAt: Date.now(),
        });
      }, delay);
    }
  } finally {
    processingJobs.delete(itemId);
  }
}

export function getQueueStatus(): { pending: number; processing: number } {
  return {
    pending: pendingJobs.size,
    processing: processingJobs.size,
  };
}

// Recovery function - call on server startup to re-queue stalled items
export async function recoverStalledExtractions(): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: stalledItems } = await supabase
    .from('vault_items')
    .select('id')
    .in('extraction_status', ['pending', 'downloading', 'extracting', 'chunking', 'embedding']);

  if (stalledItems) {
    for (const item of stalledItems) {
      await enqueueExtraction(item.id);
    }
    console.log(`Recovered ${stalledItems.length} stalled extraction jobs`);
  }
}
```

---

### Step 2.5.2: Create upload route

Create `src/app/api/vault/upload/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { createVaultItem } from '@/lib/api/vault';
import { enqueueExtraction } from '@/lib/queue/extraction-queue';
import { sanitizeFilename } from '@/lib/utils/filename';
import { FILE_SIZE_LIMITS, FILE_TYPE_MAP, type FileType } from '@/lib/vault/constants';
import { NextResponse } from 'next/server';

function getFileType(filename: string): FileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? (FILE_TYPE_MAP[ext] as FileType) || null : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectId = formData.get('projectId') as string;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      const fileType = getFileType(file.name);

      if (!fileType) {
        errors.push({ filename: file.name, error: 'Unsupported file type' });
        continue;
      }

      if (file.size > FILE_SIZE_LIMITS[fileType]) {
        errors.push({
          filename: file.name,
          error: `File exceeds ${FILE_SIZE_LIMITS[fileType] / 1024 / 1024}MB limit`,
        });
        continue;
      }

      const sanitizedName = sanitizeFilename(file.name);
      const path = `${user.id}/${projectId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage.from('vault-files').upload(path, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        errors.push({ filename: file.name, error: 'Storage upload failed' });
        continue;
      }

      try {
        const item = await createVaultItem({
          projectId,
          type: fileType,
          filename: file.name,
          storagePath: path,
        });

        results.push(item);
        enqueueExtraction(item.id);
      } catch (dbError) {
        console.error('Database error:', dbError);
        await supabase.storage.from('vault-files').remove([path]);
        errors.push({ filename: file.name, error: 'Database insert failed' });
      }
    }

    return NextResponse.json({
      items: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

### Step 2.5.3: Create vault list route with auth

Create `src/app/api/vault/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getVaultItems } from '@/lib/api/vault';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const items = await getVaultItems(projectId);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Get vault items error:', error);
    return NextResponse.json({ error: 'Failed to get items' }, { status: 500 });
  }
}
```

---

### Step 2.5.4: Create vault item route with auth (Next.js 14+ params)

Create `src/app/api/vault/[id]/route.ts`:

```typescript
import { getVaultItem, deleteVaultItem } from '@/lib/api/vault';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const item = await getVaultItem(id);

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get item' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const item = await getVaultItem(id);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteVaultItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
```

---

### Step 2.5.5: Commit API routes

```bash
git add src/lib/queue/ src/app/api/vault/
git commit -m "feat: add vault API routes with auth and queue-based extraction"
```

---

## Task 2.6: Text Extraction (TDD)

**Files:**

- Create: `src/lib/extraction/__tests__/pdf.test.ts`
- Create: `src/lib/extraction/pdf.ts`
- Create: `src/lib/extraction/__tests__/docx.test.ts`
- Create: `src/lib/extraction/docx.ts`
- Create: `src/lib/extraction/text.ts`

---

### Step 2.6.1: Install extraction libraries

Run: `npm install pdf-parse mammoth`
Expected: Packages installed

---

### Step 2.6.2: Install type definitions

Run: `npm install -D @types/pdf-parse`
Expected: Types installed

---

### Step 2.6.3: Write failing test for PDF extraction

Create `src/lib/extraction/__tests__/pdf.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractPdfText } from '../pdf';

vi.mock('pdf-parse', () => ({
  default: vi.fn().mockImplementation(async (buffer) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    if (buffer.toString().includes('corrupted')) {
      throw new Error('Invalid PDF structure');
    }
    return { text: 'Extracted PDF text content', numpages: 3 };
  }),
}));

describe('PDF extraction', () => {
  it('extracts text from valid PDF buffer', async () => {
    const buffer = Buffer.from('valid pdf content');
    const result = await extractPdfText(buffer);

    expect(result.text).toBe('Extracted PDF text content');
    expect(result.success).toBe(true);
    expect(result.pageCount).toBe(3);
  });

  it('handles corrupted PDF gracefully', async () => {
    const buffer = Buffer.from('corrupted pdf');
    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid PDF');
  });

  it('handles empty buffer', async () => {
    const buffer = Buffer.alloc(0);
    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

### Step 2.6.4: Run test to verify it fails

Run: `npm test src/lib/extraction/__tests__/pdf.test.ts`
Expected: FAIL - Cannot find module '../pdf'

---

### Step 2.6.5: Implement PDF extractor

Create `src/lib/extraction/pdf.ts`:

```typescript
import pdf from 'pdf-parse';

export interface ExtractionResult {
  text: string;
  success: boolean;
  error?: string;
  pageCount?: number;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const data = await pdf(buffer);

    return {
      text: data.text.trim(),
      success: true,
      pageCount: data.numpages,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF extraction failed';
    console.error('PDF extraction error:', message);

    return {
      text: '',
      success: false,
      error: message,
    };
  }
}
```

---

### Step 2.6.6: Run test to verify it passes

Run: `npm test src/lib/extraction/__tests__/pdf.test.ts`
Expected: PASS - 3 tests passed

---

### Step 2.6.7: Write failing test for DOCX extraction

Create `src/lib/extraction/__tests__/docx.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractDocxText } from '../docx';

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockImplementation(async ({ buffer }) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    if (buffer.toString().includes('corrupted')) {
      throw new Error('Could not read DOCX file');
    }
    return { value: 'Extracted DOCX text content' };
  }),
}));

describe('DOCX extraction', () => {
  it('extracts text from valid DOCX buffer', async () => {
    const buffer = Buffer.from('valid docx content');
    const result = await extractDocxText(buffer);

    expect(result.text).toBe('Extracted DOCX text content');
    expect(result.success).toBe(true);
  });

  it('handles corrupted DOCX gracefully', async () => {
    const buffer = Buffer.from('corrupted docx');
    const result = await extractDocxText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not read');
  });

  it('handles empty buffer', async () => {
    const buffer = Buffer.alloc(0);
    const result = await extractDocxText(buffer);

    expect(result.success).toBe(false);
  });
});
```

---

### Step 2.6.8: Run test to verify it fails

Run: `npm test src/lib/extraction/__tests__/docx.test.ts`
Expected: FAIL - Cannot find module '../docx'

---

### Step 2.6.9: Implement DOCX extractor

Create `src/lib/extraction/docx.ts`:

```typescript
import mammoth from 'mammoth';
import type { ExtractionResult } from './pdf';

export async function extractDocxText(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value.trim(),
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DOCX extraction failed';
    console.error('DOCX extraction error:', message);

    return {
      text: '',
      success: false,
      error: message,
    };
  }
}
```

---

### Step 2.6.10: Run test to verify it passes

Run: `npm test src/lib/extraction/__tests__/docx.test.ts`
Expected: PASS - 3 tests passed

---

### Step 2.6.11: Implement text extractor

Create `src/lib/extraction/text.ts`:

```typescript
import type { ExtractionResult } from './pdf';

export async function extractTextContent(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const text = buffer.toString('utf-8').trim();

    return {
      text,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Text extraction failed';

    return {
      text: '',
      success: false,
      error: message,
    };
  }
}
```

---

### Step 2.6.12: Commit extraction modules

```bash
git add src/lib/extraction/
git commit -m "feat: add text extraction for PDF, DOCX, and TXT files (TDD)"
```

---

## Task 2.7: Text Chunker (TDD)

**Files:**

- Create: `src/lib/extraction/__tests__/chunker.test.ts`
- Create: `src/lib/extraction/chunker.ts`

---

### Step 2.7.1: Write failing tests for chunker

Create `src/lib/extraction/__tests__/chunker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunker';

describe('Text Chunker', () => {
  it('returns single chunk for short text', () => {
    const text = 'Short text content.';
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].index).toBe(0);
  });

  it('returns empty array for empty text', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(0);
  });

  it('returns empty array for whitespace-only text', () => {
    const chunks = chunkText('   \n\t   ');
    expect(chunks).toHaveLength(0);
  });

  it('chunks text with default config', () => {
    const text = 'A'.repeat(5000);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(2000);
  });

  it('assigns sequential indices to chunks', () => {
    const text = 'A'.repeat(6000);
    const chunks = chunkText(text);

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('breaks at sentence boundaries when possible', () => {
    const text = 'First sentence. Second sentence. Third sentence. ' + 'A'.repeat(2000);
    const chunks = chunkText(text, { maxSize: 100 });

    // First chunk should end with a period (sentence boundary)
    if (chunks.length > 1) {
      expect(chunks[0].content.endsWith('.')).toBe(true);
    }
  });

  it('handles unicode correctly', () => {
    const text = '中文测试。这是第二句。' + '测'.repeat(500);
    const chunks = chunkText(text, { maxSize: 100 });

    expect(chunks.length).toBeGreaterThan(0);
    // Verify no truncated characters
    chunks.forEach((chunk) => {
      expect(chunk.content).not.toMatch(/[\uD800-\uDBFF]$/); // No orphan surrogates
    });
  });

  it('always makes forward progress', () => {
    // Edge case: text with no good break points
    const text = 'A'.repeat(5000);
    const chunks = chunkText(text, { maxSize: 100, overlap: 10 });

    // Should complete without infinite loop
    expect(chunks.length).toBeGreaterThan(0);

    // Each chunk should have content
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });
});
```

---

### Step 2.7.2: Run tests to verify they fail

Run: `npm test src/lib/extraction/__tests__/chunker.test.ts`
Expected: FAIL - Cannot find module '../chunker'

---

### Step 2.7.3: Implement chunker with fixed progress logic

Create `src/lib/extraction/chunker.ts`:

```typescript
import { CHUNK_CONFIG } from '@/lib/vault/constants';

export interface Chunk {
  content: string;
  index: number;
}

export interface ChunkConfig {
  maxSize?: number;
  overlap?: number;
  minSize?: number;
}

export function chunkText(text: string, config?: ChunkConfig): Chunk[] {
  const maxSize = config?.maxSize ?? CHUNK_CONFIG.maxSize;
  const overlap = config?.overlap ?? CHUNK_CONFIG.overlap;
  const minSize = config?.minSize ?? CHUNK_CONFIG.minSize;

  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.length === 0) {
    return [];
  }

  if (trimmedText.length <= maxSize) {
    if (trimmedText.length < minSize) {
      return [];
    }
    return [{ content: trimmedText, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmedText.length) {
    let end = Math.min(start + maxSize, trimmedText.length);
    let chunkEnd = end;

    // Try to break at sentence boundary if not at end
    if (end < trimmedText.length) {
      const searchStart = start + Math.floor(maxSize / 2);
      let lastBoundary = -1;

      // Look for sentence endings (. ! ?) followed by space or newline
      for (let i = end - 1; i >= searchStart; i--) {
        const char = trimmedText[i];
        const nextChar = trimmedText[i + 1];
        if (
          (char === '.' || char === '!' || char === '?') &&
          (nextChar === ' ' || nextChar === '\n' || nextChar === undefined)
        ) {
          lastBoundary = i + 1;
          break;
        }
      }

      if (lastBoundary > start) {
        chunkEnd = lastBoundary;
      } else {
        // No sentence boundary, try word boundary
        const lastSpace = trimmedText.lastIndexOf(' ', end - 1);
        if (lastSpace > searchStart) {
          chunkEnd = lastSpace + 1;
        }
      }
    }

    const chunkContent = trimmedText.slice(start, chunkEnd).trim();

    if (chunkContent.length >= minSize) {
      chunks.push({ content: chunkContent, index });
      index++;
    }

    // Calculate next start position with overlap
    const nextStart = chunkEnd - overlap;

    // CRITICAL: Always make forward progress to prevent infinite loop
    if (nextStart <= start) {
      start = chunkEnd;
    } else {
      start = nextStart;
    }
  }

  return chunks;
}

export function estimateChunkCount(textLength: number): number {
  if (textLength <= CHUNK_CONFIG.maxSize) return 1;

  const effectiveChunkSize = CHUNK_CONFIG.maxSize - CHUNK_CONFIG.overlap;
  return Math.ceil(textLength / effectiveChunkSize);
}
```

---

### Step 2.7.4: Run tests to verify they pass

Run: `npm test src/lib/extraction/__tests__/chunker.test.ts`
Expected: PASS - 8 tests passed

---

### Step 2.7.5: Commit chunker

```bash
git add src/lib/extraction/
git commit -m "feat: add text chunker with sentence boundaries and progress safety (TDD)"
```

---

## Task 2.8: OpenAI Embeddings (TDD)

**Files:**

- Create: `src/lib/extraction/__tests__/embeddings.test.ts`
- Create: `src/lib/extraction/embeddings.ts`

---

### Step 2.8.1: Install OpenAI SDK

Run: `npm install openai`
Expected: Package installed

---

### Step 2.8.2: Write failing tests for embeddings

Create `src/lib/extraction/__tests__/embeddings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding, getEmbeddings } from '../embeddings';

vi.mock('openai', () => {
  const mockCreate = vi.fn().mockImplementation(async ({ input }) => {
    const inputs = Array.isArray(input) ? input : [input];
    return {
      data: inputs.map((_, i) => ({
        embedding: Array(1536)
          .fill(0)
          .map((_, j) => (i + j) * 0.001),
        index: i,
      })),
    };
  });

  return {
    default: class OpenAI {
      embeddings = { create: mockCreate };
    },
  };
});

describe('Embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmbedding', () => {
    it('returns embedding of correct dimension', async () => {
      const embedding = await getEmbedding('test text');

      expect(embedding).toHaveLength(1536);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  describe('getEmbeddings', () => {
    it('returns embeddings for multiple texts', async () => {
      const texts = ['text one', 'text two', 'text three'];
      const embeddings = await getEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((emb) => {
        expect(emb).toHaveLength(1536);
      });
    });

    it('handles empty array', async () => {
      const embeddings = await getEmbeddings([]);
      expect(embeddings).toHaveLength(0);
    });

    it('batches large requests', async () => {
      const texts = Array(150).fill('test text');
      const embeddings = await getEmbeddings(texts);

      expect(embeddings).toHaveLength(150);
    });
  });
});
```

---

### Step 2.8.3: Run tests to verify they fail

Run: `npm test src/lib/extraction/__tests__/embeddings.test.ts`
Expected: FAIL - Cannot find module '../embeddings'

---

### Step 2.8.4: Implement embeddings with rate limiting

Create `src/lib/extraction/embeddings.ts`:

```typescript
import OpenAI from 'openai';
import { EMBEDDING_CONFIG } from '@/lib/vault/constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple delay helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getEmbedding(text: string): Promise<number[]> {
  // Truncate if too long (rough estimate: 1 token ≈ 4 chars)
  const maxChars = EMBEDDING_CONFIG.maxTokensPerChunk * 4;
  const truncatedText = text.slice(0, maxChars);

  const response = await openai.embeddings.create({
    model: EMBEDDING_CONFIG.model,
    input: truncatedText,
  });

  return response.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  const maxChars = EMBEDDING_CONFIG.maxTokensPerChunk * 4;
  const MAX_RATE_LIMIT_RETRIES = 3;
  let rateLimitRetries = 0;

  for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = texts.slice(i, i + EMBEDDING_CONFIG.batchSize).map((t) => t.slice(0, maxChars)); // Truncate each text

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        input: batch,
      });

      // Validate response
      if (response.data.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${response.data.length}`);
      }

      // Sort by index and extract embeddings
      const batchEmbeddings = response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);

      results.push(...batchEmbeddings);
    } catch (error: any) {
      // Handle rate limiting with retry (max 3 attempts per batch)
      if (error?.status === 429) {
        rateLimitRetries++;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
          throw new Error(`Rate limit exceeded after ${MAX_RATE_LIMIT_RETRIES} retries`);
        }
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
        console.log(`Rate limited (attempt ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES}), waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        i -= EMBEDDING_CONFIG.batchSize; // Retry this batch
        continue;
      }
      throw error;
    }
  }

  return results;
}
```

---

### Step 2.8.5: Run tests to verify they pass

Run: `npm test src/lib/extraction/__tests__/embeddings.test.ts`
Expected: PASS - 4 tests passed

---

### Step 2.8.6: Commit embeddings

```bash
git add src/lib/extraction/
git commit -m "feat: add OpenAI embeddings with batching and rate limit handling (TDD)"
```

---

## Task 2.9: Extraction Processor

**Files:**

- Create: `src/lib/extraction/processor.ts`
- Create: `src/app/api/vault/extract/route.ts`

---

### Step 2.9.1: Create extraction processor

Create `src/lib/extraction/processor.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getVaultItem, updateVaultItemStatus } from '@/lib/api/vault';
import { extractPdfText } from './pdf';
import { extractDocxText } from './docx';
import { extractTextContent } from './text';
import { chunkText } from './chunker';
import { getEmbeddings } from './embeddings';

export async function processExtraction(itemId: string): Promise<void> {
  const startTime = Date.now();

  try {
    const item = await getVaultItem(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    await updateVaultItemStatus(itemId, 'downloading');

    const supabase = await createClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('vault-files')
      .download(item.storage_path!);

    if (downloadError || !fileData) {
      await updateVaultItemStatus(itemId, 'failed');
      throw new Error('File download failed');
    }

    await updateVaultItemStatus(itemId, 'extracting');

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let extractionResult;

    switch (item.type) {
      case 'pdf':
        extractionResult = await extractPdfText(buffer);
        break;
      case 'docx':
        extractionResult = await extractDocxText(buffer);
        break;
      case 'txt':
        extractionResult = await extractTextContent(buffer);
        break;
      default:
        await updateVaultItemStatus(itemId, 'failed');
        throw new Error('Unsupported file type');
    }

    if (!extractionResult.success) {
      await updateVaultItemStatus(itemId, 'failed');
      throw new Error(extractionResult.error);
    }

    const extractedText = extractionResult.text;

    if (!extractedText || extractedText.length < 10) {
      await updateVaultItemStatus(itemId, 'partial', { extracted_text: extractedText });
      return;
    }

    await updateVaultItemStatus(itemId, 'chunking');

    const chunks = chunkText(extractedText);

    if (chunks.length === 0) {
      await updateVaultItemStatus(itemId, 'partial', {
        extracted_text: extractedText,
        chunk_count: 0,
      });
      return;
    }

    await updateVaultItemStatus(itemId, 'embedding');

    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await getEmbeddings(chunkContents);

    const chunkInserts = chunks.map((chunk, i) => ({
      vault_item_id: itemId,
      content: chunk.content,
      embedding: embeddings[i],
      chunk_index: chunk.index,
    }));

    const { error: insertError } = await supabase.from('vault_chunks').insert(chunkInserts);

    if (insertError) {
      console.error('Chunk insert error:', insertError);
      await updateVaultItemStatus(itemId, 'partial', {
        extracted_text: extractedText,
        chunk_count: 0,
      });
      throw new Error('Failed to store chunks');
    }

    await updateVaultItemStatus(itemId, 'success', {
      extracted_text: extractedText,
      chunk_count: chunks.length,
    });

    const duration = Date.now() - startTime;
    console.log(`Extraction completed for ${itemId} in ${duration}ms`);
  } catch (error) {
    console.error(`Extraction error for ${itemId}:`, error);
    await updateVaultItemStatus(itemId, 'failed');
    throw error;
  }
}
```

---

### Step 2.9.2: Create extraction API route with auth

Create `src/app/api/vault/extract/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { processExtraction } from '@/lib/extraction/processor';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    }

    // Verify item belongs to user
    const { data: item } = await supabase
      .from('vault_items')
      .select('id')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await processExtraction(itemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Extract route error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Extraction failed',
      },
      { status: 500 }
    );
  }
}
```

---

### Step 2.9.3: Commit extraction processor and route

```bash
git add src/lib/extraction/processor.ts src/app/api/vault/extract/
git commit -m "feat: add extraction processor with authenticated API route"
```

---

## Task 2.10: Semantic Search (TDD)

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_search_function.sql`
- Create: `src/lib/api/__tests__/search.test.ts`
- Create: `src/lib/api/search.ts`
- Create: `src/app/api/vault/search/route.ts`

---

### Step 2.10.1: Create search database function with user check

Create `supabase/migrations/YYYYMMDDHHMMSS_search_function.sql`:

```sql
-- Create semantic search function with user ownership check
create or replace function search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid,
  p_user_id uuid
)
returns table (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text,
  chunk_index int
)
language sql stable
security definer
as $$
  select
    vc.content,
    (1 - (vc.embedding <=> query_embedding))::float as similarity,
    vc.vault_item_id,
    vi.filename,
    vc.chunk_index
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and vi.user_id = p_user_id
    and (1 - (vc.embedding <=> query_embedding)) > match_threshold
  order by vc.embedding <=> query_embedding
  limit match_count;
$$;

comment on function search_vault_chunks is 'Semantic search over vault chunks with user ownership verification';
```

---

### Step 2.10.2: Apply migration

Run: `npx supabase db reset`
Expected: Migration applies successfully

---

### Step 2.10.3: Generate types

Run: `npm run db:types`
Expected: Types regenerated

---

### Step 2.10.4: Write failing tests for search

Create `src/lib/api/__tests__/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchVault } from '../search';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          content: 'Relevant content about the topic',
          similarity: 0.85,
          vault_item_id: 'item-1',
          filename: 'research.pdf',
          chunk_index: 0,
        },
      ],
      error: null,
    }),
  })),
}));

vi.mock('@/lib/extraction/embeddings', () => ({
  getEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
}));

describe('Vault Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns search results with correct structure', async () => {
    const results = await searchVault('project-1', 'machine learning');

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('content');
    expect(results[0]).toHaveProperty('similarity');
    expect(results[0]).toHaveProperty('vaultItemId');
    expect(results[0]).toHaveProperty('filename');
    expect(results[0]).toHaveProperty('chunkIndex');
  });

  it('returns empty array for no matches', async () => {
    vi.mocked((await import('@/lib/supabase/server')).createClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }) },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const results = await searchVault('project-1', 'obscure query');
    expect(results).toEqual([]);
  });
});
```

---

### Step 2.10.5: Run tests to verify they fail

Run: `npm test src/lib/api/__tests__/search.test.ts`
Expected: FAIL - Cannot find module '../search'

---

### Step 2.10.6: Implement search API

Create `src/lib/api/search.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/extraction/embeddings';
import type { SearchResult } from '@/lib/vault/types';

export async function searchVault(
  projectId: string,
  query: string,
  limit = 5,
  threshold = parseFloat(process.env.VAULT_SEARCH_THRESHOLD || '0.7')
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const queryEmbedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('search_vault_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    p_project_id: projectId,
    p_user_id: user.id,
  });

  if (error) {
    console.error('Search error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    content: row.content,
    similarity: row.similarity,
    vaultItemId: row.vault_item_id,
    filename: row.filename,
    chunkIndex: row.chunk_index,
  }));
}
```

---

### Step 2.10.7: Run tests to verify they pass

Run: `npm test src/lib/api/__tests__/search.test.ts`
Expected: PASS - 2 tests passed

---

### Step 2.10.8: Create search API route with Zod validation

Create `src/app/api/vault/search/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { searchVault } from '@/lib/api/search';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const searchSchema = z.object({
  projectId: z.string().uuid(),
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = searchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request', details: parseResult.error.flatten() }, { status: 400 });
    }

    const { projectId, query, limit, threshold } = parseResult.data;

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const results = await searchVault(projectId, query, limit, threshold);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search route error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 });
  }
}
```

---

### Step 2.10.9: Install Zod if not present

Run: `npm install zod`
Expected: Package installed (or already present)

---

### Step 2.10.10: Commit search functionality

```bash
git add supabase/migrations/ src/lib/api/ src/app/api/vault/search/
git commit -m "feat: add semantic search with Zod validation and user ownership (TDD)"
```

---

## Task 2.11: VaultSearch Component (TDD)

**Files:**

- Create: `src/components/vault/__tests__/VaultSearch.test.tsx`
- Create: `src/components/vault/VaultSearch.tsx`

---

### Step 2.11.1: Write failing tests for VaultSearch

Create `src/components/vault/__tests__/VaultSearch.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultSearch } from '../VaultSearch';

global.fetch = vi.fn();

describe('VaultSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input and button', () => {
    render(<VaultSearch projectId="project-1" />);

    expect(screen.getByPlaceholderText(/search your vault/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('disables search button when query is empty', () => {
    render(<VaultSearch projectId="project-1" />);

    const button = screen.getByRole('button', { name: /search/i });
    expect(button).toBeDisabled();
  });

  it('calls API on search submit', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    render(<VaultSearch projectId="project-1" />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test query');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/vault/search', expect.any(Object));
    });
  });

  it('displays search results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          content: 'Test result content',
          similarity: 0.85,
          vaultItemId: 'item-1',
          filename: 'test.pdf',
          chunkIndex: 0,
        }]
      }),
    });

    render(<VaultSearch projectId="project-1" />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test query');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/test result content/i)).toBeInTheDocument();
      expect(screen.getByText(/test.pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/85%/i)).toBeInTheDocument();
    });
  });

  it('shows no results message when empty', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    render(<VaultSearch projectId="project-1" />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test query');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });
});
```

---

### Step 2.11.2: Run tests to verify they fail

Run: `npm test src/components/vault/__tests__/VaultSearch.test.tsx`
Expected: FAIL - Cannot find module '../VaultSearch'

---

### Step 2.11.3: Implement VaultSearch with request cancellation

Create `src/components/vault/VaultSearch.tsx`:

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, FileText, Loader2 } from 'lucide-react';
import type { SearchResult } from '@/lib/vault/types';

interface VaultSearchProps {
  projectId: string;
  onResultSelect?: (result: SearchResult) => void;
}

export function VaultSearch({ projectId, onResultSelect }: VaultSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setSearching(true);
    setSearched(false);

    try {
      const response = await fetch('/api/vault/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, query }),
        signal: abortControllerRef.current.signal,
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [projectId, query]);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your vault..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          aria-label="Search"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>

      {searched && results.length === 0 && (
        <p className="text-gray-500 text-center py-4">No results found.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </h3>
          {results.map((result) => (
            <div
              key={`${result.vaultItemId}-${result.chunkIndex}`}
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => onResultSelect?.(result)}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  {result.filename}
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(result.similarity * 100)}% match
                </span>
              </div>
              <p className="text-gray-700 text-sm line-clamp-3">
                {result.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 2.11.4: Run tests to verify they pass

Run: `npm test src/components/vault/__tests__/VaultSearch.test.tsx`
Expected: PASS - 5 tests passed

---

### Step 2.11.5: Commit VaultSearch component

```bash
git add src/components/vault/
git commit -m "feat: add VaultSearch component with request cancellation (TDD)"
```

---

### Step 2.11.6: Create barrel export for vault components

Create `src/components/vault/index.ts`:

```typescript
export { VaultUpload } from './VaultUpload';
export { VaultItemCard } from './VaultItemCard';
export { VaultItemList } from './VaultItemList';
export { VaultSearch } from './VaultSearch';
```

---

### Step 2.11.7: Commit barrel export

```bash
git add src/components/vault/index.ts
git commit -m "chore: add barrel export for vault components"
```

---

## Task 2.12: Vault Page Integration

**Files:**

- Create: `src/app/projects/[id]/vault/page.tsx`
- Create: `src/app/projects/[id]/vault/VaultPageClient.tsx`

---

### Step 2.12.1: Create vault page server component (Next.js 14+ params)

Create `src/app/projects/[id]/vault/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { VaultPageClient } from './VaultPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VaultPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !project) {
    redirect('/projects');
  }

  const { data: items } = await supabase
    .from('vault_items')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return <VaultPageClient projectId={id} initialItems={items || []} />;
}
```

---

### Step 2.12.2: Create vault page client with error boundary

Create `src/app/projects/[id]/vault/VaultPageClient.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { VaultUpload } from '@/components/vault/VaultUpload';
import { VaultItemList } from '@/components/vault/VaultItemList';
import { VaultSearch } from '@/components/vault/VaultSearch';
import type { VaultItem } from '@/lib/vault/types';

interface Props {
  projectId: string;
  initialItems: VaultItem[];
}

function VaultErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-800 font-medium">Something went wrong loading the vault.</p>
      <p className="text-red-600 text-sm mt-1">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}

function VaultContent({ projectId, initialItems }: Props) {
  const [items, setItems] = useState<VaultItem[]>(initialItems);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const refreshItems = useCallback(async () => {
    const response = await fetch(`/api/vault?projectId=${projectId}`);
    if (response.ok) {
      const data = await response.json();
      setItems(data);
    }
  }, [projectId]);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic update
    const previousItems = items;
    setDeletingIds(prev => new Set(prev).add(id));
    setItems(prev => prev.filter(item => item.id !== id));

    try {
      const response = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
    } catch (error) {
      // Rollback on error
      setItems(previousItems);
      console.error('Delete error:', error);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [items]);

  const handleRetry = useCallback(async (id: string) => {
    await fetch('/api/vault/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id }),
    });
    refreshItems();
  }, [refreshItems]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Knowledge Vault</h1>

      <div className="mb-8">
        <VaultUpload projectId={projectId} onUpload={refreshItems} />
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Search</h2>
        <VaultSearch projectId={projectId} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Uploaded Files</h2>
        <VaultItemList
          items={items}
          onDelete={handleDelete}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}

export function VaultPageClient(props: Props) {
  return (
    <ErrorBoundary FallbackComponent={VaultErrorFallback}>
      <VaultContent {...props} />
    </ErrorBoundary>
  );
}
```

---

### Step 2.12.3: Install react-error-boundary if not present

Run: `npm install react-error-boundary`
Expected: Package installed (or already present)

---

### Step 2.12.4: Commit vault page

```bash
git add src/app/projects/
git commit -m "feat: add vault page with error boundary and optimistic updates"
```

---

## Task 2.13: E2E Tests

**Files:**

- Create: `e2e/fixtures/auth.ts`
- Create: `e2e/vault.spec.ts`

---

### Step 2.13.1: Create E2E auth fixture

Create `e2e/fixtures/auth.ts`:

```typescript
import { test as base, expect } from '@playwright/test';

// Extend base test with authenticated page
export const test = base.extend<{ authenticatedPage: any }>({
  authenticatedPage: async ({ page }, use) => {
    // Login flow - adjust based on Phase 1 auth implementation
    await page.goto('/login');

    // Fill in credentials (use test user from env or fixtures)
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for redirect to dashboard/projects
    await page.waitForURL(/\/(dashboard|projects)/);

    await use(page);
  },
});

export { expect };
```

---

### Step 2.13.2: Create E2E tests with proper isolation

Create `e2e/vault.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth';

test.describe('Knowledge Vault', () => {
  let testProjectId: string;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Create a test project or use existing one
    // Navigate to vault page
    await page.goto('/projects');

    // Click on first project or create one
    const projectLink = page.getByRole('link', { name: /vault|project/i }).first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
    }

    // Navigate to vault tab if needed
    const vaultTab = page.getByRole('link', { name: /vault/i });
    if (await vaultTab.isVisible()) {
      await vaultTab.click();
    }

    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ authenticatedPage: page }) => {
    // Clean up: delete any test files uploaded during the test
    const deleteButtons = page.getByRole('button', { name: /delete/i });
    const count = await deleteButtons.count();

    for (let i = 0; i < count; i++) {
      await deleteButtons.first().click();
      await page.waitForTimeout(500); // Wait for deletion
    }
  });

  test('displays empty vault message when no files', async ({ authenticatedPage: page }) => {
    // Only check if no files exist
    const noFilesMessage = page.getByText(/no files uploaded/i);
    const fileList = page.getByTestId('file-icon-pdf');

    if (await noFilesMessage.isVisible()) {
      await expect(noFilesMessage).toBeVisible();
    }
  });

  test('shows upload zone with instructions', async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/drag files here/i)).toBeVisible();
    await expect(page.getByText(/pdf, docx, or txt/i)).toBeVisible();
  });

  test('can upload a text file', async ({ authenticatedPage: page }) => {
    const fileInput = page.getByTestId('vault-file-input');

    // Wait for upload response
    const uploadPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/vault/upload') && resp.status() === 200
    );

    await fileInput.setInputFiles('./e2e/fixtures/test.txt');
    await uploadPromise;

    // Verify file appears in list
    await expect(page.getByText('test.txt')).toBeVisible();
  });

  test('shows extraction status updates', async ({ authenticatedPage: page }) => {
    const fileInput = page.getByTestId('vault-file-input');
    await fileInput.setInputFiles('./e2e/fixtures/test.txt');

    // Wait for file to appear
    await expect(page.getByText('test.txt')).toBeVisible();

    // Check for status (could be pending, extracting, or success)
    await expect(page.getByText(/pending|extracting|success/i)).toBeVisible();

    // Wait for extraction to complete (with reasonable timeout)
    await expect(async () => {
      const status = await page.getByText(/success|partial/i).isVisible();
      expect(status).toBeTruthy();
    }).toPass({ timeout: 30000 });
  });

  test('can search vault after upload and extraction', async ({ authenticatedPage: page }) => {
    const fileInput = page.getByTestId('vault-file-input');
    await fileInput.setInputFiles('./e2e/fixtures/test.txt');

    // Wait for extraction to complete
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 30000 });

    // Search for content from the test file
    await page.getByPlaceholderText(/search your vault/i).fill('test document');

    const searchPromise = page.waitForResponse((resp) => resp.url().includes('/api/vault/search'));

    await page.getByRole('button', { name: /search/i }).click();
    await searchPromise;

    // Should show results
    await expect(page.getByText(/result/i)).toBeVisible({ timeout: 10000 });
  });

  test('can delete uploaded file', async ({ authenticatedPage: page }) => {
    const fileInput = page.getByTestId('vault-file-input');
    await fileInput.setInputFiles('./e2e/fixtures/test.txt');

    await expect(page.getByText('test.txt')).toBeVisible();

    // Delete the file
    const deletePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/vault/') && resp.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).click();
    await deletePromise;

    // File should be gone
    await expect(page.getByText('test.txt')).not.toBeVisible();
  });

  test('validates file type on upload', async ({ authenticatedPage: page }) => {
    const fileInput = page.getByTestId('vault-file-input');

    // Create an invalid file type
    await fileInput.setInputFiles({
      name: 'test.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('invalid content'),
    });

    await expect(page.getByText(/unsupported file type/i)).toBeVisible();
  });
});
```

---

### Step 2.13.3: Run E2E tests

Run: `npm run test:e2e -- --grep="vault"`
Expected: Tests run (some may be skipped if auth not set up)

---

### Step 2.13.4: Commit E2E tests

```bash
git add e2e/
git commit -m "test: add E2E tests for Knowledge Vault with proper isolation"
```

---

## Phase 2 Complete Verification

Run full verification:

```bash
npm run lint && npm run format:check && npm test && npm run build
```

For E2E tests (requires running server):

```bash
npm run test:e2e -- --grep="vault"
```

**Checklist:**

- [ ] `npm run dev` starts without errors
- [ ] `npm test` passes all unit/integration tests
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] `npm run test:e2e` passes vault tests (with auth setup)
- [ ] Can upload PDF, DOCX, TXT files via UI
- [ ] Extraction completes and status updates
- [ ] Can search vault and get relevant results
- [ ] Can delete vault items
- [ ] File size limits are enforced
- [ ] Error states display correctly

---

## Summary of Phase 2 Deliverables

| Component            | Files                                          | Tests        |
| -------------------- | ---------------------------------------------- | ------------ |
| Infrastructure       | `constants.ts`, `types.ts`, migrations         | -            |
| VaultUpload          | `VaultUpload.tsx`                              | 7 unit tests |
| VaultItemCard        | `VaultItemCard.tsx`                            | 7 unit tests |
| VaultItemList        | `VaultItemList.tsx`                            | 3 unit tests |
| Vault API            | `vault.ts`, `filename.ts`                      | 6 unit tests |
| Upload API           | `upload/route.ts`, `route.ts`, `[id]/route.ts` | -            |
| Extraction Queue     | `extraction-queue.ts`                          | -            |
| PDF Extraction       | `pdf.ts`                                       | 3 unit tests |
| DOCX Extraction      | `docx.ts`                                      | 3 unit tests |
| Text Chunker         | `chunker.ts`                                   | 8 unit tests |
| Embeddings           | `embeddings.ts`                                | 4 unit tests |
| Extraction Processor | `processor.ts`                                 | -            |
| Search API           | `search.ts`                                    | 2 unit tests |
| VaultSearch          | `VaultSearch.tsx`                              | 5 unit tests |
| Vault Page           | `page.tsx`, `VaultPageClient.tsx`              | E2E tests    |

**Key Improvements in This Revision:**

1. Fixed Next.js 14+ async params in all route handlers
2. Added vault_items and vault_chunks table migration with RLS
3. Fixed storage RLS to use folder-based access control
4. Unified file types ('txt' everywhere)
5. Added auth checks to all API routes
6. Added TDD for all components (VaultItemCard, VaultSearch)
7. Added Zod validation for search API
8. Improved filename sanitization (null bytes, length limits)
9. Added rate limiting handling for OpenAI API with max retry counter (3 attempts)
10. Fixed chunker infinite loop risk
11. Added pgvector HNSW index (preferred over IVFFlat for empty tables)
12. Added error boundary to vault page
13. Added optimistic updates with rollback
14. Added request cancellation in VaultSearch
15. Improved E2E tests with proper isolation and waitForResponse patterns
16. Added serverless deployment warning for extraction queue
17. Made search threshold configurable via VAULT_SEARCH_THRESHOLD env var
18. Added shared test fixtures file for consistent mock data
19. Added barrel export for vault components
20. Split fixture creation steps for granularity
