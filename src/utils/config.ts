import dotenv from 'dotenv';
import { PulseConfig } from '../types';

dotenv.config();

export function getConfig(): PulseConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    tronApiKey: process.env.TRON_API_KEY || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
  };
}
