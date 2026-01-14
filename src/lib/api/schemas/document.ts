import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim(),
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim().optional(),
  content: z.any().optional(),
  content_text: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
