import { z } from 'zod';

export const createGoalSchema = z.object({
  relationship_id: z.string().uuid('relationship_id must be a valid UUID').optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer').optional(),
  category: z.string().max(100).optional(),
  target_date: z.string().optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
  progress: z.number().min(0).max(100).optional(),
});
