import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { CreateCustomerInput } from '../../types';
import * as webhookService from '../../services/webhooks';
import { generateId } from '../../utils/ids';

const router = Router();
const prisma = new PrismaClient();

// POST /v1/customers
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, phone, address, metadata } = req.body as CreateCustomerInput;
    const extId = generateId('cus');
    const customer = await prisma.customer.create({
      data: {
        userId: req.userId!,
        pulseId: extId,
        email,
        name,
        phone,
        address: address ? JSON.stringify(address) : undefined,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });

    await webhookService.createEvent(
      req.userId!,
      'customer.created',
      'customer',
      extId,
      { id: extId, email, name }
    );

    res.status(201).json({
      id: extId,
      object: 'customer',
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      metadata: customer.metadata,
      created: Math.floor(customer.createdAt.getTime() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to create customer' } });
  }
});

// GET /v1/customers/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!customer) throw new NotFoundError('customer', req.params.id);

    res.json({
      id: customer.pulseId.startsWith('cus_') ? customer.pulseId : `cus_${customer.pulseId}`,
      object: 'customer',
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      metadata: customer.metadata,
      created: Math.floor(customer.createdAt.getTime() / 1000),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to retrieve customer' } });
  }
});

// GET /v1/customers
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where: { userId: req.userId } }),
    ]);

    res.json({
      object: 'list',
      data: customers.map((c) => ({
        id: c.pulseId.startsWith('cus_') ? c.pulseId : `cus_${c.pulseId}`,
        object: 'customer',
        email: c.email,
        name: c.name,
        created: Math.floor(c.createdAt.getTime() / 1000),
      })),
      has_more: skip + limit < total,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list customers' } });
  }
});

// POST /v1/customers/:id
router.post('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!customer) throw new NotFoundError('customer', req.params.id);

    const { email, name, phone, address, metadata } = req.body;

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(email !== undefined && { email }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(metadata !== undefined && { metadata }),
      },
    });

    const extCusId = customer.pulseId.startsWith('cus_') ? customer.pulseId : `cus_${customer.pulseId}`;
    await webhookService.createEvent(
      req.userId!,
      'customer.updated',
      'customer',
      extCusId,
      { id: extCusId, ...req.body }
    );

    res.json({
      id: updated.pulseId.startsWith('cus_') ? updated.pulseId : `cus_${updated.pulseId}`,
      object: 'customer',
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      address: updated.address,
      metadata: updated.metadata,
      created: Math.floor(updated.createdAt.getTime() / 1000),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to update customer' } });
  }
});

// DELETE /v1/customers/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!customer) throw new NotFoundError('customer', req.params.id);

    await prisma.customer.delete({ where: { id: customer.id } });

    const extDelId = customer.pulseId.startsWith('cus_') ? customer.pulseId : `cus_${customer.pulseId}`;
    await webhookService.createEvent(
      req.userId!,
      'customer.deleted',
      'customer',
      extDelId,
      { id: extDelId }
    );

    res.json({
      id: extDelId,
      object: 'customer',
      deleted: true,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to delete customer' } });
  }
});

export default router;
