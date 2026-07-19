import { Request, Response, NextFunction } from 'express';
import { PulseError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof PulseError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  res.status(500).json({
    error: {
      type: 'api_error',
      message: 'An unexpected error occurred',
    },
  });
}
