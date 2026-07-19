import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';
import * as cryptoService from '../../services/crypto';
import type { CryptoCurrency } from '../../services/crypto';

const router = Router();

const SUPPORTED_CURRENCIES: CryptoCurrency[] = ['TON', 'TRX', 'DOGE', 'BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'MATIC', 'ARB', 'OP', 'BASE', 'USDT', 'USDC', 'DAI', 'BUSD'];

// POST /v1/crypto/payments - create a crypto payment
router.post('/payments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, currency, customer, description, metadata } = req.body;

    if (!amount || amount <= 0) {
      throw new ValidationError('Amount must be positive', 'amount');
    }

    if (!currency || !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      throw new ValidationError(
        `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
        'currency'
      );
    }

    const payment = await cryptoService.createCryptoPayment({
      userId: req.userId!,
      amountUsd: amount,
      currency: currency.toUpperCase() as CryptoCurrency,
      customerId: customer,
      description,
      metadata,
    });

    res.status(201).json(payment);
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Failed to create crypto payment' } });
  }
});

// GET /v1/crypto/payments/:id - get a crypto payment
router.get('/payments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await cryptoService.getCryptoPayment(req.params.id);
    if (!payment) throw new NotFoundError('crypto_payment', req.params.id);

    res.json({
      id: payment.pulseId,
      object: 'crypto_payment',
      currency: payment.currency,
      amount_due: Number(payment.amountDue),
      amount_received: payment.amountReceived ? Number(payment.amountReceived) : null,
      exchange_rate: Number(payment.exchangeRate),
      deposit_address: payment.depositAddress,
      tx_hash: payment.txHash,
      confirmations: payment.confirmations,
      required_confirmations: payment.requiredConfirms,
      status: payment.status,
      expires_at: payment.expiresAt.toISOString(),
      paid_at: payment.paidAt?.toISOString() || null,
      created: Math.floor(payment.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to retrieve crypto payment' } });
  }
});

// GET /v1/crypto/payments - list crypto payments
router.get('/payments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await cryptoService.listCryptoPayments(req.userId!, { page, limit });

    res.json({
      object: 'list',
      data: result.data.map((p) => ({
        id: p.pulseId,
        object: 'crypto_payment',
        currency: p.currency,
        amount_due: Number(p.amountDue),
        exchange_rate: Number(p.exchangeRate),
        deposit_address: p.depositAddress,
        status: p.status,
        created: Math.floor(p.createdAt.getTime() / 1000),
      })),
      has_more: result.hasMore,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list crypto payments' } });
  }
});

// GET /v1/crypto/rates - get current exchange rates
router.get('/rates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rates = await cryptoService.getRates();
    res.json({
      object: 'list',
      data: Object.entries(rates).map(([currency, rate]) => ({
        currency,
        usd_rate: rate,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to fetch exchange rates' } });
  }
});

// GET /v1/crypto/currencies - list supported currencies
router.get('/currencies', async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    object: 'list',
    data: SUPPORTED_CURRENCIES.map((c) => ({
      currency: c,
      name: c,
    })),
  });
});

export default router;
