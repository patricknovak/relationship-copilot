import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';

// Mock config
vi.mock('../../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '7d',
    },
  },
}));

describe('requireAuth middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  it('should call next with AppError when no authorization header', () => {
    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
  });

  it('should call next with AppError when authorization header does not start with Bearer', () => {
    mockReq.headers = { authorization: 'Basic abc123' };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
  });

  it('should call next with AppError for invalid token', () => {
    mockReq.headers = { authorization: 'Bearer invalid-token' };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Invalid or expired token');
    expect(error.statusCode).toBe(401);
  });

  it('should set userId and userType on request for valid token', () => {
    const token = jwt.sign(
      { userId: 'user-123', userType: 'human' },
      'test-secret'
    );
    mockReq.headers = { authorization: `Bearer ${token}` };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(); // called with no arguments = success
    expect(mockReq.userId).toBe('user-123');
    expect(mockReq.userType).toBe('human');
  });

  it('should call next with AppError for expired token', () => {
    const token = jwt.sign(
      { userId: 'user-123', userType: 'human' },
      'test-secret',
      { expiresIn: '-1s' } // already expired
    );
    mockReq.headers = { authorization: `Bearer ${token}` };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Invalid or expired token');
    expect(error.statusCode).toBe(401);
  });

  it('should call next with AppError for token signed with wrong secret', () => {
    const token = jwt.sign(
      { userId: 'user-123', userType: 'human' },
      'wrong-secret'
    );
    mockReq.headers = { authorization: `Bearer ${token}` };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Invalid or expired token');
    expect(error.statusCode).toBe(401);
  });

  it('should handle empty Bearer token', () => {
    mockReq.headers = { authorization: 'Bearer ' };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Invalid or expired token');
    expect(error.statusCode).toBe(401);
  });
});
