import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// GET /api/goals/:relationshipId
router.get('/:relationshipId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify user is part of this relationship
    const rel = await query(
      'SELECT id FROM relationships WHERE id = $1 AND (user_id = $2 OR partner_id = $2)',
      [req.params.relationshipId, req.userId]
    );
    if (rel.rows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    const { rows } = await query(
      `SELECT g.*, u.username as created_by_username
       FROM goals g
       JOIN users u ON u.id = g.user_id
       WHERE g.relationship_id = $1
       ORDER BY g.created_at DESC`,
      [req.params.relationshipId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/goals
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { relationship_id, title, description, category, target_date } = req.body;

    if (!title) {
      throw new AppError('title is required', 400);
    }

    const { rows } = await query(
      `INSERT INTO goals (relationship_id, user_id, title, description, category, target_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [relationship_id || null, req.userId, title, description || null, category || null, target_date || null]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/goals/:id
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, status, progress } = req.body;

    const completedAt = status === 'completed' ? 'NOW()' : 'completed_at';

    const { rows } = await query(
      `UPDATE goals SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        progress = COALESCE($5, progress),
        completed_at = ${status === 'completed' ? 'NOW()' : 'completed_at'}
       WHERE id = $1
       RETURNING *`,
      [req.params.id, title, description, status, progress]
    );

    if (rows.length === 0) {
      throw new AppError('Goal not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rowCount } = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);

    if (rowCount === 0) {
      throw new AppError('Goal not found or not owned by you', 404);
    }

    res.json({ data: { message: 'Goal deleted' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/goals/suggestions/:relationshipId — AI-suggested goals
router.get('/suggestions/:relationshipId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get relationship details for context
    const { rows: relRows } = await query(
      'SELECT type, health_score, streak_count FROM relationships WHERE id = $1',
      [req.params.relationshipId]
    );

    if (relRows.length === 0) {
      throw new AppError('Relationship not found', 404);
    }

    const rel = relRows[0];
    const suggestions = generateGoalSuggestions(rel.type, rel.health_score, rel.streak_count);

    res.json({ data: suggestions });
  } catch (err) {
    next(err);
  }
});

function generateGoalSuggestions(type: string, healthScore: number, streakCount: number) {
  const suggestions: { title: string; description: string; category: string }[] = [];

  // Health-based suggestions
  if (healthScore < 50) {
    suggestions.push({
      title: 'Daily Check-in',
      description: 'Send at least one message every day for a week',
      category: 'communication',
    });
    suggestions.push({
      title: 'Reconnect Call',
      description: 'Schedule a meaningful conversation to reconnect',
      category: 'quality_time',
    });
  }

  // Streak-based suggestions
  if (streakCount === 0) {
    suggestions.push({
      title: 'Start a Streak',
      description: 'Build a 7-day communication streak',
      category: 'communication',
    });
  } else if (streakCount >= 7 && streakCount < 30) {
    suggestions.push({
      title: 'Month Streak Challenge',
      description: 'Extend your streak to 30 days!',
      category: 'communication',
    });
  }

  // Type-based suggestions
  if (type === 'romantic') {
    suggestions.push({ title: 'Plan a Date', description: 'Plan something special together', category: 'quality_time' });
    suggestions.push({ title: 'Share Gratitude', description: 'Tell each other 3 things you appreciate', category: 'growth' });
  } else if (type === 'family' || type === 'parent_child') {
    suggestions.push({ title: 'Family Activity', description: 'Plan a shared activity or outing', category: 'quality_time' });
  } else if (type === 'colleague' || type === 'professional') {
    suggestions.push({ title: 'Skill Share', description: 'Teach each other something new', category: 'growth' });
  } else if (type === 'friend') {
    suggestions.push({ title: 'Catch Up Session', description: 'Have an in-depth catch-up conversation', category: 'quality_time' });
  }

  // Universal suggestions
  suggestions.push({
    title: 'Active Listening',
    description: 'Practice active listening in your next conversation',
    category: 'communication',
  });

  return suggestions;
}

export default router;
