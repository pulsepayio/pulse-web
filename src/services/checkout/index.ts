import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/ids';
import * as cryptoService from '../crypto';
import type { CryptoCurrency } from '../crypto';

const prisma = new PrismaClient();

const SESSION_EXPIRY_MINUTES = 30;

interface CreateCheckoutInput {
  userId: string;
  amountUsd: number;
  currency: CryptoCurrency;
  customerId?: string;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(input: CreateCheckoutInput) {
  const { userId, amountUsd, currency, customerId, description, successUrl, cancelUrl, metadata } = input;

  // Create the underlying crypto payment
  const cryptoPayment = await cryptoService.createCryptoPayment({
    userId,
    amountUsd,
    currency,
    customerId,
    description,
    metadata,
  });

  // Create checkout session
  const extId = generateId('cs');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60_000);

  const session = await prisma.checkoutSession.create({
    data: {
      pulseId: extId,
      userId,
      customerId,
      amountUsd: Math.round(amountUsd * 100),
      currency,
      description,
      successUrl,
      cancelUrl,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      status: 'open',
      expiresAt,
    },
  });

  // Link crypto payment to checkout session
  // We need to find the crypto payment we just created
  const cryptoPaymentRecord = await prisma.cryptoPayment.findFirst({
    where: { pulseId: cryptoPayment.id },
  });

  if (cryptoPaymentRecord) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { cryptoPaymentId: cryptoPaymentRecord.id },
    });
  }

  logger.info('Checkout session created', {
    pulseId: extId,
    amountUsd,
    currency,
    depositAddress: cryptoPayment.deposit_address,
  });

  return {
    id: extId,
    object: 'checkout_session',
    amount_usd: amountUsd,
    currency,
    crypto_payment: cryptoPayment,
    url: `/checkout/${extId}`,
    expires_at: expiresAt.toISOString(),
    status: 'open',
  };
}

export async function getCheckoutSession(pulseId: string) {
  const session = await prisma.checkoutSession.findUnique({
    where: { pulseId },
    include: {
      cryptoPayment: true,
      customer: true,
      product: true,
    },
  });

  if (!session) return null;

  return {
    id: session.pulseId,
    object: 'checkout_session',
    amount_usd: session.amountUsd / 100,
    currency: session.currency,
    description: session.description,
    status: session.status,
    success_url: session.successUrl,
    cancel_url: session.cancelUrl,
    metadata: session.metadata,
    expires_at: session.expiresAt.toISOString(),
    completed_at: session.completedAt?.toISOString() || null,
    product_name: session.product?.name || null,
    delivery_items: session.product?.deliveryItems ? JSON.parse(session.product.deliveryItems) : [],
    crypto_payment: session.cryptoPayment
      ? {
          id: session.cryptoPayment.pulseId,
          amount_due: Number(session.cryptoPayment.amountDue),
          exchange_rate: Number(session.cryptoPayment.exchangeRate),
          deposit_address: session.cryptoPayment.depositAddress,
          status: session.cryptoPayment.status,
          tx_hash: session.cryptoPayment.txHash,
          confirmations: session.cryptoPayment.confirmations,
          required_confirmations: session.cryptoPayment.requiredConfirms,
        }
      : null,
    created: Math.floor(session.createdAt.getTime() / 1000),
  };
}

export async function expireCheckoutSession(pulseId: string) {
  const session = await prisma.checkoutSession.findUnique({
    where: { pulseId },
  });

  if (!session || session.status !== 'open') return;

  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: { status: 'expired' },
  });

  logger.info('Checkout session expired', { pulseId });
}

export async function listCheckoutSessions(
  userId: string,
  params: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.checkoutSession.findMany({
      where: { userId },
      include: { cryptoPayment: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.checkoutSession.count({ where: { userId } }),
  ]);

  return {
    data: sessions.map((s) => ({
      id: s.pulseId,
      object: 'checkout_session',
      amount_usd: s.amountUsd / 100,
      currency: s.currency,
      status: s.status,
      created: Math.floor(s.createdAt.getTime() / 1000),
    })),
    total,
    page,
    limit,
    hasMore: skip + limit < total,
  };
}
