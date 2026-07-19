import CryptoJS from 'crypto-js';
import { getConfig } from './config';

export function encrypt(text: string): string {
  const { encryptionKey } = getConfig();
  return CryptoJS.AES.encrypt(text, encryptionKey).toString();
}

export function decrypt(ciphertext: string): string {
  const { encryptionKey } = getConfig();
  const bytes = CryptoJS.AES.decrypt(ciphertext, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function hashApiKey(key: string): string {
  return CryptoJS.SHA256(key).toString();
}
