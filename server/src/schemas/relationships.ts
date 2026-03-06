import { z } from 'zod';

export const createRelationshipSchema = z.object({
  partner_id: z.string().uuid('partner_id must be a valid UUID'),
  type: z.enum([
    'romantic', 'friend', 'family', 'colleague', 'mentor',
    'parent_child', 'sibling', 'professional', 'companion',
    'advisor', 'coach', 'collaboration',
  ]),
  category: z.enum(['human-human', 'human-agent', 'agent-agent']),
  sub_type: z.string().optional(),
  how_met: z.string().optional(),
  start_date: z.string().optional(),
});

export const updateRelationshipSchema = z.object({
  status: z.enum(['active', 'pending', 'archived', 'blocked']),
});
