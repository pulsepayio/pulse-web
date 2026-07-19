import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../../utils/errors';

const router = Router();
const prisma = new PrismaClient();

function formatProduct(p: any) {
  return {
    id: p.pulseId,
    object: 'product',
    name: p.name,
    description: p.description,
    price_usd: p.priceUsd / 100,
    active: p.active,
    delivery_items: p.deliveryItems ? JSON.parse(p.deliveryItems) : [],
    created: Math.floor(p.createdAt.getTime() / 1000),
  };
}

// GET /v1/products - list products
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const products = await prisma.product.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: products.map(formatProduct), object: 'list' });
});

// POST /v1/products - create product
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, price_usd, digital_file_url, delivery_items } = req.body;
    if (!name) throw new ValidationError('Product name is required');
    if (!price_usd || price_usd <= 0) throw new ValidationError('Price must be positive');

    const product = await prisma.product.create({
      data: {
        userId: req.userId!,
        name,
        description: description || null,
        priceUsd: Math.round(price_usd * 100),
        digitalFileUrl: digital_file_url || null,
        deliveryItems: delivery_items ? JSON.stringify(delivery_items) : null,
      },
    });

    res.status(201).json(formatProduct(product));
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json(error.toJSON());
    }
    res.status(500).json({ error: { message: 'Failed to create product' } });
  }
});

// GET /v1/products/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const product = await prisma.product.findFirst({
    where: { pulseId: req.params.id, userId: req.userId },
  });
  if (!product) return res.status(404).json({ error: { message: 'Product not found' } });
  res.json(formatProduct(product));
});

// PATCH /v1/products/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const product = await prisma.product.findFirst({
    where: { pulseId: req.params.id, userId: req.userId },
  });
  if (!product) return res.status(404).json({ error: { message: 'Product not found' } });

  const { name, description, price_usd, digital_file_url, delivery_items, active } = req.body;
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(price_usd !== undefined && { priceUsd: Math.round(price_usd * 100) }),
      ...(digital_file_url !== undefined && { digitalFileUrl: digital_file_url }),
      ...(delivery_items !== undefined && { deliveryItems: JSON.stringify(delivery_items) }),
      ...(active !== undefined && { active }),
    },
  });

  res.json(formatProduct(updated));
});

// DELETE /v1/products/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const product = await prisma.product.findFirst({
    where: { pulseId: req.params.id, userId: req.userId },
  });
  if (!product) return res.status(404).json({ error: { message: 'Product not found' } });
  await prisma.product.delete({ where: { id: product.id } });
  res.json({ deleted: true });
});

export default router;
