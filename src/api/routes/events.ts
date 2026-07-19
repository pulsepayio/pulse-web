import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function ext(pulseId: string, prefix: string): string {
  return pulseId.startsWith(`${prefix}_`) ? pulseId : `${prefix}_${pulseId}`;
}

// GET /v1/events
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;
    const type = req.query.type as string;

    const where: any = { userId: req.userId };
    if (type) where.type = type;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      object: 'list',
      data: events.map((e) => ({
        id: ext(e.pulseId, 'evt'),
        object: 'event',
        type: e.type,
        object_type: e.objectType,
        object_id: e.objectId,
        data: e.data,
        created: Math.floor(e.createdAt.getTime() / 1000),
      })),
      has_more: skip + limit < total,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list events' } });
  }
});

// GET /v1/events/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const event = await prisma.event.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });

    if (!event) {
      res.status(404).json({ error: { message: 'Event not found' } });
      return;
    }

    res.json({
      id: ext(event.pulseId, 'evt'),
      object: 'event',
      type: event.type,
      object_type: event.objectType,
      object_id: event.objectId,
      data: event.data,
      created: Math.floor(event.createdAt.getTime() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to retrieve event' } });
  }
});

export default router;
