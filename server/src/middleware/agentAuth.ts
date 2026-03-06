import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { AppError } from './error';

export interface AgentAuthRequest extends Request {
  agentId?: string;
  agentUserId?: string;
}

export async function requireAgentAuth(req: AgentAuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Agent API key required', 401));
  }

  const apiKey = authHeader.slice(7);

  try {
    // Look up all active agents and check key (in production, use a key prefix for lookup)
    const { rows } = await query(
      `SELECT ap.user_id, ap.api_key_hash, u.username
       FROM agent_profiles ap
       JOIN users u ON u.id = ap.user_id
       WHERE ap.status = 'active'`
    );

    for (const row of rows) {
      const match = await bcrypt.compare(apiKey, row.api_key_hash);
      if (match) {
        req.agentId = row.user_id;
        req.agentUserId = row.user_id;
        return next();
      }
    }

    next(new AppError('Invalid API key', 401));
  } catch (err) {
    next(err);
  }
}
