import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { logger } from '../../../utils/logger';

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);

const BLOCKCHAIR_BASE = 'https://api.blockchair.com/dogecoin';

// Dogecoin mainnet network parameters
const DOGECOIN_NETWORK: bitcoin.Network = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

export interface DOGEAddress {
  address: string;
  privateKey: string;
  wif: string;
}

export interface DOGETransaction {
  hash: string;
  amount: number; // in satoshis
  from: string;
  to: string;
  confirmed: boolean;
  confirmations: number;
  timestamp: number;
  blockHeight: number;
}

function fromSatoshis(satoshis: number): number {
  return satoshis / 100_000_000;
}

export function generateAddress(): DOGEAddress {
  const keyPair = ECPair.makeRandom({ network: DOGECOIN_NETWORK });
  const { address } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network: DOGECOIN_NETWORK,
  });

  if (!address) throw new Error('Failed to generate Dogecoin address');

  const wif = keyPair.toWIF();

  logger.info('Generated Dogecoin address', { address });

  return {
    address,
    privateKey: Buffer.from(keyPair.privateKey!).toString('hex'),
    wif,
  };
}

export async function getBalance(address: string): Promise<number> {
  const res = await fetch(
    `${BLOCKCHAIR_BASE}/dashboards/address/${address}`
  );

  if (!res.ok) {
    throw new Error(`Blockchair API error: ${res.status}`);
  }

  const data = await res.json() as {
    data: {
      address: {
        balance: number;
      };
    };
  };

  return data.data.address.balance;
}

export async function getTransactions(
  address: string,
  limit: number = 50
): Promise<DOGETransaction[]> {
  const res = await fetch(
    `${BLOCKCHAIR_BASE}/transactions?q=output(${address})&s=output(desc)&limit=${limit}`
  );

  if (!res.ok) {
    throw new Error(`Blockchair API error: ${res.status}`);
  }

  const data = await res.json() as {
    data: Array<{
      hash: string;
      time: string;
      block_id: number;
      output_total: number;
    }>;
  };

  const chainRes = await fetch(`${BLOCKCHAIR_BASE}/stats`);
  const chainData = await chainRes.json() as {
    data: { context: { blocks: number } };
  };
  const currentBlock = chainData.data.context.blocks;

  return data.data.map((tx) => ({
    hash: tx.hash,
    amount: tx.output_total,
    from: '',
    to: address,
    confirmed: true,
    confirmations: currentBlock - tx.block_id,
    timestamp: new Date(tx.time).getTime() / 1000,
    blockHeight: tx.block_id,
  }));
}

export async function waitForTransaction(
  address: string,
  expectedAmountSatoshis: number,
  timeoutMs: number = 600_000,
  requiredConfirms: number = 6
): Promise<DOGETransaction | null> {
  const startTime = Date.now();
  const seen = new Set<string>();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const txs = await getTransactions(address, 10);

      for (const tx of txs) {
        if (seen.has(tx.hash)) continue;
        seen.add(tx.hash);

        if (tx.amount === expectedAmountSatoshis && tx.confirmations >= requiredConfirms) {
          logger.info('Dogecoin transaction confirmed', {
            hash: tx.hash,
            amount: fromSatoshis(tx.amount),
            confirmations: tx.confirmations,
          });
          return tx;
        }
      }
    } catch (err) {
      logger.warn('Error polling Dogecoin transactions', { error: err });
    }

    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  return null;
}
