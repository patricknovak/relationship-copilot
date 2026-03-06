import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/health/dashboard — Aggregate health across all relationships
router.get('/dashboard', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.type, r.category, r.health_score, r.streak_count,
              u.username as partner_username, u.display_name as partner_display_name
       FROM relationships r
       JOIN users u ON u.id = r.partner_id
       WHERE r.user_id = $1 AND r.status = 'active'
       ORDER BY r.health_score ASC`,
      [req.userId]
    );

    const total = rows.length;
    const avgHealth = total > 0 ? Math.round(rows.reduce((sum, r) => sum + r.health_score, 0) / total) : 0;
    const needsAttention = rows.filter((r) => r.health_score < 40);

    res.json({
      data: {
        total_relationships: total,
        average_health: avgHealth,
        relationships: rows,
        needs_attention: needsAttention,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/health/:relationshipId/history — Health trend over time
router.get('/:relationshipId/history', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT * FROM health_snapshots
       WHERE relationship_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.params.relationshipId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
