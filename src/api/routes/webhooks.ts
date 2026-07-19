import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError } from '../../utils/errors';
import * as webhookService from '../../services/webhooks';
import { generateId } from '../../utils/ids';

const router = Router();

function ext(pulseId: string, prefix: string): string {
  return pulseId.startsWith(`${prefix}_`) ? pulseId : `${prefix}_${pulseId}`;
}

// POST /v1/webhooks
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, events } = req.body;
    const webhook = await webhookService.createWebhook(req.userId!, url, events);

    res.status(201).json({
      id: ext(webhook.pulseId, 'wh'),
      object: 'webhook',
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      secret: webhook.secret,
      created: Math.floor(webhook.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: 'Failed to create webhook' } });
  }
});

// GET /v1/webhooks
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhooks = await webhookService.listWebhooks(req.userId!);

    res.json({
      object: 'list',
      data: webhooks.map((w) => ({
        id: ext(w.pulseId, 'wh'),
        object: 'webhook',
        url: w.url,
        events: w.events,
        active: w.active,
        created: Math.floor(w.createdAt.getTime() / 1000),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list webhooks' } });
  }
});

// GET /v1/webhooks/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhook = await webhookService.getWebhook(req.userId!, req.params.id);

    res.json({
      id: ext(webhook.pulseId, 'wh'),
      object: 'webhook',
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      created: Math.floor(webhook.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    res.status(404).json({ error: { message: 'Webhook not found' } });
  }
});

// DELETE /v1/webhooks/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await webhookService.deleteWebhook(req.userId!, req.params.id);

    res.json({
      id: req.params.id,
      object: 'webhook',
      deleted: true,
    });
  } catch (error: any) {
    res.status(404).json({ error: { message: 'Webhook not found' } });
  }
});

export default router;
