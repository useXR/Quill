import type { Database } from './database.types';

// ============================================
// TABLE ROW TYPES
// Use these when reading data from the database
// ============================================

/** User profile linked to auth.users */
export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Grant proposal project */
export type Project = Database['public']['Tables']['projects']['Row'];

/** Document section within a project */
export type Document = Database['public']['Tables']['documents']['Row'];

/** Uploaded reference file (PDF, DOCX, URL, text) */
export type VaultItem = Database['public']['Tables']['vault_items']['Row'];

/** Chunked text with embedding for semantic search */
export type VaultChunk = Database['public']['Tables']['vault_chunks']['Row'];

/** Bibliography/reference citation */
export type Citation = Database['public']['Tables']['citations']['Row'];

/** AI conversation message */
export type ChatMessage = Database['public']['Tables']['chat_history']['Row'];

/** Security audit trail entry */
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

/** AI edit operation for undo/history */
export type AIOperation = Database['public']['Tables']['ai_operations']['Row'];

// ============================================
// INSERT TYPES
// Use these when creating new records
// ============================================

/** Data required to create a new project */
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

/** Data required to create a new document */
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

/** Data required to create a new vault item */
export type VaultItemInsert = Database['public']['Tables']['vault_items']['Insert'];

/** Data required to create a new vault chunk */
export type VaultChunkInsert = Database['public']['Tables']['vault_chunks']['Insert'];

/** Data required to create a new citation */
export type CitationInsert = Database['public']['Tables']['citations']['Insert'];

/** Data required to create a new chat message */
export type ChatMessageInsert = Database['public']['Tables']['chat_history']['Insert'];

/** Data required to create an AI operation record */
export type AIOperationInsert = Database['public']['Tables']['ai_operations']['Insert'];

/** Data required to create an audit log entry */
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

// ============================================
// UPDATE TYPES
// Use these when updating existing records
// ============================================

/** Fields that can be updated on a project */
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

/** Fields that can be updated on a document */
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

/** Fields that can be updated on a profile */
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/** Fields that can be updated on a vault item */
export type VaultItemUpdate = Database['public']['Tables']['vault_items']['Update'];

/** Fields that can be updated on a citation */
export type CitationUpdate = Database['public']['Tables']['citations']['Update'];

/** Fields that can be updated on an AI operation */
export type AIOperationUpdate = Database['public']['Tables']['ai_operations']['Update'];

// ============================================
// STATUS ENUMS (as string literal unions)
// Use these for type-safe status handling
// ============================================

/** Project status values */
export type ProjectStatus = 'draft' | 'submitted' | 'funded';

/** Vault item extraction status values */
export type ExtractionStatus = 'pending' | 'success' | 'partial' | 'failed';

/** AI operation status values */
export type AIOperationStatus = 'pending' | 'accepted' | 'rejected' | 'partial';

/** AI operation type values */
export type AIOperationType = 'selection' | 'cursor' | 'global';

/** Chat message role values */
export type ChatRole = 'user' | 'assistant';

/** Citation source values */
export type CitationSource = 'user_added' | 'ai_fetched';

// ============================================
// TIPTAP/PROSEMIRROR CONTENT TYPES
// Use these for typed document content
// ============================================

/** Base TipTap node structure */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** TipTap document structure */
export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

/** Document with typed TipTap content */
export interface TypedDocument extends Omit<Document, 'content'> {
  content: TipTapDocument;
}

// ============================================
// RPC RETURN TYPES
// Use these for typed RPC call results
// ============================================

/** Return type for search_vault_chunks RPC function */
export interface VaultSearchResult {
  content: string;
  similarity: number;
  vault_item_id: string;
  filename: string | null;
}
