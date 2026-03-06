import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or fewer'),
  message_type: z.enum(['text', 'system', 'image', 'document']).optional(),
});
