import { PrismaClient, Payment, BankAccount, Customer } from '@prisma/client';
import {
  CreatePaymentInput,
  CreatePayoutInput,
  ACH_FEE_RATE,
  ACH_MIN_FEE,
  ACH_MAX_FEE,
} from '../../types';
import { ValidationError, NotFoundError, PulseError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { encrypt, decrypt } from '../../utils/crypto';
import { generateId } from '../../utils/ids';
import * as stripeBankService from '../stripe-bank';
import * as webhookService from '../webhooks';

const prisma = new PrismaClient();

function calculateACHFee(amountCents: number): number {
  const fee = Math.round(amountCents * ACH_FEE_RATE);
  return Math.max(ACH_MIN_FEE, Math.min(ACH_MAX_FEE, fee));
}

export async function createPayment(
  userId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  const { amount, currency, customer, payment_method, description, metadata, confirm } = input;

  if (amount <= 0) {
    throw new ValidationError('Amount must be positive', 'amount');
  }

  if (currency && currency !== 'usd') {
    throw new ValidationError('Only USD is supported', 'currency');
  }

  // Resolve customer
  let customerId: string | undefined;
  if (customer) {
    const cust = await prisma.customer.findFirst({
      where: { pulseId: customer, userId },
    });
    if (!cust) throw new NotFoundError('customer', customer);
    customerId = cust.id;
  }

  // Resolve payment method
  let paymentMethodId: string | undefined;
  let bankAccount: BankAccount | null = null;

  if (payment_method) {
    const pm = await prisma.paymentMethod.findFirst({
      where: { pulseId: payment_method, userId },
    });
    if (!pm) throw new NotFoundError('payment_method', payment_method);
    paymentMethodId = pm.id;

    if (pm.bankAccountId) {
      bankAccount = await prisma.bankAccount.findUnique({
        where: { id: pm.bankAccountId },
      });
    }
  } else if (customerId) {
    // Auto-select default payment method
    const pm = await prisma.paymentMethod.findFirst({
      where: { customerId, isDefault: true },
      include: { bankAccount: true },
    });
    if (pm) {
      paymentMethodId = pm.id;
      bankAccount = pm.bankAccount;
    }
  }

  if (!bankAccount) {
    throw new ValidationError('No bank account linked to payment method');
  }

  const fee = calculateACHFee(amount);
  const netAmount = amount - fee;

  // Create payment record
  const payExtId = generateId('pay');
  const payment = await prisma.payment.create({
    data: {
      userId,
      pulseId: payExtId,
      customerId,
      paymentMethodId,
      bankAccountId: bankAccount.id,
      amount,
      currency: currency || 'usd',
      description,
      status: confirm !== false ? 'processing' : 'pending',
      paymentType: 'ach_debit',
      direction: 'incoming',
      fee,
      netAmount,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });

  logger.info('Payment created', { paymentId: payment.pulseId, amount, userId });

  // Create event
  await webhookService.createEvent(userId, 'payment.created', 'payment', payment.pulseId, {
    id: payment.pulseId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
  });

  // If confirm, initiate the ACH transfer via Stripe
  if (confirm !== false && bankAccount.stripePaymentMethodId) {
    try {
      const intent = await stripeBankService.createPaymentIntent(
        amount,
        bankAccount.stripePaymentMethodId,
        undefined,
        description || 'Pulse Payment',
        metadata
      );

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripePaymentIntentId: intent.id,
          status: intent.status === 'succeeded' ? 'succeeded' : 'processing',
          initiatedAt: new Date(),
          ...(intent.status === 'succeeded' && { settledAt: new Date() }),
        },
      });

      await webhookService.createEvent(
        userId,
        intent.status === 'succeeded' ? 'payment.succeeded' : 'payment.processing',
        'payment',
        payment.pulseId,
        {
          id: payment.pulseId,
          status: updated.status,
          stripe_payment_intent: intent.id,
        }
      );

      return updated;
    } catch (error) {
      logger.error('Failed to initiate ACH transfer', { paymentId: payment.pulseId, error });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failedAt: new Date() },
      });

      await webhookService.createEvent(userId, 'payment.failed', 'payment', payment.pulseId, {
        id: payment.pulseId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Transfer initiation failed',
      });
    }
  }

  return payment;
}

export async function getPayment(userId: string, paymentId: string): Promise<Payment> {
  const payment = await prisma.payment.findFirst({
    where: { pulseId: paymentId, userId },
    include: {
      customer: true,
      bankAccount: {
        select: {
          id: true,
          pulseId: true,
          institutionName: true,
          accountName: true,
          mask: true,
          accountType: true,
        },
      },
    },
  });

  if (!payment) throw new NotFoundError('payment', paymentId);
  return payment;
}

export async function listPayments(
  userId: string,
  params: {
    page?: number;
    limit?: number;
    status?: string;
    customer?: string;
    startingAfter?: string;
  } = {}
) {
  const { page = 1, limit = 10, status, customer, startingAfter } = params;
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (status) where.status = status;
  if (customer) {
    const cust = await prisma.customer.findFirst({
      where: { pulseId: customer, userId },
    });
    if (cust) where.customerId = cust.id;
  }
  if (startingAfter) {
    const refPayment = await prisma.payment.findFirst({
      where: { pulseId: startingAfter },
    });
    if (refPayment) {
      where.createdAt = { gt: refPayment.createdAt };
    }
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        customer: { select: { id: true, pulseId: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: payments,
    hasMore: skip + limit < total,
    total,
    page,
    limit,
  };
}

export async function cancelPayment(userId: string, paymentId: string): Promise<Payment> {
  const payment = await prisma.payment.findFirst({
    where: { pulseId: paymentId, userId },
  });

  if (!payment) throw new NotFoundError('payment', paymentId);

  if (payment.status === 'succeeded') {
    throw new ValidationError('Cannot cancel a succeeded payment');
  }

  if (payment.status === 'canceled') {
    throw new ValidationError('Payment is already canceled');
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'canceled', canceledAt: new Date() },
  });

  await webhookService.createEvent(userId, 'payment.canceled', 'payment', payment.pulseId, {
    id: payment.pulseId,
    status: 'canceled',
  });

  logger.info('Payment canceled', { paymentId: payment.pulseId });

  return updated;
}

export async function createPayout(
  userId: string,
  input: CreatePayoutInput
) {
  const { amount, currency, bank_account, method, description, metadata } = input;

  if (amount <= 0) {
    throw new ValidationError('Amount must be positive', 'amount');
  }

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { pulseId: bank_account, userId },
  });

  if (!bankAccount) throw new NotFoundError('bank_account', bank_account);

  // Check for sufficient balance (simplified)
  const succeededPayments = await prisma.payment.aggregate({
    where: {
      userId,
      status: 'succeeded',
      direction: 'incoming',
    },
    _sum: { netAmount: true },
  });

  const existingPayouts = await prisma.payout.aggregate({
    where: {
      userId,
      status: { in: ['pending', 'processing'] },
    },
    _sum: { amount: true },
  });

  const availableBalance =
    (succeededPayments._sum.netAmount || 0) - (existingPayouts._sum.amount || 0);

  if (amount > availableBalance) {
    throw new ValidationError(
      `Insufficient balance. Available: $${(availableBalance / 100).toFixed(2)}`
    );
  }

  const fee = method === 'instant' ? Math.round(amount * 0.01) : 0;

  const poExtId = generateId('po');
  const payout = await prisma.payout.create({
    data: {
      userId,
      pulseId: poExtId,
      bankAccountId: bankAccount.id,
      amount,
      currency: currency || 'usd',
      status: 'pending',
      method: method || 'standard',
      fee,
      description,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });

  await webhookService.createEvent(userId, 'payout.created', 'payout', poExtId, {
    id: poExtId,
    amount: payout.amount,
    status: payout.status,
  });

  logger.info('Payout created', { payoutId: payout.pulseId, amount, userId });

  return payout;
}

// Called by webhook handler or cron to update payment status
export async function updatePaymentStatus(
  stripePaymentIntentId: string,
  status: 'succeeded' | 'failed',
  metadata?: { achReturnCode?: string; traceNumber?: string }
): Promise<Payment | null> {
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId },
  });

  if (!payment) {
    logger.warn('Payment not found for Stripe PaymentIntent', { stripePaymentIntentId });
    return null;
  }

  const updateData: any = {
    status,
    ...(status === 'succeeded' && { settledAt: new Date() }),
    ...(status === 'failed' && { failedAt: new Date() }),
    ...(metadata?.achReturnCode && { achReturnCode: metadata.achReturnCode }),
    ...(metadata?.traceNumber && { achTraceNumber: metadata.traceNumber }),
  };

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: updateData,
  });

  const eventType = status === 'succeeded' ? 'payment.succeeded' : 'payment.failed';

  await webhookService.createEvent(payment.userId, eventType, 'payment', payment.pulseId, {
    id: payment.pulseId,
    status,
    ...(metadata || {}),
  });

  logger.info('Payment status updated', { paymentId: payment.pulseId, status });

  return updated;
}
