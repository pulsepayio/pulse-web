import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError } from '../../utils/errors';
import { generateId } from '../../utils/ids';

const router = Router();
const prisma = new PrismaClient();

function ext(pulseId: string, prefix: string): string {
  return pulseId.startsWith(`${prefix}_`) ? pulseId : `${prefix}_${pulseId}`;
}

// POST /v1/payment_methods
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer, bank_account } = req.body;

    let customerId: string | undefined;
    let bankAccountId: string | undefined;

    if (customer) {
      const cust = await prisma.customer.findFirst({
        where: { pulseId: customer, userId: req.userId },
      });
      if (cust) customerId = cust.id;
    }

    if (bank_account) {
      const ba = await prisma.bankAccount.findFirst({
        where: { pulseId: bank_account, userId: req.userId },
      });
      if (ba) bankAccountId = ba.id;
    }

    if (customerId) {
      await prisma.paymentMethod.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const pmExtId = generateId('pm');
    const pm = await prisma.paymentMethod.create({
      data: {
        userId: req.userId!,
        pulseId: pmExtId,
        customerId,
        bankAccountId,
        isDefault: true,
      },
    });

    const bankAcc = bankAccountId
      ? await prisma.bankAccount.findUnique({ where: { id: bankAccountId } })
      : null;

    res.status(201).json({
      id: pmExtId,
      object: 'payment_method',
      type: pm.type,
      is_default: pm.isDefault,
      customer: customerId ? `cus_${customer}` : null,
      bank_account: bankAcc ? ext(bankAcc.pulseId, 'ba') : null,
      created: Math.floor(pm.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: 'Failed to create payment method' } });
  }
});

// GET /v1/payment_methods/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pm = await prisma.paymentMethod.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!pm) throw new NotFoundError('payment_method', req.params.id);

    const bankAcc = pm.bankAccountId
      ? await prisma.bankAccount.findUnique({ where: { id: pm.bankAccountId } })
      : null;

    res.json({
      id: ext(pm.pulseId, 'pm'),
      object: 'payment_method',
      type: pm.type,
      is_default: pm.isDefault,
      bank_account: bankAcc ? {
        id: ext(bankAcc.pulseId, 'ba'),
        institution: bankAcc.institutionName,
        last4: bankAcc.mask,
      } : undefined,
      created: Math.floor(pm.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to retrieve payment method' } });
  }
});

// GET /v1/payment_methods
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer } = req.query;
    const where: any = { userId: req.userId };
    if (customer) {
      const cust = await prisma.customer.findFirst({
        where: { pulseId: customer as string, userId: req.userId },
      });
      if (cust) where.customerId = cust.id;
    }

    const pms = await prisma.paymentMethod.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      object: 'list',
      data: pms.map((pm) => ({
        id: ext(pm.pulseId, 'pm'),
        object: 'payment_method',
        type: pm.type,
        is_default: pm.isDefault,
        created: Math.floor(pm.createdAt.getTime() / 1000),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list payment methods' } });
  }
});

// DELETE /v1/payment_methods/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pm = await prisma.paymentMethod.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!pm) throw new NotFoundError('payment_method', req.params.id);

    await prisma.paymentMethod.delete({ where: { id: pm.id } });

    res.json({
      id: ext(pm.pulseId, 'pm'),
      object: 'payment_method',
      deleted: true,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to delete payment method' } });
  }
});

export default router;
