import type {
  ProjectInsert,
  DocumentInsert,
  VaultItemInsert,
  VaultChunkInsert,
  CitationInsert,
  ChatMessageInsert,
  AIOperationInsert,
  AuditLogInsert,
} from '@/lib/supabase/types';

// Counter for generating unique test data
let counter = 0;

/**
 * Reset counter between test suites if needed
 */
export function resetFactoryCounter() {
  counter = 0;
}

/**
 * Create test project data
 */
export function createTestProject(userId: string, overrides: Partial<ProjectInsert> = {}): ProjectInsert {
  counter++;
  return {
    user_id: userId,
    title: `Test Project ${counter}`,
    status: 'draft',
    ...overrides,
  };
}

/**
 * Create test document data
 */
export function createTestDocument(projectId: string, overrides: Partial<DocumentInsert> = {}): DocumentInsert {
  counter++;
  return {
    project_id: projectId,
    title: `Test Document ${counter}`,
    content: { type: 'doc', content: [] },
    content_text: '',
    sort_order: counter,
    version: 1,
    ...overrides,
  };
}

/**
 * Create test vault item data
 */
export function createTestVaultItem(
  userId: string,
  projectId: string,
  overrides: Partial<VaultItemInsert> = {}
): VaultItemInsert {
  counter++;
  return {
    user_id: userId,
    project_id: projectId,
    type: 'text',
    filename: `test-file-${counter}.txt`,
    extraction_status: 'pending',
    ...overrides,
  };
}

/**
 * Create test vault chunk data
 */
export function createTestVaultChunk(
  vaultItemId: string,
  chunkIndex: number,
  overrides: Partial<VaultChunkInsert> = {}
): VaultChunkInsert {
  counter++;
  return {
    vault_item_id: vaultItemId,
    content: `Test chunk content ${counter}`,
    chunk_index: chunkIndex,
    ...overrides,
  };
}

/**
 * Create test citation data
 */
export function createTestCitation(projectId: string, overrides: Partial<CitationInsert> = {}): CitationInsert {
  counter++;
  return {
    project_id: projectId,
    title: `Test Citation ${counter}`,
    authors: `Author ${counter}`,
    year: 2024,
    source: 'user_added',
    verified: false,
    ...overrides,
  };
}

/**
 * Create test chat message data
 */
export function createTestChatMessage(
  projectId: string,
  role: 'user' | 'assistant',
  overrides: Partial<ChatMessageInsert> = {}
): ChatMessageInsert {
  counter++;
  return {
    project_id: projectId,
    role,
    content: `Test ${role} message ${counter}`,
    ...overrides,
  };
}

/**
 * Create test AI operation data
 */
export function createTestAIOperation(
  documentId: string,
  userId: string,
  overrides: Partial<AIOperationInsert> = {}
): AIOperationInsert {
  counter++;
  return {
    document_id: documentId,
    user_id: userId,
    operation_type: 'cursor',
    input_summary: `Test input ${counter}`,
    output_content: `Test output ${counter}`,
    status: 'pending',
    ...overrides,
  };
}

/**
 * Create test audit log data
 */
export function createTestAuditLog(userId: string, overrides: Partial<AuditLogInsert> = {}): AuditLogInsert {
  counter++;
  return {
    user_id: userId,
    action: `test:action:${counter}`,
    resource_type: 'test',
    ...overrides,
  };
}
