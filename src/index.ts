import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from './utils/config';
import { logger } from './utils/logger';
import { errorHandler } from './api/middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from './api/middleware/auth';

import authRoutes from './api/routes/auth';
import customerRoutes from './api/routes/customers';
import paymentRoutes from './api/routes/payments';
import bankAccountRoutes from './api/routes/bankAccounts';
import paymentMethodRoutes from './api/routes/paymentMethods';
import payoutRoutes from './api/routes/payouts';
import webhookRoutes from './api/routes/webhooks';
import eventRoutes from './api/routes/events';
import cryptoPaymentRoutes from './api/routes/cryptoPayments';
import checkoutRoutes from './api/routes/checkout';
import checkoutPageRoutes, { apiRouter as checkoutPageApiRoutes } from './api/routes/checkoutPage';
import webhookReceiverRoutes from './api/routes/webhookReceiver';
import productRoutes from './api/routes/products';
import { provisionAllWallets } from './services/crypto';

import { PrismaClient } from '@prisma/client';

const config = getConfig();
const app = express();
const prisma = new PrismaClient();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// ── Dashboard HTML ────────────────────────────────────────────
let dashboardHtml = '';
const dashboardPath = path.join(__dirname, '..', 'src', 'views', 'dashboard.html');
const dashboardPathDist = path.join(__dirname, '..', 'dist', 'views', 'dashboard.html');
try {
  dashboardHtml = fs.readFileSync(dashboardPath, 'utf-8');
} catch {
  try { dashboardHtml = fs.readFileSync(dashboardPathDist, 'utf-8'); } catch {
    dashboardHtml = '<h1>Dashboard not found</h1>';
  }
}

// ── API subdomain + /v1 routes ─────────────────────────────────
const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', environment: config.nodeEnv });
});

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'Pulse', version: '1.0.0', docs: '/docs', api: '/v1' });
});

apiRouter.use('/v1/auth', authRoutes);
apiRouter.use('/api/webhooks', webhookReceiverRoutes);
apiRouter.use('/checkout', checkoutPageRoutes);
apiRouter.use('/api/checkout-data', checkoutPageApiRoutes);
apiRouter.use('/v1/customers', authenticate, customerRoutes);
apiRouter.use('/v1/payments', authenticate, paymentRoutes);
apiRouter.use('/v1/bank_accounts', authenticate, bankAccountRoutes);
apiRouter.use('/v1/payment_methods', authenticate, paymentMethodRoutes);
apiRouter.use('/v1/payouts', authenticate, payoutRoutes);
apiRouter.use('/v1/webhooks', authenticate, webhookRoutes);
apiRouter.use('/v1/events', authenticate, eventRoutes);
apiRouter.use('/v1/crypto', authenticate, cryptoPaymentRoutes);
apiRouter.use('/v1/checkout', authenticate, checkoutRoutes);
apiRouter.use('/v1/products', authenticate, productRoutes);

apiRouter.get('/v1/balance', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const [incoming, outgoing, pendingPayouts] = await Promise.all([
      prisma.payment.aggregate({
        where: { userId: req.userId, status: 'succeeded', direction: 'incoming' },
        _sum: { netAmount: true },
      }),
      prisma.payment.aggregate({
        where: { userId: req.userId, status: 'succeeded', direction: 'outgoing' },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: { userId: req.userId, status: { in: ['pending', 'processing'] } },
        _sum: { amount: true },
      }),
    ]);

    const available =
      (incoming._sum.netAmount || 0) -
      (outgoing._sum.amount || 0) -
      (pendingPayouts._sum.amount || 0);

    res.json({
      object: 'balance',
      available: Math.max(0, available),
      pending: pendingPayouts._sum.amount || 0,
      currency: 'usd',
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to retrieve balance' } });
  }
});

apiRouter.get('/v1/api_keys', authenticate, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({ id: user.id, object: 'api_key', key: user.apiKey, livemode: user.livemode });
});

// Products API
// ── Wallet endpoints ─────────────────────────────────────────
apiRouter.get('/v1/wallets', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await provisionAllWallets(req.userId!);
    const wallets = await prisma.cryptoWallet.findMany({
      where: { userId: req.userId },
      orderBy: { currency: 'asc' },
    });
    res.json({ data: wallets.map(w => ({
      id: w.pulseId, object: 'wallet', currency: w.currency, address: w.address,
      balance: Number(w.balance), created: Math.floor(w.createdAt.getTime() / 1000),
    })), object: 'list' });
  } catch (err: any) {
    console.error('Wallets provisioning error:', err?.message || err);
    res.status(500).json({ error: { message: 'Failed to load wallets' } });
  }
});

// ── Route dispatch ─────────────────────────────────────────────
app.use((req, res, next) => {
  // API routes
  if (req.path.startsWith('/v1/') || req.path.startsWith('/api/') || req.path === '/health') {
    return apiRouter(req, res, next);
  }
  if (req.path.startsWith('/checkout')) {
    return apiRouter(req, res, next);
  }
  // Everything else serves the dashboard SPA
  res.type('html').send(dashboardHtml);
});

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Pulse server running on port ${config.port}`);
  logger.info(`  /v1/*  → API`);
  logger.info(`  /*     → Dashboard`);
});

export default app;
