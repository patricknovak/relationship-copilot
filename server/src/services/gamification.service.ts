import { query } from '../db';

export async function checkInStreak(userId: string, relationshipId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { rows } = await query(
    'SELECT streak_count, streak_last_date FROM relationships WHERE id = $1 AND (user_id = $2 OR partner_id = $2)',
    [relationshipId, userId]
  );

  if (rows.length === 0) return null;

  const rel = rows[0];
  const lastDate = rel.streak_last_date;

  // Already checked in today
  if (lastDate === today) {
    return { streak_count: rel.streak_count, already_checked_in: true };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak: number;
  if (lastDate === yesterdayStr) {
    // Continue streak
    newStreak = rel.streak_count + 1;
  } else {
    // Streak broken, start fresh
    newStreak = 1;
  }

  await query(
    'UPDATE relationships SET streak_count = $2, streak_last_date = $3, updated_at = NOW() WHERE id = $1',
    [relationshipId, newStreak, today]
  );

  // Award points
  const points = newStreak >= 7 ? 5 : 2;
  await awardPoints(userId, points, `streak_checkin_${relationshipId}`);

  // Check streak achievements
  await checkStreakAchievements(userId, newStreak);

  return { streak_count: newStreak, points_earned: points, already_checked_in: false };
}

export async function awardPoints(userId: string, amount: number, reason: string) {
  await query(
    'INSERT INTO points_history (user_id, amount, reason) VALUES ($1, $2, $3)',
    [userId, amount, reason]
  );
}

export async function getTotalPoints(userId: string): Promise<number> {
  const { rows } = await query(
    'SELECT COALESCE(SUM(amount), 0) as total FROM points_history WHERE user_id = $1',
    [userId]
  );
  return parseInt(rows[0].total);
}

export async function getStreaks(userId: string) {
  const { rows } = await query(
    `SELECT r.id, r.streak_count, r.streak_last_date, r.type,
            u.username as partner_username, u.display_name as partner_display_name
     FROM relationships r
     JOIN users u ON u.id = r.partner_id
     WHERE r.user_id = $1 AND r.status = 'active' AND r.streak_count > 0
     ORDER BY r.streak_count DESC`,
    [userId]
  );
  return rows;
}

export async function getAchievements(userId: string) {
  const { rows } = await query(
    `SELECT ad.*, ua.earned_at
     FROM user_achievements ua
     JOIN achievement_definitions ad ON ad.id = ua.achievement_id
     WHERE ua.user_id = $1
     ORDER BY ua.earned_at DESC`,
    [userId]
  );
  return rows;
}

export async function checkStreakAchievements(userId: string, streakCount: number) {
  const thresholds = [7, 30, 100];
  for (const threshold of thresholds) {
    if (streakCount >= threshold) {
      await tryAwardAchievement(userId, 'streak', threshold);
    }
  }
}

export async function checkMessageAchievements(userId: string) {
  const { rows } = await query(
    'SELECT COUNT(*) as count FROM messages WHERE sender_id = $1',
    [userId]
  );
  const count = parseInt(rows[0].count);

  if (count >= 100) await tryAwardAchievement(userId, 'communication', 100);
  if (count >= 1000) await tryAwardAchievement(userId, 'communication', 1000);
}

export async function checkRelationshipAchievements(userId: string) {
  const { rows } = await query(
    "SELECT COUNT(*) as count FROM relationships WHERE user_id = $1 AND status = 'active'",
    [userId]
  );
  const count = parseInt(rows[0].count);

  if (count >= 1) await tryAwardAchievement(userId, 'communication', 1);
  if (count >= 10) await tryAwardAchievement(userId, 'communication', 10);
}

export async function checkAgentAchievements(userId: string) {
  const { rows } = await query(
    "SELECT COUNT(*) as count FROM relationships r JOIN users u ON u.id = r.partner_id WHERE r.user_id = $1 AND u.user_type = 'agent' AND r.status = 'active'",
    [userId]
  );
  if (parseInt(rows[0].count) >= 1) {
    await tryAwardAchievement(userId, 'agent', 1);
  }
}

async function tryAwardAchievement(userId: string, category: string, threshold: number) {
  const { rows } = await query(
    'SELECT id, points FROM achievement_definitions WHERE category = $1 AND threshold = $2',
    [category, threshold]
  );

  if (rows.length === 0) return;

  const achievement = rows[0];

  // Check if already earned
  const existing = await query(
    'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
    [userId, achievement.id]
  );

  if (existing.rows.length > 0) return;

  await query(
    'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
    [userId, achievement.id]
  );

  if (achievement.points > 0) {
    await awardPoints(userId, achievement.points, `achievement_${achievement.id}`);
  }
}

export async function getLeaderboard(limit = 20) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url,
            COALESCE(SUM(ph.amount), 0) as total_points
     FROM users u
     LEFT JOIN points_history ph ON ph.user_id = u.id
     WHERE u.user_type = 'human'
     GROUP BY u.id
     ORDER BY total_points DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
