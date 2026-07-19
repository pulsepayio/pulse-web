import { TronWeb } from 'tronweb';
import { logger } from '../../../utils/logger';

const TRONGRID_BASE = 'https://api.trongrid.io';

let tronWeb: any = null;

function getTronWeb(): any {
  if (!tronWeb) {
    tronWeb = new TronWeb({
      fullHost: TRONGRID_BASE,
      headers: {
        'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '',
      },
    });
  }
  return tronWeb;
}

export interface TRONAddress {
  address: string;
  hexAddress: string;
  privateKey: string;
}

export interface TRONTransaction {
  hash: string;
  amount: number; // in SUN (1 TRX = 1,000,000 SUN)
  from: string;
  to: string;
  confirmed: boolean;
  timestamp: number;
  blockNumber: number;
}

export async function generateAddress(): Promise<TRONAddress> {
  const crypto = require('crypto');
  const tw = getTronWeb();
  const privateKeyBytes = crypto.randomBytes(32);
  const privateKey = privateKeyBytes.toString('hex');
  const addressData = tw.address.fromPrivateKey(privateKey);

  logger.info('Generated TRON address', { address: addressData });

  return {
    address: addressData,
    hexAddress: tw.address.toHex(addressData),
    privateKey,
  };
}

export async function getBalance(address: string): Promise<number> {
  const tw = getTronWeb();
  const balance = await tw.trx.getBalance(address);
  return balance; // in SUN
}

export async function getTransactions(
  address: string,
  limit: number = 50
): Promise<TRONTransaction[]> {
  const res = await fetch(
    `${TRONGRID_BASE}/v1/accounts/${address}/transactions?only_confirmed=true&limit=${limit}`,
    {
      headers: {
        'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`TRON API error: ${res.status}`);
  }

  const data = await res.json() as {
    data: Array<{
      txID: string;
      raw_data: {
        contract: Array<{
          parameter: {
            value: {
              amount: number;
              owner_address: string;
              to_address: string;
            };
          };
        }>;
      };
      block_number: number;
      block_timestamp: number;
    }>;
  };

  return data.data.map((tx) => {
    const contract = tx.raw_data.contract[0]?.parameter?.value;
    return {
      hash: tx.txID,
      amount: contract?.amount || 0,
      from: contract?.owner_address || '',
      to: contract?.to_address || '',
      confirmed: true,
      timestamp: tx.block_timestamp,
      blockNumber: tx.block_number,
    };
  });
}

export async function getCurrentBlock(): Promise<number> {
  const tw = getTronWeb();
  const block = await tw.trx.getCurrentBlock();
  return block.block_header.raw_data.number;
}

export async function waitForTransaction(
  address: string,
  expectedAmount: number,
  timeoutMs: number = 300_000,
  requiredConfirms: number = 19
): Promise<TRONTransaction | null> {
  const startTime = Date.now();
  const seen = new Set<string>();

  while (Date.now() - startTime < timeoutMs) {
    const txs = await getTransactions(address, 10);
    const currentBlock = await getCurrentBlock();

    for (const tx of txs) {
      if (seen.has(tx.hash)) continue;
      seen.add(tx.hash);

      if (tx.amount === expectedAmount) {
        const confirmations = currentBlock - tx.blockNumber;
        if (confirmations >= requiredConfirms) {
          logger.info('TRON transaction confirmed', {
            hash: tx.hash,
            amount: tx.amount,
            confirmations,
          });
          return tx;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return null;
}
