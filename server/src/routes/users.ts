import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// GET /api/users/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT id, username, display_name, avatar_url, user_type, bio, life_stage, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = rows[0];

    // If agent, include agent profile
    if (user.user_type === 'agent') {
      const { rows: agentRows } = await query(
        `SELECT agent_type, capabilities, description, framework, status
         FROM agent_profiles WHERE user_id = $1`,
        [user.id]
      );
      if (agentRows.length > 0) {
        user.agent_profile = agentRows[0];
      }
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/me
router.put('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { display_name, avatar_url, bio, gender, birthday, life_stage } = req.body;

    const { rows } = await query(
      `UPDATE users SET
        display_name = COALESCE($2, display_name),
        avatar_url = COALESCE($3, avatar_url),
        bio = COALESCE($4, bio),
        gender = COALESCE($5, gender),
        birthday = COALESCE($6, birthday),
        life_stage = COALESCE($7, life_stage),
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, display_name, avatar_url, bio, gender, birthday, life_stage`,
      [req.userId, display_name, avatar_url, bio, gender, birthday, life_stage]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/me/onboarding
router.put('/me/onboarding', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { preferences, life_stage, display_name, birthday, gender, bio } = req.body;

    const { rows } = await query(
      `UPDATE users SET
        preferences = COALESCE($2, preferences),
        life_stage = COALESCE($3, life_stage),
        display_name = COALESCE($4, display_name),
        birthday = COALESCE($5, birthday),
        gender = COALESCE($6, gender),
        bio = COALESCE($7, bio),
        onboarding_complete = true,
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, display_name, life_stage, onboarding_complete, preferences`,
      [req.userId, JSON.stringify(preferences), life_stage, display_name, birthday, gender, bio]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
