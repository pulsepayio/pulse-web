import { PrismaClient, Webhook, WebhookDelivery, Event } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { EventKind } from '../../types';

const prisma = new PrismaClient();

export async function createWebhook(
  userId: string,
  url: string,
  events: string[]
): Promise<Webhook> {
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  const webhook = await prisma.webhook.create({
    data: {
      userId,
      url,
      events: JSON.stringify(events),
      secret,
    },
  });

  logger.info('Webhook created', { webhookId: webhook.pulseId, url });

  return webhook;
}

export async function getWebhook(userId: string, webhookId: string): Promise<Webhook> {
  const webhook = await prisma.webhook.findFirst({
    where: { pulseId: webhookId, userId },
  });

  if (!webhook) throw new Error(`No webhook found with id: ${webhookId}`);
  return webhook;
}

export async function listWebhooks(userId: string): Promise<Webhook[]> {
  return prisma.webhook.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteWebhook(userId: string, webhookId: string): Promise<void> {
  const webhook = await prisma.webhook.findFirst({
    where: { pulseId: webhookId, userId },
  });

  if (!webhook) throw new Error(`No webhook found with id: ${webhookId}`);

  await prisma.webhook.delete({ where: { id: webhook.id } });
  logger.info('Webhook deleted', { webhookId });
}

export async function createEvent(
  userId: string,
  type: EventKind | string,
  objectType: string,
  objectId: string,
  data: Record<string, unknown>
): Promise<Event> {
  const event = await prisma.event.create({
    data: {
      userId,
      type,
      objectType,
      objectId,
      data: JSON.stringify(data),
    },
  });

  // Dispatch to webhooks
  const webhooks = await prisma.webhook.findMany({
    where: {
      userId,
      active: true,
      events: { contains: type },
    },
  });

  for (const webhook of webhooks) {
    deliverWebhook(webhook, type, data as any, event.pulseId).catch((err) => {
      logger.error('Webhook delivery failed', { webhookId: webhook.pulseId, error: err.message });
    });
  }

  return event;
}

async function deliverWebhook(
  webhook: Webhook,
  eventType: string,
  data: Record<string, unknown>,
  eventId: string
): Promise<void> {
  const payloadObj = {
    id: eventId,
    type: eventType,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
  };
  const payload = JSON.stringify(payloadObj);

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(signedPayload)
    .digest('hex');

  const payloadStr = payload;
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType,
      payload: payloadStr,
      attempts: 1,
    },
  });

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Pulse-Signature': `t=${timestamp},v1=${signature}`,
        'Pulse-Event-Type': eventType,
        'Pulse-Delivery-Id': delivery.id,
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await response.text();

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: response.status,
        response: responseText.substring(0, 1000),
        success: response.ok,
      },
    });

    if (!response.ok) {
      logger.warn('Webhook delivery returned error', {
        webhookId: webhook.pulseId,
        status: response.status,
      });
    }
  } catch (error) {
    const retryDelay = Math.min(300000, Math.pow(2, delivery.attempts) * 60000); // exponential backoff

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        success: false,
        nextRetryAt: new Date(Date.now() + retryDelay),
      },
    });

    logger.error('Webhook delivery error', {
      webhookId: webhook.pulseId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const [timestampPart, signaturePart] = signature.split(',');
  const timestamp = timestampPart?.replace('t=', '');
  const v1 = signaturePart?.replace('v1=', '');

  if (!timestamp || !v1) return false;

  // Reject timestamps older than 5 minutes
  const tolerance = 300;
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > tolerance) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature));
}

export async function retryFailedDeliveries(): Promise<void> {
  const failedDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      success: false,
      nextRetryAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    include: { webhook: true },
  });

  for (const delivery of failedDeliveries) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { attempts: delivery.attempts + 1 },
    });

    deliverWebhook(
      delivery.webhook,
      delivery.eventType,
      delivery.payload as unknown as Record<string, unknown>,
      delivery.id
    ).catch(() => {});
  }

  logger.info(`Retried ${failedDeliveries.length} failed webhook deliveries`);
}
