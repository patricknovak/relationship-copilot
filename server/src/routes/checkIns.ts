import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// List available check-in templates
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const { relationship_type, frequency } = req.query;

    let query = `SELECT * FROM check_in_templates WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (relationship_type) {
      query += ` AND (relationship_type = $${idx++} OR relationship_type IS NULL)`;
      params.push(relationship_type);
    }
    if (frequency) {
      query += ` AND frequency = $${idx++}`;
      params.push(frequency);
    }

    query += ` ORDER BY created_at`;
    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get a specific template
router.get('/templates/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.query(`SELECT * FROM check_in_templates WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Submit check-in response
router.post('/respond', requireAuth, async (req: Request, res: Response) => {
  try {
    const { template_id, relationship_id, answers, mood_score, notes } = req.body;

    if (!template_id || !answers) {
      return res.status(400).json({ error: 'template_id and answers required' });
    }

    const result = await db.query(
      `INSERT INTO check_in_responses (template_id, user_id, relationship_id, answers, mood_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [template_id, req.userId, relationship_id || null, JSON.stringify(answers), mood_score || null, notes || null]
    );

    // Update relationship health if mood score provided and relationship specified
    if (mood_score && relationship_id) {
      // mood_score is 1-10, health is 0-100 — blend it with current health
      const rel = await db.query(
        `SELECT health_score FROM relationships WHERE id = $1 AND user_id = $2`,
        [relationship_id, req.userId]
      );
      if (rel.rows.length > 0) {
        const currentHealth = rel.rows[0].health_score || 50;
        const moodAsHealth = mood_score * 10;
        const newHealth = Math.round(currentHealth * 0.7 + moodAsHealth * 0.3);

        await db.query(
          `UPDATE relationships SET health_score = $2, updated_at = NOW() WHERE id = $1`,
          [relationship_id, Math.min(100, Math.max(0, newHealth))]
        );

        // Record health snapshot
        await db.query(
          `INSERT INTO health_snapshots (relationship_id, score, factors)
           VALUES ($1, $2, $3)`,
          [relationship_id, newHealth, JSON.stringify({ source: 'check_in', mood_score })]
        );
      }
    }

    // Add timeline event
    if (relationship_id) {
      await db.query(
        `INSERT INTO relationship_timeline (relationship_id, event_type, title, data)
         VALUES ($1, 'check_in', 'Check-in completed', $2)`,
        [relationship_id, JSON.stringify({ template_id, mood_score })]
      );
    }

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit check-in' });
  }
});

// Get check-in history
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { relationship_id, limit = '20' } = req.query;

    let query = `
      SELECT cr.*, ct.title AS template_title, ct.frequency
      FROM check_in_responses cr
      JOIN check_in_templates ct ON ct.id = cr.template_id
      WHERE cr.user_id = $1
    `;
    const params: unknown[] = [req.userId];
    let idx = 2;

    if (relationship_id) {
      query += ` AND cr.relationship_id = $${idx++}`;
      params.push(relationship_id);
    }

    query += ` ORDER BY cr.created_at DESC LIMIT $${idx++}`;
    params.push(Number(limit));

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get mood trends
router.get('/trends', requireAuth, async (req: Request, res: Response) => {
  try {
    const { relationship_id, days = '30' } = req.query;

    let query = `
      SELECT DATE(cr.created_at) AS date, AVG(cr.mood_score) AS avg_mood, COUNT(*) AS count
      FROM check_in_responses cr
      WHERE cr.user_id = $1
        AND cr.mood_score IS NOT NULL
        AND cr.created_at > NOW() - INTERVAL '1 day' * $2
    `;
    const params: unknown[] = [req.userId, Number(days)];
    let idx = 3;

    if (relationship_id) {
      query += ` AND cr.relationship_id = $${idx++}`;
      params.push(relationship_id);
    }

    query += ` GROUP BY DATE(cr.created_at) ORDER BY date`;

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

export default router;
