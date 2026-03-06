import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// GET /api/privacy/settings
router.get('/settings', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      'SELECT preferences FROM users WHERE id = $1',
      [req.userId]
    );

    if (rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const preferences = rows[0].preferences || {};
    const privacySettings = {
      discover_visible: preferences.discover_visible ?? true,
      show_life_stage: preferences.show_life_stage ?? true,
      show_bio: preferences.show_bio ?? true,
      show_birthday: preferences.show_birthday ?? false,
    };

    res.json({ data: privacySettings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/privacy/settings
router.put('/settings', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { discover_visible, show_life_stage, show_bio, show_birthday } = req.body;

    // Get current preferences
    const { rows: currentRows } = await query(
      'SELECT preferences FROM users WHERE id = $1',
      [req.userId]
    );

    if (currentRows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const preferences = currentRows[0].preferences || {};

    // Merge privacy settings into preferences
    if (discover_visible !== undefined) preferences.discover_visible = discover_visible;
    if (show_life_stage !== undefined) preferences.show_life_stage = show_life_stage;
    if (show_bio !== undefined) preferences.show_bio = show_bio;
    if (show_birthday !== undefined) preferences.show_birthday = show_birthday;

    const { rows } = await query(
      `UPDATE users SET preferences = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING preferences`,
      [req.userId, JSON.stringify(preferences)]
    );

    const updated = rows[0].preferences || {};
    res.json({
      data: {
        discover_visible: updated.discover_visible ?? true,
        show_life_stage: updated.show_life_stage ?? true,
        show_bio: updated.show_bio ?? true,
        show_birthday: updated.show_birthday ?? false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/privacy/export
router.get('/export', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Gather all user data
    const { rows: userRows } = await query(
      `SELECT id, email, username, display_name, avatar_url, bio, gender, birthday,
              life_stage, preferences, onboarding_complete, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (userRows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const { rows: relationships } = await query(
      `SELECT id, user1_id, user2_id, relationship_type, status, created_at
       FROM relationships WHERE user1_id = $1 OR user2_id = $1`,
      [req.userId]
    );

    const { rows: messages } = await query(
      `SELECT m.id, m.relationship_id, m.sender_id, m.content, m.message_type, m.created_at
       FROM messages m
       JOIN relationships r ON m.relationship_id = r.id
       WHERE r.user1_id = $1 OR r.user2_id = $1
       ORDER BY m.created_at`,
      [req.userId]
    );

    const { rows: healthData } = await query(
      `SELECT id, metric_type, value, notes, recorded_at
       FROM health_metrics WHERE user_id = $1
       ORDER BY recorded_at`,
      [req.userId]
    );

    const { rows: achievements } = await query(
      `SELECT id, achievement_type, title, earned_at
       FROM achievements WHERE user_id = $1
       ORDER BY earned_at`,
      [req.userId]
    );

    const { rows: sessions } = await query(
      `SELECT id, created_at, expires_at FROM sessions WHERE user_id = $1`,
      [req.userId]
    );

    const exportData = {
      exported_at: new Date().toISOString(),
      user: userRows[0],
      relationships,
      messages,
      health_data: healthData,
      achievements,
      sessions,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="relationship-copilot-data-export.json"');
    res.json({ data: exportData });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/privacy/account
router.delete('/account', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Password is required to delete your account', 400);
    }

    // Verify password
    const { rows: userRows } = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    );

    if (userRows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const validPassword = await bcrypt.compare(password, userRows[0].password_hash);
    if (!validPassword) {
      throw new AppError('Incorrect password', 401);
    }

    // Delete all associated data in order (respecting foreign keys)
    await query('DELETE FROM sessions WHERE user_id = $1', [req.userId]);
    await query('DELETE FROM achievements WHERE user_id = $1', [req.userId]);
    await query('DELETE FROM health_metrics WHERE user_id = $1', [req.userId]);
    await query(
      `DELETE FROM messages WHERE relationship_id IN (
        SELECT id FROM relationships WHERE user1_id = $1 OR user2_id = $1
      )`,
      [req.userId]
    );
    await query('DELETE FROM relationships WHERE user1_id = $1 OR user2_id = $1', [req.userId]);
    await query('DELETE FROM users WHERE id = $1', [req.userId]);

    res.json({ data: { message: 'Account and all associated data have been deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
