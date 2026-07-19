import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as paymentService from '../../services/payments';
import * as stripeBankService from '../../services/stripe-bank';
import { logger } from '../../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// POST /api/webhooks/stripe - receives Stripe webhook notifications
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: { message: 'Missing stripe-signature header' } });
      return;
    }

    let event;
    try {
      event = stripeBankService.constructWebhookEvent(
        JSON.stringify(req.body),
        signature
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', { error: err });
      res.status(400).json({ error: { message: 'Invalid signature' } });
      return;
    }

    logger.info('Received Stripe webhook', { type: event.type, id: event.id });

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as any;
        await paymentService.updatePaymentStatus(intent.id, 'succeeded', {
          traceNumber: intent.id,
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as any;
        await paymentService.updatePaymentStatus(intent.id, 'failed', {
          achReturnCode: intent.last_payment_error?.code,
        });
        break;
      }

      case 'financial_connections.account.created':
        logger.info('Financial Connections account created', {
          accountId: event.data.object.id,
        });
        break;

      case 'financial_connections.account.deactivated':
        logger.warn('Financial Connections account deactivated', {
          accountId: event.data.object.id,
        });
        break;

      default:
        logger.debug('Unhandled Stripe webhook type', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Stripe webhook', { error });
    res.status(200).json({ received: true });
  }
});

// POST /api/webhooks/pulse - internal webhook for testing
router.post('/pulse', async (req: Request, res: Response) => {
  logger.info('Internal webhook received', { body: req.body });
  res.json({ received: true });
});

export default router;
