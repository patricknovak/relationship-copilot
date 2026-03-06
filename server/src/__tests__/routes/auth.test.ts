import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';

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
import authRoutes from '../../routes/auth';
import { errorHandler } from '../../middleware/error';

const mockQuery = vi.mocked(query);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

describe('auth routes', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      // Check existing user
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      // INSERT user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          user_type: 'human',
          created_at: '2026-03-06',
        }],
        rowCount: 1,
      } as any);
      // INSERT session
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', username: 'testuser', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.username).toBe('testuser');
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 when username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', username: 'testuser' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', username: 'testuser', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8 characters');
    });

    it('should return 409 when user already exists', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-user' }],
        rowCount: 1,
      } as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', username: 'testuser', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      // SELECT user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          password_hash: hashedPassword,
          user_type: 'human',
        }],
        rowCount: 1,
      } as any);
      // INSERT session
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 401 for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should return 401 for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12);

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          password_hash: hashedPassword,
          user_type: 'human',
        }],
        rowCount: 1,
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(401);
    });

    it('should logout with valid token', async () => {
      // Generate a valid token
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign(
        { userId: 'user-1', userType: 'human' },
        'test-secret'
      );

      // DELETE session
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Logged out');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return user data with valid token', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign(
        { userId: 'user-1', userType: 'human' },
        'test-secret'
      );

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: null,
          user_type: 'human',
          birthday: null,
          gender: null,
          bio: null,
          life_stage: null,
          onboarding_complete: false,
          preferences: null,
          created_at: '2026-03-06',
        }],
        rowCount: 1,
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('user-1');
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('should return 404 when user not found', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign(
        { userId: 'nonexistent', userType: 'human' },
        'test-secret'
      );

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });
});
