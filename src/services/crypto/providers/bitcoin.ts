import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { logger } from '../../../utils/logger';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const BTC_NETWORK: bitcoin.Network = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bc',
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
};

export function generateAddress() {
  const keyPair = ECPair.makeRandom({ network: BTC_NETWORK });
  const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: BTC_NETWORK });
  const privateKey = keyPair.toWIF();
  logger.info('Generated BTC address', { address });
  return { address: address || '', privateKey };
}

export async function getBalance(address: string): Promise<number> {
  try {
    const res = await fetch(`https://blockchain.info/q/addressbalance/${address}`);
    const satoshis = parseInt(await res.text(), 10);
    return isNaN(satoshis) ? 0 : satoshis / 1e8;
  } catch { return 0; }
}

export async function waitForTransaction(
  address: string,
  expectedSatoshis: number,
  timeoutMs: number,
  requiredConfirms: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=5`);
      const data: any = await res.json();
      for (const tx of data.txs || []) {
        for (const out of tx.out || []) {
          if (out.addr === address && out.value >= expectedSatoshis) {
            const confirmations = (data.chain_height || 0) - (tx.block_height || 0) + 1;
            if (confirmations >= requiredConfirms) return true;
          }
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 15000));
  }
  return false;
}
