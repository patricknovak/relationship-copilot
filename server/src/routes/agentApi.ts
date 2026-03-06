import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAgentAuth, AgentAuthRequest } from '../middleware/agentAuth';
import { AppError } from '../middleware/error';
import { sendToUser } from '../websocket';

const router = Router();

// All routes require agent API key auth
router.use(requireAgentAuth);

// GET /api/agent/events — Poll for pending events
router.get('/events', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT * FROM agent_events
       WHERE agent_id = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 50`,
      [req.agentId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/events/:id/acknowledge — Mark event as processed
router.post('/events/:id/acknowledge', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rowCount } = await query(
      `UPDATE agent_events SET status = 'acknowledged'
       WHERE id = $1 AND agent_id = $2`,
      [req.params.id, req.agentId]
    );

    if (rowCount === 0) {
      throw new AppError('Event not found', 404);
    }

    res.json({ data: { message: 'Event acknowledged' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/agent/relationships — List agent's relationships
router.get('/relationships', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT r.*,
        u.username as partner_username, u.display_name as partner_display_name,
        u.avatar_url as partner_avatar_url, u.user_type as partner_user_type
       FROM relationships r
       JOIN users u ON u.id = CASE WHEN r.user_id = $1 THEN r.partner_id ELSE r.user_id END
       WHERE r.user_id = $1 OR r.partner_id = $1
       ORDER BY r.last_interaction DESC NULLS LAST`,
      [req.agentId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/agent/relationships/:id — Accept/reject relationship request
router.put('/relationships/:id', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;

    if (!['active', 'archived', 'blocked'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const { rows } = await query(
      `UPDATE relationships SET status = $2, updated_at = NOW()
       WHERE id = $1 AND (user_id = $3 OR partner_id = $3)
       RETURNING *`,
      [req.params.id, status, req.agentId]
    );

    if (rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/relationships/:userId/request — Agent initiates relationship
router.post('/relationships/:userId/request', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;

    if (!type) {
      throw new AppError('type is required', 400);
    }

    // Determine category
    const { rows: targetRows } = await query('SELECT user_type FROM users WHERE id = $1', [req.params.userId]);
    if (targetRows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const targetType = targetRows[0].user_type;
    const category = targetType === 'agent' ? 'agent-agent' : 'human-agent';

    const { rows } = await query(
      `INSERT INTO relationships (user_id, partner_id, type, category, status, initiated_by)
       VALUES ($1, $2, $3, $4, 'pending', $1)
       RETURNING *`,
      [req.agentId, req.params.userId, type, category]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/messages/:relationshipId — Send message
router.post('/messages/:relationshipId', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, message_type } = req.body;

    if (!content) {
      throw new AppError('Content is required', 400);
    }

    // Verify agent is part of this relationship
    const rel = await query(
      'SELECT id, user_id, partner_id FROM relationships WHERE id = $1 AND (user_id = $2 OR partner_id = $2)',
      [req.params.relationshipId, req.agentId]
    );
    if (rel.rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    const { rows } = await query(
      `INSERT INTO messages (relationship_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.relationshipId, req.agentId, content, message_type || 'text']
    );

    // Update last_interaction
    await query(
      'UPDATE relationships SET last_interaction = NOW(), updated_at = NOW() WHERE id = $1',
      [req.params.relationshipId]
    );

    // Broadcast via WebSocket to the human partner
    const relationship = rel.rows[0];
    const partnerId = relationship.user_id === req.agentId ? relationship.partner_id : relationship.user_id;
    sendToUser(partnerId, {
      type: 'message:new',
      payload: {
        message: rows[0],
        relationshipId: req.params.relationshipId,
      },
    });

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/agent/profile — Get agent's own profile
router.get('/profile', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              ap.agent_type, ap.capabilities, ap.description, ap.framework, ap.status,
              ap.webhook_url, ap.websocket_enabled, ap.max_relationships
       FROM users u
       JOIN agent_profiles ap ON ap.user_id = u.id
       WHERE u.id = $1`,
      [req.agentId]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/agent/profile — Update agent's profile
router.put('/profile', async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { display_name, description, capabilities, webhook_url } = req.body;

    if (display_name) {
      await query('UPDATE users SET display_name = $2, updated_at = NOW() WHERE id = $1', [req.agentId, display_name]);
    }

    await query(
      `UPDATE agent_profiles SET
        description = COALESCE($2, description),
        capabilities = COALESCE($3, capabilities),
        webhook_url = COALESCE($4, webhook_url),
        updated_at = NOW()
       WHERE user_id = $1`,
      [req.agentId, description, capabilities ? JSON.stringify(capabilities) : null, webhook_url]
    );

    res.json({ data: { message: 'Profile updated' } });
  } catch (err) {
    next(err);
  }
});

export default router;
