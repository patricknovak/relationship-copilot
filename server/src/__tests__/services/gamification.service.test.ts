import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../db', () => ({
  query: vi.fn(),
}));

import { query } from '../../db';
import {
  checkInStreak,
  awardPoints,
  getTotalPoints,
  getStreaks,
  getAchievements,
  checkMessageAchievements,
  checkRelationshipAchievements,
  checkAgentAchievements,
  getLeaderboard,
} from '../../services/gamification.service';

const mockQuery = vi.mocked(query);

describe('gamification.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkInStreak', () => {
    it('should return null if relationship not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await checkInStreak('user1', 'rel1');
      expect(result).toBeNull();
    });

    it('should return already_checked_in if same day', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ streak_count: 5, streak_last_date: '2026-03-06' }],
        rowCount: 1,
      } as any);

      const result = await checkInStreak('user1', 'rel1');
      expect(result).toEqual({ streak_count: 5, already_checked_in: true });
    });

    it('should continue streak if last check-in was yesterday', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ streak_count: 3, streak_last_date: '2026-03-05' }],
        rowCount: 1,
      } as any);
      // UPDATE relationships
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // INSERT points_history (awardPoints)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // checkStreakAchievements: no thresholds met at streak 4, but the function
      // still won't query since 4 < 7

      const result = await checkInStreak('user1', 'rel1');
      expect(result).toEqual({
        streak_count: 4,
        points_earned: 2,
        already_checked_in: false,
      });
    });

    it('should reset streak if last check-in was more than one day ago', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ streak_count: 10, streak_last_date: '2026-03-01' }],
        rowCount: 1,
      } as any);
      // UPDATE relationships
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // INSERT points_history (awardPoints)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await checkInStreak('user1', 'rel1');
      expect(result).toEqual({
        streak_count: 1,
        points_earned: 2,
        already_checked_in: false,
      });
    });

    it('should award 5 points when streak is 7 or more', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ streak_count: 6, streak_last_date: '2026-03-05' }],
        rowCount: 1,
      } as any);
      // UPDATE relationships
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // INSERT points_history (awardPoints)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // checkStreakAchievements: streak=7, threshold 7 met
      // SELECT achievement_definitions
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'ach1', points: 10 }],
        rowCount: 1,
      } as any);
      // SELECT user_achievements (check if already earned)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      // INSERT user_achievements
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // INSERT points_history (achievement points)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await checkInStreak('user1', 'rel1');
      expect(result).toEqual({
        streak_count: 7,
        points_earned: 5,
        already_checked_in: false,
      });
    });
  });

  describe('awardPoints', () => {
    it('should insert into points_history', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await awardPoints('user1', 10, 'test_reason');

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO points_history (user_id, amount, reason) VALUES ($1, $2, $3)',
        ['user1', 10, 'test_reason']
      );
    });
  });

  describe('getTotalPoints', () => {
    it('should return total points as integer', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: '42' }],
        rowCount: 1,
      } as any);

      const total = await getTotalPoints('user1');
      expect(total).toBe(42);
    });

    it('should return 0 when no points exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: '0' }],
        rowCount: 1,
      } as any);

      const total = await getTotalPoints('user1');
      expect(total).toBe(0);
    });
  });

  describe('getStreaks', () => {
    it('should return streak rows for user', async () => {
      const mockRows = [
        {
          id: 'rel1',
          streak_count: 10,
          streak_last_date: '2026-03-06',
          type: 'friendship',
          partner_username: 'alice',
          partner_display_name: 'Alice',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as any);

      const result = await getStreaks('user1');
      expect(result).toEqual(mockRows);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('streak_count > 0'), ['user1']);
    });

    it('should return empty array when no streaks exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await getStreaks('user1');
      expect(result).toEqual([]);
    });
  });

  describe('getAchievements', () => {
    it('should return achievements for user', async () => {
      const mockRows = [
        { id: 'ach1', name: 'Streak Master', earned_at: '2026-03-01' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as any);

      const result = await getAchievements('user1');
      expect(result).toEqual(mockRows);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('user_achievements'), ['user1']);
    });

    it('should return empty array when no achievements', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await getAchievements('user1');
      expect(result).toEqual([]);
    });
  });

  describe('checkMessageAchievements', () => {
    it('should not award any achievement if message count < 100', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '50' }],
        rowCount: 1,
      } as any);

      await checkMessageAchievements('user1');

      // Only the SELECT COUNT query should have been called
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should try to award achievement at 100 messages', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '100' }],
        rowCount: 1,
      } as any);
      // tryAwardAchievement for threshold 100: SELECT achievement_definitions
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await checkMessageAchievements('user1');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should try to award both 100 and 1000 achievements at 1000 messages', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '1000' }],
        rowCount: 1,
      } as any);
      // tryAwardAchievement for threshold 100: SELECT achievement_definitions
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      // tryAwardAchievement for threshold 1000: SELECT achievement_definitions
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await checkMessageAchievements('user1');
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('checkRelationshipAchievements', () => {
    it('should not award achievement if count is 0', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as any);

      await checkRelationshipAchievements('user1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should try to award achievement at count >= 1', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '5' }],
        rowCount: 1,
      } as any);
      // tryAwardAchievement: SELECT achievement_definitions (no match)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await checkRelationshipAchievements('user1');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkAgentAchievements', () => {
    it('should not award if no agent relationships', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as any);

      await checkAgentAchievements('user1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should try to award achievement if has agent relationships', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '1' }],
        rowCount: 1,
      } as any);
      // tryAwardAchievement: SELECT achievement_definitions
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await checkAgentAchievements('user1');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with default limit', async () => {
      const mockRows = [
        { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null, total_points: '100' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as any);

      const result = await getLeaderboard();
      expect(result).toEqual(mockRows);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [20]);
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await getLeaderboard(5);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [5]);
    });
  });
});
