import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// Get notifications
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { unread_only, limit = '20', offset = '0' } = req.query;

    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const params: unknown[] = [req.userId];
    let idx = 2;

    if (unread_only === 'true') {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);

    // Count unread
    const unread = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`,
      [req.userId]
    );

    res.json({
      data: result.rows,
      unread_count: parseInt(unread.rows[0].count, 10),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    await db.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all as read
router.put('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    await db.query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [req.userId]
    );
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

export default router;
