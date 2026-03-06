import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// GET /api/milestones/upcoming — Upcoming milestones across all relationships
router.get('/upcoming', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT m.*, r.type as relationship_type,
              u.username as partner_username, u.display_name as partner_display_name
       FROM milestones m
       JOIN relationships r ON r.id = m.relationship_id
       JOIN users u ON u.id = r.partner_id
       WHERE r.user_id = $1 AND m.date >= CURRENT_DATE AND m.celebrated = false
       ORDER BY m.date ASC
       LIMIT 20`,
      [req.userId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/milestones/:relationshipId
router.get('/:relationshipId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      'SELECT * FROM milestones WHERE relationship_id = $1 ORDER BY date DESC',
      [req.params.relationshipId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/milestones
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { relationship_id, title, description, milestone_type, date } = req.body;

    if (!relationship_id || !title || !date) {
      throw new AppError('relationship_id, title, and date are required', 400);
    }

    const { rows } = await query(
      `INSERT INTO milestones (relationship_id, title, description, milestone_type, date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [relationship_id, title, description || null, milestone_type || 'custom', date]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/milestones/:id/celebrate
router.put('/:id/celebrate', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      'UPDATE milestones SET celebrated = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (rows.length === 0) {
      throw new AppError('Milestone not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
