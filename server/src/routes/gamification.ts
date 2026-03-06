import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as gamification from '../services/gamification.service';

const router = Router();

// GET /api/gamification/streaks
router.get('/streaks', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const streaks = await gamification.getStreaks(req.userId!);
    res.json({ data: streaks });
  } catch (err) {
    next(err);
  }
});

// POST /api/gamification/streaks/:relationshipId/check-in
router.post('/streaks/:relationshipId/check-in', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await gamification.checkInStreak(req.userId!, req.params.relationshipId);
    if (!result) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/points
router.get('/points', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const total = await gamification.getTotalPoints(req.userId!);
    res.json({ data: { total } });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/achievements
router.get('/achievements', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const achievements = await gamification.getAchievements(req.userId!);
    res.json({ data: achievements });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/leaderboard
router.get('/leaderboard', requireAuth, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const leaderboard = await gamification.getLeaderboard();
    res.json({ data: leaderboard });
  } catch (err) {
    next(err);
  }
});

export default router;
