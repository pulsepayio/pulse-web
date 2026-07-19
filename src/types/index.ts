export interface PulseConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  tronApiKey: string;
  webhookSecret: string;
  encryptionKey: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  apiKey: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  total: number;
  page: number;
  limit: number;
}

export interface CreateCustomerInput {
  email?: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, string>;
}

export interface CreatePaymentInput {
  amount: number;
  currency?: string;
  customer?: string;
  payment_method?: string;
  description?: string;
  metadata?: Record<string, string>;
  confirm?: boolean;
}

export interface CreatePayoutInput {
  amount: number;
  currency?: string;
  bank_account: string;
  method?: 'standard' | 'instant';
  description?: string;
  metadata?: Record<string, string>;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded';

export type PaymentType = 'ach_debit' | 'ach_credit' | 'wire';
export type PaymentDirection = 'incoming' | 'outgoing';

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export interface BankAccountDetails {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
  mask: string;
  name: string;
  official_name: string | null;
  subtype: string;
  type: string;
}

export interface Institution {
  institution_id: string;
  name: string;
  products: string[];
  country_codes: string[];
  url: string | null;
  logo: string | null;
  primary_color: string | null;
}

export const ACH_FEE_RATE = 0.008; // 0.8%
export const ACH_MIN_FEE = 80; // $0.80 in cents
export const ACH_MAX_FEE = 500; // $5.00 in cents
export const WIRE_FEE = 2500; // $25.00 in cents

export type EventKind =
  | 'payment.created'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.canceled'
  | 'payment.refunded'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'bank_account.created'
  | 'bank_account.verified'
  | 'bank_account.failed'
  | 'payout.created'
  | 'payout.paid'
  | 'payout.failed'
  | 'payment_method.created'
  | 'payment_method.detached'
  | 'crypto_payment.created'
  | 'crypto_payment.confirmed'
  | 'crypto_payment.expired';

export type CryptoCurrency = 'TON' | 'TRON' | 'DOGE';
