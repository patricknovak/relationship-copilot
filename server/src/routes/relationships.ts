import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// GET /api/relationships
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, status, category } = req.query;

    let sql = `
      SELECT r.*,
        u.username as partner_username, u.display_name as partner_display_name,
        u.avatar_url as partner_avatar_url, u.user_type as partner_user_type
      FROM relationships r
      JOIN users u ON u.id = r.partner_id
      WHERE r.user_id = $1
    `;
    const params: unknown[] = [req.userId];

    if (type) {
      params.push(type);
      sql += ` AND r.type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (category) {
      params.push(category);
      sql += ` AND r.category = $${params.length}`;
    }

    sql += ' ORDER BY r.last_interaction DESC NULLS LAST, r.created_at DESC';

    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/relationships
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { partner_id, type, category, sub_type, how_met, start_date } = req.body;

    if (!partner_id || !type || !category) {
      throw new AppError('partner_id, type, and category are required', 400);
    }

    // Check if relationship already exists
    const existing = await query(
      'SELECT id FROM relationships WHERE user_id = $1 AND partner_id = $2',
      [req.userId, partner_id]
    );
    if (existing.rows.length > 0) {
      throw new AppError('Relationship already exists', 409);
    }

    const { rows } = await query(
      `INSERT INTO relationships (user_id, partner_id, type, category, sub_type, status, initiated_by, how_met, start_date, life_stage_at_start)
       VALUES ($1, $2, $3, $4, $5, 'pending', $1, $6, $7, (SELECT life_stage FROM users WHERE id = $1))
       RETURNING *`,
      [req.userId, partner_id, type, category, sub_type || null, how_met || null, start_date || null]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/relationships/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT r.*,
        u.username as partner_username, u.display_name as partner_display_name,
        u.avatar_url as partner_avatar_url, u.user_type as partner_user_type
       FROM relationships r
       JOIN users u ON u.id = r.partner_id
       WHERE r.id = $1 AND (r.user_id = $2 OR r.partner_id = $2)`,
      [req.params.id, req.userId]
    );

    if (rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/relationships/:id
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;

    if (!status) {
      throw new AppError('status is required', 400);
    }

    const { rows } = await query(
      `UPDATE relationships SET status = $2, updated_at = NOW()
       WHERE id = $1 AND (user_id = $3 OR partner_id = $3)
       RETURNING *`,
      [req.params.id, status, req.userId]
    );

    if (rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/relationships/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM relationships WHERE id = $1 AND (user_id = $2 OR partner_id = $2)',
      [req.params.id, req.userId]
    );

    if (rowCount === 0) {
      throw new AppError('Relationship not found', 404);
    }

    res.json({ data: { message: 'Relationship removed' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/relationships/:id/health
router.get('/:id/health', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT * FROM health_snapshots
       WHERE relationship_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
