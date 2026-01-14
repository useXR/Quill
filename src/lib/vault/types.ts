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
