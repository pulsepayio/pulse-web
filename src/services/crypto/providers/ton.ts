import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { beginCell, toNano, Address } from '@ton/core';
import { logger } from '../../../utils/logger';

const TON_CENTER_BASE = 'https://toncenter.com/api/v3';

let client: TonClient | null = null;

function getClient(): TonClient {
  if (!client) {
    client = new TonClient({
      endpoint: TON_CENTER_BASE,
    });
  }
  return client;
}

export interface TONAddress {
  address: string;
  publicKey: string;
  mnemonic: string;
}

export interface TONTransaction {
  hash: string;
  amount: string;
  from: string;
  to: string;
  confirmed: boolean;
  timestamp: number;
}

export async function generateAddress(): Promise<TONAddress> {
  const mnemonic = await mnemonicNew(24);
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const address = wallet.address.toString();

  logger.info('Generated TON address', { address });

  return {
    address,
    publicKey: keyPair.publicKey.toString('hex'),
    mnemonic: mnemonic.join(' '),
  };
}

export async function getBalance(address: string): Promise<number> {
  const ton = getClient();
  const addr = Address.parse(address);
  const balance = await ton.getBalance(addr);
  // Return in nanoTON
  return Number(balance);
}

export async function getTransactions(
  address: string,
  limit: number = 50
): Promise<TONTransaction[]> {
  const ton = getClient();
  const addr = Address.parse(address);

  const result = await ton.getTransactions(addr, { limit });

  return result.map((tx: any) => ({
    hash: tx.hash().toString('hex'),
    amount: tx.inMessage?.info?.value?.coins?.toString() || '0',
    from: tx.inMessage?.info?.src?.toString() || '',
    to: tx.inMessage?.info?.dest?.toString() || '',
    confirmed: true, // TON transactions are final after 1 block
    timestamp: tx.inMessage?.info?.createdLt || 0,
  }));
}

export async function waitForTransaction(
  address: string,
  expectedAmount: string,
  timeoutMs: number = 300_000
): Promise<TONTransaction | null> {
  const startTime = Date.now();
  const seen = new Set<string>();

  while (Date.now() - startTime < timeoutMs) {
    const txs = await getTransactions(address, 10);

    for (const tx of txs) {
      if (seen.has(tx.hash)) continue;
      seen.add(tx.hash);

      if (tx.confirmed && tx.amount === expectedAmount) {
        logger.info('TON transaction confirmed', {
          hash: tx.hash,
          amount: tx.amount,
          from: tx.from,
        });
        return tx;
      }
    }

    // Wait 3 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return null;
}
