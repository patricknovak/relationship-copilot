import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// GET /api/messages/:relationshipId
router.get('/:relationshipId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify user is part of this relationship
    const rel = await query(
      'SELECT id FROM relationships WHERE id = $1 AND (user_id = $2 OR partner_id = $2)',
      [req.params.relationshipId, req.userId]
    );
    if (rel.rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    const { rows } = await query(
      `SELECT m.*, u.username as sender_username, u.display_name as sender_display_name,
              u.avatar_url as sender_avatar_url, u.user_type as sender_user_type
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.relationship_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.relationshipId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM messages WHERE relationship_id = $1',
      [req.params.relationshipId]
    );

    res.json({
      data: rows.reverse(),
      total: parseInt(countResult.rows[0].count),
      page: Math.floor(offset / limit) + 1,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/:relationshipId
router.post('/:relationshipId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, message_type } = req.body;

    if (!content) {
      throw new AppError('Content is required', 400);
    }

    // Verify user is part of this relationship
    const rel = await query(
      'SELECT id, partner_id, user_id FROM relationships WHERE id = $1 AND (user_id = $2 OR partner_id = $2)',
      [req.params.relationshipId, req.userId]
    );
    if (rel.rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    const { rows } = await query(
      `INSERT INTO messages (relationship_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.relationshipId, req.userId, content, message_type || 'text']
    );

    // Update last_interaction on the relationship
    await query(
      'UPDATE relationships SET last_interaction = NOW(), updated_at = NOW() WHERE id = $1',
      [req.params.relationshipId]
    );

    // TODO: Broadcast via WebSocket
    // TODO: If partner is agent, deliver event via webhook/WS/poll

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
