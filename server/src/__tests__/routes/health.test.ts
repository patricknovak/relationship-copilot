import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock db before importing routes
vi.mock('../../db', () => ({
  query: vi.fn(),
}));

// Mock config
vi.mock('../../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '7d',
    },
  },
}));

import { query } from '../../db';
import healthRoutes from '../../routes/health';
import { errorHandler } from '../../middleware/error';

const mockQuery = vi.mocked(query);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRoutes);
  app.use(errorHandler);
  return app;
}

function makeToken(userId = 'user-1') {
  return jwt.sign({ userId, userType: 'human' }, 'test-secret');
}

describe('health routes', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
  });

  describe('GET /api/health/dashboard', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/health/dashboard');
      expect(res.status).toBe(401);
    });

    it('should return dashboard data with relationships', async () => {
      const token = makeToken();

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'rel1',
            type: 'friendship',
            category: 'close',
            health_score: 80,
            streak_count: 5,
            partner_username: 'alice',
            partner_display_name: 'Alice',
          },
          {
            id: 'rel2',
            type: 'family',
            category: 'immediate',
            health_score: 30,
            streak_count: 0,
            partner_username: 'bob',
            partner_display_name: 'Bob',
          },
        ],
        rowCount: 2,
      } as any);

      const res = await request(app)
        .get('/api/health/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total_relationships).toBe(2);
      expect(res.body.data.average_health).toBe(55); // (80 + 30) / 2
      expect(res.body.data.relationships).toHaveLength(2);
      expect(res.body.data.needs_attention).toHaveLength(1);
      expect(res.body.data.needs_attention[0].id).toBe('rel2');
    });

    it('should return empty dashboard when no relationships', async () => {
      const token = makeToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await request(app)
        .get('/api/health/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total_relationships).toBe(0);
      expect(res.body.data.average_health).toBe(0);
      expect(res.body.data.relationships).toHaveLength(0);
      expect(res.body.data.needs_attention).toHaveLength(0);
    });

    it('should correctly identify needs_attention (health_score < 40)', async () => {
      const token = makeToken();

      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'rel1', type: 'friendship', category: 'close', health_score: 39, streak_count: 0, partner_username: 'a', partner_display_name: 'A' },
          { id: 'rel2', type: 'friendship', category: 'close', health_score: 40, streak_count: 0, partner_username: 'b', partner_display_name: 'B' },
          { id: 'rel3', type: 'friendship', category: 'close', health_score: 10, streak_count: 0, partner_username: 'c', partner_display_name: 'C' },
        ],
        rowCount: 3,
      } as any);

      const res = await request(app)
        .get('/api/health/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.needs_attention).toHaveLength(2);
      const attentionIds = res.body.data.needs_attention.map((r: any) => r.id);
      expect(attentionIds).toContain('rel1');
      expect(attentionIds).toContain('rel3');
    });

    it('should compute average_health correctly', async () => {
      const token = makeToken();

      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'r1', type: 'f', category: 'c', health_score: 100, streak_count: 0, partner_username: 'x', partner_display_name: 'X' },
          { id: 'r2', type: 'f', category: 'c', health_score: 50, streak_count: 0, partner_username: 'y', partner_display_name: 'Y' },
          { id: 'r3', type: 'f', category: 'c', health_score: 75, streak_count: 0, partner_username: 'z', partner_display_name: 'Z' },
        ],
        rowCount: 3,
      } as any);

      const res = await request(app)
        .get('/api/health/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // (100 + 50 + 75) / 3 = 75
      expect(res.body.data.average_health).toBe(75);
    });
  });

  describe('GET /api/health/:relationshipId/history', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/health/rel1/history');
      expect(res.status).toBe(401);
    });

    it('should return health history snapshots', async () => {
      const token = makeToken();

      const mockSnapshots = [
        { id: 's1', relationship_id: 'rel1', health_score: 80, created_at: '2026-03-06' },
        { id: 's2', relationship_id: 'rel1', health_score: 75, created_at: '2026-03-05' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockSnapshots, rowCount: 2 } as any);

      const res = await request(app)
        .get('/api/health/rel1/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].health_score).toBe(80);
    });

    it('should return empty array when no history', async () => {
      const token = makeToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await request(app)
        .get('/api/health/rel1/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should pass relationshipId to query', async () => {
      const token = makeToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await request(app)
        .get('/api/health/my-rel-id/history')
        .set('Authorization', `Bearer ${token}`);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('health_snapshots'),
        ['my-rel-id']
      );
    });
  });
});
