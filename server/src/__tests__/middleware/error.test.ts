import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler, AppError } from '../../middleware/error';
import { Request, Response, NextFunction } from 'express';

describe('AppError', () => {
  it('should create an error with statusCode and message', () => {
    const error = new AppError('Not found', 404);
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('AppError');
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Bad request', 400);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should work with different status codes', () => {
    const err400 = new AppError('Bad request', 400);
    expect(err400.statusCode).toBe(400);

    const err401 = new AppError('Unauthorized', 401);
    expect(err401.statusCode).toBe(401);

    const err403 = new AppError('Forbidden', 403);
    expect(err403.statusCode).toBe(403);

    const err409 = new AppError('Conflict', 409);
    expect(err409.statusCode).toBe(409);
  });
});

describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusFn: ReturnType<typeof vi.fn>;
  let jsonFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {};
    jsonFn = vi.fn();
    statusFn = vi.fn().mockReturnValue({ json: jsonFn });
    mockRes = {
      status: statusFn,
      json: jsonFn,
    } as any;
    mockNext = vi.fn();

    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should respond with AppError statusCode and message', () => {
    const error = new AppError('Not found', 404);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(404);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('should respond with 500 and generic message for plain Error', () => {
    const error = new Error('Something went wrong internally');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('should use 400 statusCode and show message for AppError(400)', () => {
    const error = new AppError('Validation failed', 400);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Validation failed' });
  });

  it('should use 401 statusCode and show message for AppError(401)', () => {
    const error = new AppError('Unauthorized', 401);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(401);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('should log the error to console', () => {
    const error = new AppError('Something bad', 500);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
  });

  it('should hide internal error message when status is 500', () => {
    const error = new AppError('secret db password leak', 500);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
