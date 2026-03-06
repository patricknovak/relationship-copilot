import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { config } from '../config';
import { AppError } from '../middleware/error';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      throw new AppError('Email, username, and password are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Check for existing user
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      throw new AppError('Email or username already taken', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await query(
      `INSERT INTO users (email, username, password_hash, user_type)
       VALUES ($1, $2, $3, 'human')
       RETURNING id, email, username, user_type, created_at`,
      [email, username, passwordHash]
    );

    const user = rows[0];
    const token = jwt.sign(
      { userId: user.id, userType: user.user_type },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    // Store session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.status(201).json({
      data: {
        user: { id: user.id, email: user.email, username: user.username },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const { rows } = await query(
      'SELECT id, email, username, password_hash, user_type FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = jwt.sign(
      { userId: user.id, userType: user.user_type },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.json({
      data: {
        user: { id: user.id, email: user.email, username: user.username },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization!.slice(7);
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ data: { message: 'Logged out' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT id, email, username, display_name, avatar_url, user_type, birthday,
              gender, bio, life_stage, onboarding_complete, preferences, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
