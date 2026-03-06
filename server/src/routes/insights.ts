import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { generateInsightsForUser } from '../services/insights.service';

const router = Router();

// Generate and get insights
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Trigger insight generation
    await generateInsightsForUser(req.userId!);

    const { status = 'active' } = req.query;

    const result = await db.query(
      `SELECT i.*, r.type AS relationship_type,
              u.username AS partner_username, u.display_name AS partner_display_name
       FROM insights i
       LEFT JOIN relationships r ON r.id = i.relationship_id
       LEFT JOIN users u ON u.id = r.partner_id
       WHERE i.user_id = $1 AND i.status = $2
       ORDER BY
         CASE i.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
         i.created_at DESC`,
      [req.userId, status]
    );

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Get insights for specific relationship
router.get('/relationship/:relationshipId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM insights
       WHERE user_id = $1 AND relationship_id = $2 AND status = 'active'
       ORDER BY created_at DESC`,
      [req.userId, req.params.relationshipId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Dismiss insight
router.put('/:id/dismiss', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await db.query(
      `UPDATE insights SET status = 'dismissed', dismissed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss insight' });
  }
});

// Relationship timeline
router.get('/timeline/:relationshipId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM relationship_timeline
       WHERE relationship_id = $1
       ORDER BY event_date DESC
       LIMIT 50`,
      [req.params.relationshipId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// Add timeline event
router.post('/timeline/:relationshipId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, title, description, event_date } = req.body;

    if (!event_type || !title) {
      return res.status(400).json({ error: 'event_type and title are required' });
    }

    // Verify relationship belongs to user
    const rel = await db.query(
      `SELECT id FROM relationships WHERE id = $1 AND user_id = $2`,
      [req.params.relationshipId, req.userId]
    );
    if (rel.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });

    const result = await db.query(
      `INSERT INTO relationship_timeline (relationship_id, event_type, title, description, event_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.relationshipId, event_type, title, description || null, event_date || new Date().toISOString()]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add timeline event' });
  }
});

export default router;
