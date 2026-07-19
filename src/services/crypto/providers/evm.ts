import * as crypto from 'crypto';
import { keccak256 as _keccak256 } from 'js-sha3';
import { logger } from '../../../utils/logger';

let secp256k1: any = null;
function getSecp() {
  if (!secp256k1) secp256k1 = require('tiny-secp256k1');
  return secp256k1;
}

function keccak256(data: Buffer): Buffer {
  return Buffer.from(_keccak256.arrayBuffer(data));
}

function pubKeyToAddress(pubKeyUncompressed: Buffer): string {
  const hash = keccak256(pubKeyUncompressed.slice(1));
  return '0x' + hash.slice(-20).toString('hex');
}

export function generateAddress() {
  const privateKey = crypto.randomBytes(32);
  const pubkey = Buffer.from(getSecp().pointFromScalar(privateKey, false));
  const address = pubKeyToAddress(pubkey);
  const hexKey = '0x' + privateKey.toString('hex');
  logger.info('Generated EVM address', { address });
  return { address, privateKey: hexKey };
}

export async function getBalance(_address: string): Promise<number> {
  return 0;
}

export async function waitForTransaction(
  _address: string,
  _expectedWei: number,
  _timeoutMs: number,
  _requiredConfirms: number
): Promise<boolean> {
  return false;
}
