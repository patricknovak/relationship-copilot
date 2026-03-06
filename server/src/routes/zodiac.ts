import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import * as zodiacService from '../services/zodiac.service';

const router = Router();

// GET /api/zodiac/profile
router.get('/profile', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      'SELECT * FROM zodiac_profiles WHERE user_id = $1',
      [req.userId]
    );

    if (rows.length === 0) {
      return res.json({ data: null, message: 'No zodiac profile computed yet. POST /api/zodiac/compute to generate.' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/zodiac/compute — Compute zodiac from birthday (or agent type)
router.post('/compute', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows: userRows } = await query(
      'SELECT birthday, user_type FROM users WHERE id = $1',
      [req.userId]
    );

    if (userRows.length === 0) throw new AppError('User not found', 404);

    const user = userRows[0];
    let westernSign: string | null = null;
    let chineseSign: string | null = null;
    let agentArchetype: string | null = null;
    let personalityTraits = {};

    if (user.user_type === 'agent') {
      const { rows: agentRows } = await query(
        'SELECT agent_type FROM agent_profiles WHERE user_id = $1',
        [req.userId]
      );
      if (agentRows.length > 0) {
        agentArchetype = zodiacService.computeAgentArchetype(agentRows[0].agent_type);
      }
    } else {
      if (!user.birthday) {
        throw new AppError('Birthday is required to compute zodiac', 400);
      }
      westernSign = zodiacService.computeWesternSign(user.birthday);
      chineseSign = zodiacService.computeChineseSign(user.birthday);
      personalityTraits = zodiacService.getPersonalityTraits(westernSign);
    }

    await query(
      `INSERT INTO zodiac_profiles (user_id, western_sign, chinese_sign, agent_archetype, personality_traits, computed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         western_sign = $2, chinese_sign = $3, agent_archetype = $4,
         personality_traits = $5, computed_at = NOW()`,
      [req.userId, westernSign, chineseSign, agentArchetype, JSON.stringify(personalityTraits)]
    );

    res.json({
      data: {
        user_id: req.userId,
        western_sign: westernSign,
        chinese_sign: chineseSign,
        agent_archetype: agentArchetype,
        personality_traits: personalityTraits,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/zodiac/compatibility/:partnerId
router.get('/compatibility/:partnerId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check for cached score
    const { rows: cached } = await query(
      'SELECT * FROM compatibility_scores WHERE user_id = $1 AND partner_id = $2',
      [req.userId, req.params.partnerId]
    );

    if (cached.length > 0) {
      return res.json({ data: cached[0] });
    }

    // Get both zodiac profiles
    const { rows: profiles } = await query(
      'SELECT * FROM zodiac_profiles WHERE user_id IN ($1, $2)',
      [req.userId, req.params.partnerId]
    );

    if (profiles.length < 2) {
      throw new AppError('Both users must have zodiac profiles computed first', 400);
    }

    const myProfile = profiles.find((p) => p.user_id === req.userId)!;
    const partnerProfile = profiles.find((p) => p.user_id === req.params.partnerId)!;

    let westernScore = 50;
    let chineseScore = 50;

    if (myProfile.western_sign && partnerProfile.western_sign) {
      westernScore = zodiacService.computeWesternCompatibility(myProfile.western_sign, partnerProfile.western_sign);
    }

    if (myProfile.chinese_sign && partnerProfile.chinese_sign) {
      chineseScore = zodiacService.computeChineseCompatibility(myProfile.chinese_sign, partnerProfile.chinese_sign);
    }

    const overallScore = zodiacService.computeOverallCompatibility(westernScore, chineseScore);

    const details = {
      user_western: myProfile.western_sign,
      partner_western: partnerProfile.western_sign,
      user_chinese: myProfile.chinese_sign,
      partner_chinese: partnerProfile.chinese_sign,
      user_archetype: myProfile.agent_archetype,
      partner_archetype: partnerProfile.agent_archetype,
    };

    await query(
      `INSERT INTO compatibility_scores (user_id, partner_id, western_score, chinese_score, overall_score, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, partner_id) DO UPDATE SET
         western_score = $3, chinese_score = $4, overall_score = $5, details = $6, computed_at = NOW()`,
      [req.userId, req.params.partnerId, westernScore, chineseScore, overallScore, JSON.stringify(details)]
    );

    res.json({
      data: {
        user_id: req.userId,
        partner_id: req.params.partnerId,
        western_score: westernScore,
        chinese_score: chineseScore,
        overall_score: overallScore,
        details,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
