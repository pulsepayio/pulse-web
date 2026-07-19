import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/ids';
import * as exchangeRate from './exchange-rate';
import * as tonProvider from './providers/ton';
import * as tronProvider from './providers/tron';
import * as dogeProvider from './providers/dogecoin';
import * as btcProvider from './providers/bitcoin';
import * as evmProvider from './providers/evm';

const prisma = new PrismaClient();

export type CryptoCurrency =
  | 'BTC' | 'ETH' | 'SOL' | 'DOGE' | 'TRX' | 'TON'
  | 'BNB' | 'AVAX' | 'MATIC' | 'ARB' | 'OP' | 'BASE'
  | 'USDT' | 'USDC' | 'DAI' | 'BUSD';

export const ALL_CURRENCIES: CryptoCurrency[] = [
  'BTC', 'ETH', 'SOL', 'DOGE', 'TRX', 'TON',
  'BNB', 'AVAX', 'MATIC', 'ARB', 'OP', 'BASE',
  'USDT', 'USDC', 'DAI', 'BUSD',
];

const EVM_CURRENCIES: Set<string> = new Set(['ETH', 'BNB', 'AVAX', 'MATIC', 'ARB', 'OP', 'BASE']);

const REQUIRED_CONFIRMATIONS: Record<CryptoCurrency, number> = {
  BTC: 6, ETH: 12, SOL: 1, DOGE: 6, TRX: 19, TON: 1,
  BNB: 15, AVAX: 1, MATIC: 128, ARB: 1, OP: 1, BASE: 1,
  USDT: 12, USDC: 12, DAI: 12, BUSD: 15,
};

const PAYMENT_EXPIRY_MINUTES = 30;

interface CreateCryptoPaymentInput {
  userId: string;
  amountUsd: number;
  currency: CryptoCurrency;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export async function createCryptoPayment(input: CreateCryptoPaymentInput) {
  const { userId, amountUsd, currency, customerId, description, metadata } = input;

  // Get exchange rate
  const { cryptoAmount, rate } = await exchangeRate.convertUsdToCrypto(amountUsd, currency);

  // Generate or reuse deposit address
  const wallet = await getOrCreateWallet(userId, currency);

  // Create crypto payment record
  const extId = generateId('cp');
  const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000);

  const cryptoPayment = await prisma.cryptoPayment.create({
    data: {
      userId,
      pulseId: extId,
      walletId: wallet.id,
      currency,
      amountDue: cryptoAmount,
      exchangeRate: rate,
      depositAddress: wallet.address,
      requiredConfirms: REQUIRED_CONFIRMATIONS[currency],
      status: 'pending',
      expiresAt,
    },
  });

  logger.info('Crypto payment created', {
    pulseId: extId,
    currency,
    amountUsd,
    cryptoAmount,
    rate,
    depositAddress: wallet.address,
  });

  // Start monitoring in background
  monitorPayment(cryptoPayment.id).catch((err) => {
    logger.error('Payment monitoring failed', { paymentId: extId, error: err });
  });

  return {
    id: extId,
    object: 'crypto_payment',
    currency,
    amount_usd: amountUsd,
    amount_crypto: cryptoAmount,
    exchange_rate: rate,
    deposit_address: wallet.address,
    required_confirmations: REQUIRED_CONFIRMATIONS[currency],
    expires_at: expiresAt.toISOString(),
    status: 'pending',
  };
}

async function getOrCreateWallet(userId: string, currency: CryptoCurrency) {
  const existing = await prisma.cryptoWallet.findFirst({
    where: { userId, currency },
    orderBy: { derivationIndex: 'desc' },
  });
  if (existing) return existing;

  let addressData: { address: string; privateKey: string };

  switch (currency) {
    case 'TON': {
      const ton = await tonProvider.generateAddress();
      addressData = { address: ton.address, privateKey: ton.mnemonic };
      break;
    }
    case 'TRX': {
      const tron = await tronProvider.generateAddress();
      addressData = { address: tron.address, privateKey: tron.privateKey };
      break;
    }
    case 'DOGE': {
      const doge = dogeProvider.generateAddress();
      addressData = { address: doge.address, privateKey: doge.privateKey };
      break;
    }
    case 'BTC': {
      const btc = btcProvider.generateAddress();
      addressData = { address: btc.address, privateKey: btc.privateKey };
      break;
    }
    default: {
      const evm = evmProvider.generateAddress();
      addressData = { address: evm.address, privateKey: evm.privateKey };
      break;
    }
  }

  const extId = generateId('cw');
  const wallet = await prisma.cryptoWallet.create({
    data: {
      pulseId: extId,
      userId,
      currency,
      address: addressData.address,
      privateKey: addressData.privateKey,
      derivationIndex: 0,
    },
  });

  return wallet;
}

export async function provisionAllWallets(userId: string) {
  const existing = await prisma.cryptoWallet.findMany({ where: { userId }, select: { currency: true } });
  const existingSet = new Set(existing.map(w => w.currency));
  const created = [];
  for (const currency of ALL_CURRENCIES) {
    if (!existingSet.has(currency)) {
      const wallet = await getOrCreateWallet(userId, currency);
      created.push({ currency: wallet.currency, address: wallet.address });
    }
  }
  return created;
}

async function monitorPayment(cryptoPaymentId: string) {
  const payment = await prisma.cryptoPayment.findUnique({
    where: { id: cryptoPaymentId },
  });

  if (!payment || payment.status !== 'pending') return;

  const wallet = await prisma.cryptoWallet.findUnique({
    where: { id: payment.walletId },
  });

  if (!wallet) return;

  const currency = payment.currency as CryptoCurrency;
  const expectedAmount = Number(payment.amountDue);

  logger.info('Starting payment monitoring', {
    pulseId: payment.pulseId,
    currency,
    address: wallet.address,
  });

  let txFound = false;

  switch (currency) {
    case 'TON': {
      const expectedNano = (expectedAmount * 1e9).toString();
      const tx = await tonProvider.waitForTransaction(
        wallet.address,
        expectedNano,
        PAYMENT_EXPIRY_MINUTES * 60_000
      );
      if (tx) txFound = true;
      break;
    }
    case 'TRX': {
      const expectedSun = Math.round(expectedAmount * 1_000_000);
      const tx = await tronProvider.waitForTransaction(
        wallet.address,
        expectedSun,
        PAYMENT_EXPIRY_MINUTES * 60_000,
        REQUIRED_CONFIRMATIONS.TRX
      );
      if (tx) txFound = true;
      break;
    }
    case 'DOGE': {
      const expectedSatoshis = Math.round(expectedAmount * 100_000_000);
      const tx = await dogeProvider.waitForTransaction(
        wallet.address,
        expectedSatoshis,
        PAYMENT_EXPIRY_MINUTES * 60_000,
        REQUIRED_CONFIRMATIONS.DOGE
      );
      if (tx) txFound = true;
      break;
    }
  }

  if (txFound) {
    await prisma.cryptoPayment.update({
      where: { id: cryptoPaymentId },
      data: {
        status: 'confirmed',
        amountReceived: payment.amountDue,
        paidAt: new Date(),
      },
    });

    logger.info('Crypto payment confirmed', { pulseId: payment.pulseId });
  } else {
    await prisma.cryptoPayment.update({
      where: { id: cryptoPaymentId },
      data: { status: 'expired' },
    });

    logger.warn('Crypto payment expired', { pulseId: payment.pulseId });
  }
}

export async function getCryptoPayment(pulseId: string) {
  return prisma.cryptoPayment.findUnique({
    where: { pulseId },
    include: { wallet: true },
  });
}

export async function listCryptoPayments(userId: string, params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.cryptoPayment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cryptoPayment.count({ where: { userId } }),
  ]);

  return { data: payments, total, page, limit, hasMore: skip + limit < total };
}

export async function getRates() {
  return exchangeRate.getAllRates();
}
