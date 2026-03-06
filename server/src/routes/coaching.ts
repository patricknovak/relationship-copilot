import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// List available coach agents
router.get('/coaches', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              ap.agent_type, ap.capabilities, ap.description, ap.framework,
              COALESCE(AVG(ar.rating), 0) AS avg_rating,
              COUNT(ar.id) AS review_count
       FROM users u
       JOIN agent_profiles ap ON ap.user_id = u.id
       LEFT JOIN agent_reviews ar ON ar.agent_id = u.id
       WHERE u.user_type = 'agent' AND ap.agent_type IN ('coach', 'mentor', 'advisor')
         AND ap.status = 'active'
       GROUP BY u.id, ap.user_id, ap.agent_type, ap.capabilities, ap.description, ap.framework
       ORDER BY avg_rating DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coaches' });
  }
});

// Start coaching session
router.post('/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { agent_id, relationship_id, topic, category } = req.body;

    if (!agent_id) return res.status(400).json({ error: 'agent_id required' });

    // Verify agent is a coach type
    const agent = await db.query(
      `SELECT ap.agent_type FROM agent_profiles ap WHERE ap.user_id = $1 AND ap.agent_type IN ('coach', 'mentor', 'advisor')`,
      [agent_id]
    );
    if (agent.rows.length === 0) return res.status(400).json({ error: 'Invalid coach agent' });

    const result = await db.query(
      `INSERT INTO coaching_sessions (user_id, agent_id, relationship_id, topic, category)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, agent_id, relationship_id || null, topic || null, category || null]
    );

    // Queue event for agent
    await db.query(
      `INSERT INTO agent_events (agent_id, event_type, payload)
       VALUES ($1, 'coaching.session_started', $2)`,
      [agent_id, JSON.stringify({
        session_id: result.rows[0].id,
        user_id: req.userId,
        relationship_id,
        topic,
        category,
      })]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// List user's coaching sessions
router.get('/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT cs.*, u.username AS agent_username, u.display_name AS agent_display_name
      FROM coaching_sessions cs
      JOIN users u ON u.id = cs.agent_id
      WHERE cs.user_id = $1
    `;
    const params: unknown[] = [req.userId];

    if (status) {
      query += ` AND cs.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY cs.started_at DESC`;

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session detail
router.get('/sessions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const session = await db.query(
      `SELECT cs.*, u.username AS agent_username, u.display_name AS agent_display_name
       FROM coaching_sessions cs
       JOIN users u ON u.id = cs.agent_id
       WHERE cs.id = $1 AND (cs.user_id = $2 OR cs.agent_id = $2)`,
      [req.params.id, req.userId]
    );

    if (session.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    // Get messages for this session (stored in session_data as messages array)
    res.json({ data: session.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Send message in coaching session
router.post('/sessions/:id/message', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const session = await db.query(
      `SELECT * FROM coaching_sessions WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [req.params.id, req.userId]
    );
    if (session.rows.length === 0) return res.status(404).json({ error: 'Active session not found' });

    // Append message to session_data
    const sessionData = session.rows[0].session_data || {};
    const messages = sessionData.messages || [];
    messages.push({
      sender_id: req.userId,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    });

    await db.query(
      `UPDATE coaching_sessions SET session_data = $2 WHERE id = $1`,
      [req.params.id, JSON.stringify({ ...sessionData, messages })]
    );

    // Notify coach agent
    await db.query(
      `INSERT INTO agent_events (agent_id, event_type, payload)
       VALUES ($1, 'coaching.message_received', $2)`,
      [session.rows[0].agent_id, JSON.stringify({
        session_id: req.params.id,
        sender_id: req.userId,
        content: content.trim(),
      })]
    );

    res.json({ data: { success: true, message_count: messages.length } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// End coaching session
router.put('/sessions/:id/end', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const session = await db.query(
      `SELECT * FROM coaching_sessions WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [req.params.id, req.userId]
    );
    if (session.rows.length === 0) return res.status(404).json({ error: 'Active session not found' });

    const result = await db.query(
      `UPDATE coaching_sessions SET status = 'completed', ended_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    // Notify agent
    await db.query(
      `INSERT INTO agent_events (agent_id, event_type, payload)
       VALUES ($1, 'coaching.session_ended', $2)`,
      [session.rows[0].agent_id, JSON.stringify({ session_id: req.params.id })]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

export default router;
