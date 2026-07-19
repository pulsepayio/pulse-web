import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getConfig } from '../../utils/config';
import { AuthenticationError, ForbiddenError } from '../../utils/errors';
import { JWTPayload } from '../../types';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    businessName: string | null;
    livemode: boolean;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-pulse-api-key'] as string;

    // API Key authentication
    if (apiKeyHeader) {
      const apiKey = apiKeyHeader.replace('Bearer ', '');
      const user = await prisma.user.findFirst({
        where: { apiKey: { startsWith: apiKey.substring(0, 8) } },
      });

      if (user) {
        req.userId = user.id;
        req.user = {
          id: user.id,
          email: user.email,
          businessName: user.businessName,
          livemode: user.livemode,
        };
        return next();
      }
    }

    // JWT authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const config = getConfig();

      try {
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (user) {
          req.userId = user.id;
          req.user = {
            id: user.id,
            email: user.email,
            businessName: user.businessName,
            livemode: user.livemode,
          };
          return next();
        }
      } catch (e) {
        // JWT invalid, continue to error
      }
    }

    throw new AuthenticationError('No authentication credentials provided');
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }
    res.status(401).json({
      error: {
        type: 'invalid_request_error',
        message: 'Invalid authentication credentials',
      },
    });
  }
}
