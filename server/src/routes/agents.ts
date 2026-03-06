import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// POST /api/agents/register — Register a new agent (returns API key)
router.post('/register', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username, display_name, agent_type, description, capabilities, webhook_url, framework } = req.body;

    if (!username || !agent_type) {
      throw new AppError('username and agent_type are required', 400);
    }

    const validTypes = ['mentor', 'assistant', 'companion', 'advisor', 'coach'];
    if (!validTypes.includes(agent_type)) {
      throw new AppError(`agent_type must be one of: ${validTypes.join(', ')}`, 400);
    }

    // Generate API key
    const apiKey = `rc_agent_${uuidv4().replace(/-/g, '')}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    // Create user account for the agent
    const { rows: userRows } = await query(
      `INSERT INTO users (username, display_name, user_type, bio)
       VALUES ($1, $2, 'agent', $3)
       RETURNING id, username, display_name, user_type`,
      [username, display_name || username, description || null]
    );

    const agentUser = userRows[0];

    // Create agent profile
    await query(
      `INSERT INTO agent_profiles (user_id, agent_type, api_key_hash, webhook_url, capabilities, description, framework, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        agentUser.id,
        agent_type,
        apiKeyHash,
        webhook_url || null,
        JSON.stringify(capabilities || []),
        description || null,
        framework || 'custom',
        req.userId,
      ]
    );

    res.status(201).json({
      data: {
        agent: agentUser,
        api_key: apiKey, // Only shown once!
        message: 'Save this API key - it will not be shown again.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents — List all discoverable agents
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              ap.agent_type, ap.capabilities, ap.description, ap.framework, ap.status
       FROM users u
       JOIN agent_profiles ap ON ap.user_id = u.id
       WHERE ap.status = 'active'
       ORDER BY u.created_at DESC`
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/my-agents — List agents owned by current user
router.get('/my-agents', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.display_name,
              ap.agent_type, ap.capabilities, ap.description, ap.framework, ap.status,
              ap.webhook_url, ap.websocket_enabled
       FROM users u
       JOIN agent_profiles ap ON ap.user_id = u.id
       WHERE ap.owner_id = $1
       ORDER BY u.created_at DESC`,
      [req.userId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:id — Get agent detail
router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.created_at,
              ap.agent_type, ap.capabilities, ap.description, ap.framework, ap.status
       FROM users u
       JOIN agent_profiles ap ON ap.user_id = u.id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      throw new AppError('Agent not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/agents/:id — Update agent (owner only)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify ownership
    const { rows: ownerCheck } = await query(
      'SELECT user_id FROM agent_profiles WHERE user_id = $1 AND owner_id = $2',
      [req.params.id, req.userId]
    );
    if (ownerCheck.length === 0) {
      throw new AppError('Agent not found or not owned by you', 403);
    }

    const { description, capabilities, webhook_url, framework, status } = req.body;

    await query(
      `UPDATE agent_profiles SET
        description = COALESCE($2, description),
        capabilities = COALESCE($3, capabilities),
        webhook_url = COALESCE($4, webhook_url),
        framework = COALESCE($5, framework),
        status = COALESCE($6, status),
        updated_at = NOW()
       WHERE user_id = $1`,
      [req.params.id, description, capabilities ? JSON.stringify(capabilities) : null, webhook_url, framework, status]
    );

    res.json({ data: { message: 'Agent updated' } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/agents/:id — Deactivate agent (owner only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rowCount } = await query(
      `UPDATE agent_profiles SET status = 'inactive', updated_at = NOW()
       WHERE user_id = $1 AND owner_id = $2`,
      [req.params.id, req.userId]
    );

    if (rowCount === 0) {
      throw new AppError('Agent not found or not owned by you', 403);
    }

    res.json({ data: { message: 'Agent deactivated' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/agents/:id/regenerate-key — Regenerate API key
router.post('/:id/regenerate-key', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows: ownerCheck } = await query(
      'SELECT user_id FROM agent_profiles WHERE user_id = $1 AND owner_id = $2',
      [req.params.id, req.userId]
    );
    if (ownerCheck.length === 0) {
      throw new AppError('Agent not found or not owned by you', 403);
    }

    const apiKey = `rc_agent_${uuidv4().replace(/-/g, '')}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    await query(
      'UPDATE agent_profiles SET api_key_hash = $2, updated_at = NOW() WHERE user_id = $1',
      [req.params.id, apiKeyHash]
    );

    res.json({
      data: {
        api_key: apiKey,
        message: 'Save this API key - it will not be shown again.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/marketplace/featured — Featured agents
router.get('/marketplace/featured', async (_req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              ap.agent_type, ap.capabilities, ap.description, ap.framework,
              COALESCE(AVG(ar.rating), 0) AS avg_rating,
              COUNT(ar.id) AS review_count
       FROM users u
       JOIN agent_profiles ap ON ap.user_id = u.id
       LEFT JOIN agent_reviews ar ON ar.agent_id = u.id
       WHERE ap.status = 'active'
       GROUP BY u.id, ap.user_id, ap.agent_type, ap.capabilities, ap.description, ap.framework
       HAVING COUNT(ar.id) > 0
       ORDER BY avg_rating DESC, review_count DESC
       LIMIT 20`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:id/reviews — Get agent reviews
router.get('/:id/reviews', async (req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT ar.*, u.username AS reviewer_username, u.display_name AS reviewer_display_name
       FROM agent_reviews ar
       JOIN users u ON u.id = ar.reviewer_id
       WHERE ar.agent_id = $1
       ORDER BY ar.created_at DESC`,
      [req.params.id]
    );

    const stats = await query(
      `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
       FROM agent_reviews WHERE agent_id = $1`,
      [req.params.id]
    );

    res.json({
      data: {
        reviews: rows,
        stats: {
          total: parseInt(stats.rows[0].total, 10),
          avg_rating: parseFloat(stats.rows[0].avg_rating),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/agents/:id/reviews — Add agent review
router.post('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rating, review_text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    // Verify agent exists
    const agent = await query(`SELECT user_id FROM agent_profiles WHERE user_id = $1`, [req.params.id]);
    if (agent.rows.length === 0) throw new AppError('Agent not found', 404);

    // Can't review your own agent
    if (req.params.id === req.userId) throw new AppError('Cannot review your own agent', 400);

    const { rows } = await query(
      `INSERT INTO agent_reviews (agent_id, reviewer_id, rating, review_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, reviewer_id) DO UPDATE SET rating = $3, review_text = $4, created_at = NOW()
       RETURNING *`,
      [req.params.id, req.userId, rating, review_text || null]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:id/tools — Get agent's declared tools
router.get('/:id/tools', async (req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT * FROM agent_tools WHERE agent_id = $1 ORDER BY tool_name`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
