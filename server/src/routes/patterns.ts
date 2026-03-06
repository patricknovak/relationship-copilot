import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/patterns/:relationshipId
router.get('/:relationshipId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT * FROM relationship_patterns
       WHERE relationship_id = $1
       ORDER BY detected_at DESC
       LIMIT 20`,
      [req.params.relationshipId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/patterns/:id/acknowledge
router.put('/:id/acknowledge', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await query(
      'UPDATE relationship_patterns SET acknowledged = true WHERE id = $1',
      [req.params.id]
    );

    res.json({ data: { message: 'Pattern acknowledged' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/patterns/dashboard — All patterns across all relationships
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT rp.*, r.type as relationship_type,
              u.username as partner_username, u.display_name as partner_display_name
       FROM relationship_patterns rp
       JOIN relationships r ON r.id = rp.relationship_id
       JOIN users u ON u.id = r.partner_id
       WHERE r.user_id = $1 AND rp.acknowledged = false
       ORDER BY
         CASE rp.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
         rp.detected_at DESC
       LIMIT 50`,
      [req.userId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
