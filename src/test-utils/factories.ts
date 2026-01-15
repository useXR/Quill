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
import type { ChatMessage } from '@/contexts/ChatContext';
import type { DiffChange } from '@/lib/ai/diff-generator';
import type { Paper, SearchResult } from '@/lib/citations/types';

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

// ============================================
// Chat UI Factories (for component testing)
// ============================================

/**
 * Create mock ChatMessage for UI testing (ChatContext type)
 */
export function createMockChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  counter++;
  return {
    id: `msg-${counter}-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: `Test message content ${counter}`,
    createdAt: new Date(),
    status: 'sent',
    mode: 'discussion',
    ...overrides,
  };
}

/**
 * Create mock streaming message for testing streaming behavior
 */
export function createMockStreamingMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return createMockChatMessage({
    role: 'assistant',
    content: '',
    status: 'streaming',
    ...overrides,
  });
}

// ============================================
// Diff Factories
// ============================================

/**
 * Create a mock diff change
 */
export function createMockDiffChange(overrides: Partial<DiffChange> = {}): DiffChange {
  counter++;
  return {
    type: 'add',
    value: `New content line ${counter}\n`,
    lineNumber: counter,
    ...overrides,
  };
}

/**
 * Mock diff set for testing diff panel
 */
export const mockDiffChanges: DiffChange[] = [
  { type: 'unchanged', value: 'Line 1: Original content\n', lineNumber: 1 },
  { type: 'remove', value: 'Line 2: Old text to remove\n', lineNumber: 2 },
  { type: 'add', value: 'Line 2: New replacement text\n', lineNumber: 2 },
  { type: 'unchanged', value: 'Line 3: More original content\n', lineNumber: 3 },
];

/**
 * Create a realistic diff set for global edit testing
 */
export function createMockGlobalEditDiff(): DiffChange[] {
  return [
    { type: 'unchanged', value: '# Introduction\n\n', lineNumber: 1 },
    { type: 'remove', value: 'This paragraph has lowercase headings.\n\n', lineNumber: 3 },
    { type: 'add', value: 'This Paragraph Has Title Case Headings.\n\n', lineNumber: 3 },
    { type: 'unchanged', value: '## methodology\n\n', lineNumber: 5 },
    { type: 'remove', value: '## methodology\n\n', lineNumber: 5 },
    { type: 'add', value: '## Methodology\n\n', lineNumber: 5 },
    { type: 'unchanged', value: 'Content describing methods.\n', lineNumber: 7 },
  ];
}

// ============================================
// Chat History Factories
// ============================================

/**
 * Create a mock chat history with alternating user/assistant messages
 */
export function createMockChatHistory(messageCount = 3): ChatMessage[] {
  return Array.from({ length: messageCount }, (_, i) =>
    createMockChatMessage({
      id: `msg-history-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i % 2 === 0 ? `User question ${Math.floor(i / 2) + 1}` : `Assistant response ${Math.floor(i / 2) + 1}`,
      createdAt: new Date(Date.now() - (messageCount - i) * 60000), // Older messages first
    })
  );
}

/**
 * Create a conversation with a global edit flow
 */
export function createMockGlobalEditConversation(): ChatMessage[] {
  return [
    createMockChatMessage({
      id: 'msg-user-request',
      role: 'user',
      content: 'Change all headings to title case',
      mode: 'global_edit',
    }),
    createMockChatMessage({
      id: 'msg-assistant-response',
      role: 'assistant',
      content: 'I have updated all headings to title case. Please review the changes.',
      mode: 'global_edit',
    }),
  ];
}

// ============================================
// AI Operation Factories (Extended)
// ============================================

/**
 * Create a mock AI operation with full details
 */
export function createMockAIOperation(
  documentId: string,
  userId: string,
  overrides: Partial<AIOperationInsert & { id: string }> = {}
): AIOperationInsert & { id: string } {
  counter++;
  return {
    id: `op-${counter}-${Math.random().toString(36).slice(2)}`,
    document_id: documentId,
    user_id: userId,
    operation_type: 'global_edit',
    input_summary: `Global edit request ${counter}`,
    output_content: `Modified content from operation ${counter}`,
    status: 'completed',
    ...overrides,
  };
}

/**
 * Create a mock AI operation history for undo testing
 */
export function createMockOperationHistory(
  documentId: string,
  userId: string,
  operationCount = 3
): Array<AIOperationInsert & { id: string }> {
  return Array.from({ length: operationCount }, (_, i) =>
    createMockAIOperation(documentId, userId, {
      id: `op-history-${i}`,
      input_summary: `Operation ${i + 1} input`,
      output_content: `Content after operation ${i + 1}`,
      status: 'completed',
    })
  );
}

// ============================================
// Citation / Semantic Scholar Factories
// ============================================

/**
 * Create a mock Paper from Semantic Scholar API
 */
export function createMockPaper(overrides: Partial<Paper> = {}): Paper {
  counter++;
  return {
    paperId: `paper-${counter}-${Math.random().toString(36).slice(2)}`,
    title: `Test Paper ${counter}: A Study on Testing`,
    authors: [
      { name: `Author ${counter}`, authorId: `author-${counter}` },
      { name: `Co-Author ${counter}`, authorId: `coauthor-${counter}` },
    ],
    year: 2024,
    publicationDate: '2024-01-15',
    journal: {
      name: 'Journal of Testing',
      volume: '42',
      pages: '1-20',
    },
    venue: 'Test Conference',
    externalIds: {
      DOI: `10.1000/test.${counter}`,
      PubMed: `${30000000 + counter}`,
      ArXiv: `2401.${String(counter).padStart(5, '0')}`,
      CorpusId: 100000 + counter,
    },
    abstract: `This is the abstract for test paper ${counter}. It describes important research findings.`,
    url: `https://www.semanticscholar.org/paper/${counter}`,
    citationCount: counter * 10,
    influentialCitationCount: counter,
    isOpenAccess: true,
    openAccessPdf: { url: `https://arxiv.org/pdf/2401.${String(counter).padStart(5, '0')}.pdf` },
    fieldsOfStudy: ['Computer Science', 'Testing'],
    ...overrides,
  };
}

/**
 * Create a mock Citation database record from a Paper
 */
export function createMockCitation(
  projectId: string,
  paper?: Partial<Paper>,
  overrides: Partial<CitationInsert> = {}
): CitationInsert {
  const mockPaper = paper ? createMockPaper(paper) : createMockPaper();
  return {
    project_id: projectId,
    title: mockPaper.title,
    authors: mockPaper.authors.map((a) => a.name).join(', '),
    year: mockPaper.year,
    journal: mockPaper.journal?.name,
    doi: mockPaper.externalIds?.DOI,
    url: mockPaper.url,
    abstract: mockPaper.abstract,
    source: 'semantic_scholar',
    semantic_scholar_id: mockPaper.paperId,
    verified: false,
    ...overrides,
  };
}

/**
 * Pre-built mock papers for common test scenarios
 */
export const mockPapers: Paper[] = [
  createMockPaper({
    paperId: 'paper-ml-001',
    title: 'Deep Learning Fundamentals: A Comprehensive Review',
    authors: [
      { name: 'John Smith', authorId: 'js-001' },
      { name: 'Jane Doe', authorId: 'jd-001' },
    ],
    year: 2023,
    citationCount: 500,
    fieldsOfStudy: ['Computer Science', 'Machine Learning'],
  }),
  createMockPaper({
    paperId: 'paper-nlp-002',
    title: 'Transformers in Natural Language Processing',
    authors: [{ name: 'Alice Chen', authorId: 'ac-001' }],
    year: 2024,
    citationCount: 150,
    fieldsOfStudy: ['Computer Science', 'NLP'],
  }),
  createMockPaper({
    paperId: 'paper-cv-003',
    title: 'Computer Vision with Convolutional Networks',
    authors: [
      { name: 'Bob Wilson', authorId: 'bw-001' },
      { name: 'Carol Lee', authorId: 'cl-001' },
    ],
    year: 2022,
    citationCount: 1200,
    fieldsOfStudy: ['Computer Science', 'Computer Vision'],
  }),
];

/**
 * Create a mock Semantic Scholar search response
 */
export function createMockSearchResponse(
  papers: Paper[] = mockPapers,
  options: { total?: number; offset?: number } = {}
): SearchResult {
  return {
    total: options.total ?? papers.length,
    offset: options.offset ?? 0,
    data: papers,
  };
}
