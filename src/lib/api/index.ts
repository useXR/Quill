export { ApiError, ErrorCodes } from './errors';
export { formatZodError, getFieldErrors } from './format-errors';
export { handleApiError } from './handle-error';
export type { ApiResponse, PaginatedResponse } from './types';
export { getProjects, getProject, createProject, updateProject, deleteProject } from './projects';
export type { GetProjectsOptions } from './projects';
export { getDocuments, getDocument, createDocument, updateDocument, deleteDocument } from './documents';
export { CreateProjectSchema, UpdateProjectSchema } from './schemas';
export type { CreateProjectInput, UpdateProjectInput } from './schemas';
export { CreateDocumentSchema, UpdateDocumentSchema } from './schemas';
export type { CreateDocumentInput, UpdateDocumentInput } from './schemas';

// Chat history helpers
export { getChatHistory, saveChatMessage, clearChatHistory } from './chat';
export type { ChatMessage, PaginatedResult } from './chat';

// AI operations helpers
export { createAIOperation, updateAIOperationStatus, getRecentOperations, getOperationById } from './ai-operations';
export type { AIOperation, CreateAIOperationInput } from './ai-operations';

// Citations helpers
export { getCitations } from './citations';
