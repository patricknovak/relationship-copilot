import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as matchingService from '../services/matching.service';

const router = Router();

// GET /api/discover/profiles
router.get('/profiles', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profiles = await matchingService.getDiscoverProfiles(req.userId!, {
      type: req.query.type as 'human' | 'agent' | undefined,
      life_stage: req.query.life_stage as string | undefined,
      looking_for: req.query.looking_for as string | undefined,
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.json({ data: profiles });
  } catch (err) {
    next(err);
  }
});

// GET /api/discover/agents — Agent directory with capability filters
router.get('/agents', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profiles = await matchingService.getDiscoverProfiles(req.userId!, {
      type: 'agent',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.json({ data: profiles });
  } catch (err) {
    next(err);
  }
});

// POST /api/discover/swipe
router.post('/swipe', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { target_id, action } = req.body;

    if (!target_id || !['like', 'pass'].includes(action)) {
      return res.status(400).json({ error: 'target_id and action (like/pass) required' });
    }

    const isMatch = await matchingService.recordSwipe(req.userId!, target_id, action);

    res.json({
      data: {
        action,
        is_match: isMatch,
        message: isMatch ? 'It\'s a match!' : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/discover/matches
router.get('/matches', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.getMatches(req.userId!);
    res.json({ data: matches });
  } catch (err) {
    next(err);
  }
});

// PUT /api/discover/settings
router.put('/settings', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await matchingService.upsertDiscoverProfile(req.userId!, req.body);
    res.json({ data: { message: 'Discover settings updated' } });
  } catch (err) {
    next(err);
  }
});

export default router;
