import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';
import * as checkoutService from '../../services/checkout';
import type { CryptoCurrency } from '../../services/crypto';
import { ALL_CURRENCIES } from '../../services/crypto';

const router = Router();

// POST /v1/checkout - create a checkout session (simple endpoint for dashboard)
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount_usd, product_id, description, success_url, cancel_url, customer_email, currency } = req.body;

    const amount = amount_usd || (product_id ? undefined : 0);
    if (!amount || amount <= 0) {
      throw new ValidationError('amount_usd must be positive', 'amount_usd');
    }

    const session = await checkoutService.createCheckoutSession({
      userId: req.userId!,
      amountUsd: amount,
      currency: (currency || 'TON').toUpperCase() as CryptoCurrency,
      description,
      successUrl: success_url,
      cancelUrl: cancel_url,
      metadata: customer_email ? { customer_email } : undefined,
    });

    res.status(201).json(session);
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Failed to create checkout session' } });
  }
});

// POST /v1/checkout/sessions - create a checkout session
router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, currency, customer, description, success_url, cancel_url, metadata } = req.body;

    if (!amount || amount <= 0) {
      throw new ValidationError('Amount must be positive', 'amount');
    }

    const session = await checkoutService.createCheckoutSession({
      userId: req.userId!,
      amountUsd: amount,
      currency: (currency || 'TON').toUpperCase() as CryptoCurrency,
      customerId: customer,
      description,
      successUrl: success_url,
      cancelUrl: cancel_url,
      metadata,
    });

    res.status(201).json(session);
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Failed to create checkout session' } });
  }
});

// GET /v1/checkout/sessions/:id
router.get('/sessions/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await checkoutService.getCheckoutSession(req.params.id);
    if (!session) throw new NotFoundError('checkout_session', req.params.id);
    res.json(session);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to retrieve checkout session' } });
  }
});

// GET /v1/checkout/sessions
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await checkoutService.listCheckoutSessions(req.userId!, { page, limit });
    res.json({ object: 'list', ...result });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list checkout sessions' } });
  }
});

export default router;
