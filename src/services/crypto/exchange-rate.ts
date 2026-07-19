import { logger } from '../../utils/logger';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const COIN_IDS: Record<string, string> = {
  TON: 'the-open-network',
  TRON: 'tron',
  DOGE: 'dogecoin',
};

const CACHE_TTL = 60_000; // 1 minute
const rateCache = new Map<string, { rate: number; timestamp: number }>();

export async function getExchangeRate(currency: string): Promise<number> {
  const upper = currency.toUpperCase();
  const cached = rateCache.get(upper);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.rate;
  }

  const coinId = COIN_IDS[upper];
  if (!coinId) throw new Error(`Unsupported crypto currency: ${currency}`);

  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`
  );

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }

  const data = await res.json() as Record<string, { usd: number }>;
  const rate = data[coinId]?.usd;

  if (!rate) {
    throw new Error(`No exchange rate found for ${upper}`);
  }

  rateCache.set(upper, { rate, timestamp: Date.now() });
  logger.debug('Exchange rate fetched', { currency: upper, rate });
  return rate;
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
  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd`
  );

  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = await res.json() as Record<string, { usd: number }>;
  const rates: Record<string, number> = {};

  for (const [key, coinId] of Object.entries(COIN_IDS)) {
    if (data[coinId]) rates[key] = data[coinId].usd;
  }

  return rates;
}
