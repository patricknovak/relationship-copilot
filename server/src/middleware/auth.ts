import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './error';

export interface AuthRequest extends Request {
  userId?: string;
  userType?: string;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as { userId: string; userType: string };
    req.userId = payload.userId;
    req.userType = payload.userType;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}
