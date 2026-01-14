import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
});

export const UpdateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim().optional(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional().nullable(),
  status: z.enum(['draft', 'submitted', 'funded']).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
