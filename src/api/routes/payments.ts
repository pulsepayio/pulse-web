import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError } from '../../utils/errors';
import * as paymentService from '../../services/payments';

const router = Router();
const prisma = new PrismaClient();

function ext(pulseId: string, prefix: string): string {
  return pulseId.startsWith(`${prefix}_`) ? pulseId : `${prefix}_${pulseId}`;
}

// POST /v1/payments
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await paymentService.createPayment(req.userId!, req.body);
    const result = await prisma.payment.findFirst({
      where: { id: payment.id },
      include: {
        customer: { select: { id: true, pulseId: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      id: ext(result!.pulseId, 'pay'),
      object: 'payment',
      amount: result!.amount,
      currency: result!.currency,
      status: result!.status,
      description: result!.description,
      customer: result!.customer?.pulseId,
      fee: result!.fee,
      net_amount: result!.netAmount,
      payment_type: result!.paymentType,
      direction: result!.direction,
      metadata: result!.metadata,
      created: Math.floor(result!.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json(
      error.toJSON ? error.toJSON() : { error: { message: error.message } }
    );
  }
});

// GET /v1/payments/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await paymentService.getPayment(req.userId!, req.params.id);
    const p = payment as any;

    res.json({
      id: ext(p.pulseId, 'pay'),
      object: 'payment',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      description: p.description,
      customer: p.customer?.pulseId,
      fee: p.fee,
      net_amount: p.netAmount,
      payment_type: p.paymentType,
      direction: p.direction,
      ach_return_code: p.achReturnCode,
      ach_trace_number: p.achTraceNumber,
      bank_account: p.bankAccount
        ? {
            id: ext(p.bankAccount.pulseId, 'ba'),
            institution: p.bankAccount.institutionName,
            name: p.bankAccount.accountName,
            last4: p.bankAccount.mask,
            account_type: p.bankAccount.accountType,
          }
        : undefined,
      metadata: p.metadata,
      created: Math.floor(p.createdAt.getTime() / 1000),
      initiated_at: p.initiatedAt ? Math.floor(p.initiatedAt.getTime() / 1000) : null,
      settled_at: p.settledAt ? Math.floor(p.settledAt.getTime() / 1000) : null,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json(
      error.toJSON ? error.toJSON() : { error: { message: error.message } }
    );
  }
});

// GET /v1/payments
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await paymentService.listPayments(req.userId!, {
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 10, 100),
      status: req.query.status as string,
      customer: req.query.customer as string,
      startingAfter: req.query.starting_after as string,
    });

    res.json({
      object: 'list',
      data: result.data.map((p: any) => ({
        id: ext(p.pulseId, 'pay'),
        object: 'payment',
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        description: p.description,
        customer: p.customer?.pulseId,
        created: Math.floor(p.createdAt.getTime() / 1000),
      })),
      has_more: result.hasMore,
      total: result.total,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json(
      error.toJSON ? error.toJSON() : { error: { message: error.message } }
    );
  }
});

// POST /v1/payments/:id/cancel
router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await paymentService.cancelPayment(req.userId!, req.params.id);
    const p = payment as any;

    res.json({
      id: ext(p.pulseId, 'pay'),
      object: 'payment',
      status: p.status,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json(
      error.toJSON ? error.toJSON() : { error: { message: error.message } }
    );
  }
});

export default router;
