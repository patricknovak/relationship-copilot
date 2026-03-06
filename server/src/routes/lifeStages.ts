import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// Get current user's life stage info and relevant guides
router.get('/current', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await db.query(`SELECT life_stage FROM users WHERE id = $1`, [req.userId]);
    const lifeStage = user.rows[0]?.life_stage;

    // Get recent events
    const events = await db.query(
      `SELECT * FROM life_stage_events WHERE user_id = $1 ORDER BY date DESC LIMIT 10`,
      [req.userId]
    );

    // Get relevant guides
    let guides = { rows: [] as Record<string, unknown>[] };
    if (lifeStage) {
      guides = await db.query(
        `SELECT * FROM life_stage_guides WHERE life_stage = $1 ORDER BY created_at`,
        [lifeStage]
      );
    }

    res.json({
      data: {
        life_stage: lifeStage,
        events: events.rows,
        guides: guides.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch life stage info' });
  }
});

// Record life stage transition
router.post('/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const { to_stage, event_type, notes, date } = req.body;

    if (!to_stage) return res.status(400).json({ error: 'to_stage required' });

    const user = await db.query(`SELECT life_stage FROM users WHERE id = $1`, [req.userId]);
    const fromStage = user.rows[0]?.life_stage;

    // Record the event
    const result = await db.query(
      `INSERT INTO life_stage_events (user_id, from_stage, to_stage, event_type, notes, date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, fromStage || null, to_stage, event_type || null, notes || null, date || new Date().toISOString().split('T')[0]]
    );

    // Update user's life stage
    await db.query(`UPDATE users SET life_stage = $2, updated_at = NOW() WHERE id = $1`, [req.userId, to_stage]);

    // Create notification
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'life_stage_change', 'Life Stage Updated',
               $2, $3)`,
      [
        req.userId,
        `You've entered a new life stage: ${to_stage}. Check out personalized guidance for this transition.`,
        JSON.stringify({ event_id: result.rows[0].id, to_stage }),
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// Get guides for a specific life stage
router.get('/guides', requireAuth, async (req: Request, res: Response) => {
  try {
    const { life_stage, event_type } = req.query;

    let query = `SELECT * FROM life_stage_guides WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (life_stage) {
      query += ` AND life_stage = $${idx++}`;
      params.push(life_stage);
    }
    if (event_type) {
      query += ` AND event_type = $${idx++}`;
      params.push(event_type);
    }

    query += ` ORDER BY created_at`;
    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guides' });
  }
});

// Get guide for a specific event type
router.get('/guides/:eventType', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await db.query(`SELECT life_stage FROM users WHERE id = $1`, [req.userId]);
    const lifeStage = user.rows[0]?.life_stage;

    let query = `SELECT * FROM life_stage_guides WHERE event_type = $1`;
    const params: unknown[] = [req.params.eventType];

    if (lifeStage) {
      query += ` AND life_stage = $2`;
      params.push(lifeStage);
    }

    query += ` ORDER BY created_at`;
    const result = await db.query(query, params);

    // Also fetch generic guides for this event type (no life stage filter)
    if (lifeStage) {
      const generic = await db.query(
        `SELECT * FROM life_stage_guides WHERE event_type = $1 AND life_stage != $2 ORDER BY created_at`,
        [req.params.eventType, lifeStage]
      );
      res.json({ data: { relevant: result.rows, other: generic.rows } });
    } else {
      res.json({ data: { relevant: result.rows, other: [] } });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guide' });
  }
});

export default router;
