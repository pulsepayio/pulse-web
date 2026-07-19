import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import * as paymentService from '../../services/payments';

const router = Router();
const prisma = new PrismaClient();

function ext(pulseId: string, prefix: string): string {
  return pulseId.startsWith(`${prefix}_`) ? pulseId : `${prefix}_${pulseId}`;
}

// POST /v1/payouts
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payout = await paymentService.createPayout(req.userId!, req.body);

    res.status(201).json({
      id: ext(payout.pulseId, 'po'),
      object: 'payout',
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      method: payout.method,
      bank_account: ext(payout.bankAccountId, 'ba'),
      fee: payout.fee,
      description: payout.description,
      created: Math.floor(payout.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json(
      error.toJSON ? error.toJSON() : { error: { message: error.message } }
    );
  }
});

// GET /v1/payouts/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payout = await prisma.payout.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
      include: { bankAccount: true },
    });
    if (!payout) {
      res.status(404).json({ error: { message: 'Payout not found' } });
      return;
    }

    res.json({
      id: ext(payout.pulseId, 'po'),
      object: 'payout',
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      method: payout.method,
      bank_account: ext(payout.bankAccount.pulseId, 'ba'),
      fee: payout.fee,
      description: payout.description,
      arrival_date: payout.arrivalDate
        ? Math.floor(payout.arrivalDate.getTime() / 1000)
        : null,
      created: Math.floor(payout.createdAt.getTime() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to retrieve payout' } });
  }
});

// GET /v1/payouts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payout.count({ where: { userId: req.userId } }),
    ]);

    res.json({
      object: 'list',
      data: payouts.map((p) => ({
        id: ext(p.pulseId, 'po'),
        object: 'payout',
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.method,
        created: Math.floor(p.createdAt.getTime() / 1000),
      })),
      has_more: skip + limit < total,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list payouts' } });
  }
});

export default router;
