import Stripe from 'stripe';
import { getConfig } from '../../utils/config';
import { logger } from '../../utils/logger';

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const config = getConfig();
    stripeClient = new Stripe(config.stripeSecretKey, {
      apiVersion: '2024-06-20' as any,
    });
  }
  return stripeClient;
}

// ── Financial Connections (bank linking) ──────────────────────

export async function createFinancialConnectionsSession(userId: string) {
  const stripe = getStripeClient();

  const session = await stripe.financialConnections.sessions.create({
    account_holder: { type: 'customer', customer: undefined },
    permissions: ['balances', 'payment_method', 'transactions'],
  });

  logger.info('Created Financial Connections session', { userId, sessionId: session.id });

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}

export async function retrieveFinancialConnectionsAccount(
  sessionId: string,
  accountId: string
) {
  const stripe = getStripeClient();
  const account = await stripe.financialConnections.accounts.retrieve(accountId);
  return account;
}

// ── Payment Methods (ACH bank accounts) ──────────────────────

export async function createUsBankAccountPaymentMethod(
  sessionId: string,
  accountId: string,
  customerId?: string
) {
  const stripe = getStripeClient();

  const paymentMethod = await stripe.paymentMethods.create({
    type: 'us_bank_account',
    us_bank_account: {
      financial_connections_account: accountId,
    },
    ...(customerId ? { customer: customerId } : {}),
  });

  logger.info('Created US bank account payment method', {
    paymentMethodId: paymentMethod.id,
    accountId,
  });

  return paymentMethod;
}

export async function attachPaymentMethod(paymentMethodId: string, customerId: string) {
  const stripe = getStripeClient();
  return stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
}

// ── ACH Payments (PaymentIntents) ────────────────────────────

export async function createPaymentIntent(
  amount: number,
  paymentMethodId: string,
  customerId?: string,
  description?: string,
  metadata?: Record<string, string>
) {
  const stripe = getStripeClient();

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method: paymentMethodId,
    payment_method_types: ['us_bank_account'],
    confirm: true,
    description,
    metadata,
    ...(customerId ? { customer: customerId } : {}),
    payment_method_options: {
      us_bank_account: {
        verification_method: 'automatic',
      },
    },
  });

  logger.info('Created Stripe PaymentIntent', {
    paymentIntentId: intent.id,
    amount,
    status: intent.status,
  });

  return intent;
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

// ── Stripe Customers ─────────────────────────────────────────

export async function createCustomer(email: string, name?: string, metadata?: Record<string, string>) {
  const stripe = getStripeClient();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata,
  });

  return customer;
}

// ── Webhook Verification ─────────────────────────────────────

export function constructWebhookEvent(payload: string | Buffer, signature: string) {
  const stripe = getStripeClient();
  const config = getConfig();
  return stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
}
