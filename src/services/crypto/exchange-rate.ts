import { logger } from '../../utils/logger';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  TRX: 'tron',
  TON: 'the-open-network',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  ARB: 'arbitrum',
  OP: 'optimism',
  BASE: 'base',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  BUSD: 'binance-usd',
};

const FALLBACK_RATES: Record<string, number> = {
  BTC: 68000,
  ETH: 3800,
  SOL: 170,
  DOGE: 0.165,
  TRX: 0.12,
  TON: 5.87,
  BNB: 600,
  AVAX: 38,
  MATIC: 0.72,
  ARB: 1.15,
  OP: 2.30,
  BASE: 0.10,
  USDT: 1,
  USDC: 1,
  DAI: 1,
  BUSD: 1,
};

const CACHE_TTL = 60_000;
const rateCache = new Map<string, { rate: number; timestamp: number }>();

export async function getExchangeRate(currency: string): Promise<number> {
  const upper = currency.toUpperCase();
  const cached = rateCache.get(upper);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.rate;
  }

  const coinId = COIN_IDS[upper];
  if (!coinId) throw new Error(`Unsupported crypto currency: ${currency}`);

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    if (res.ok) {
      const data = await res.json() as Record<string, { usd: number }>;
      const rate = data[coinId]?.usd;
      if (rate) {
        rateCache.set(upper, { rate, timestamp: Date.now() });
        logger.debug('Exchange rate fetched', { currency: upper, rate });
        return rate;
      }
    }
  } catch {}

  const fallback = FALLBACK_RATES[upper];
  if (fallback) {
    logger.warn('Using fallback rate', { currency: upper, rate: fallback });
    return fallback;
  }

  throw new Error(`No exchange rate found for ${upper}`);
}

export async function convertUsdToCrypto(
  usdAmount: number,
  currency: string
): Promise<{ cryptoAmount: number; rate: number }> {
  const rate = await getExchangeRate(currency);
  const cryptoAmount = usdAmount / rate;
  return { cryptoAmount, rate };
}

export async function getAllRates(): Promise<Record<string, number>> {
  const ids = Object.values(COIN_IDS).join(',');
  const rates: Record<string, number> = {};

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd`
    );

    if (res.ok) {
      const data = await res.json() as Record<string, { usd: number }>;
      for (const [key, coinId] of Object.entries(COIN_IDS)) {
        if (data[coinId]) rates[key] = data[coinId].usd;
      }
    }
  } catch {
    logger.warn('CoinGecko fetch failed, using fallback rates');
  }

  // Fill in any missing with fallbacks
  for (const [key, rate] of Object.entries(FALLBACK_RATES)) {
    if (!rates[key]) rates[key] = rate;
  }

  return rates;
}
