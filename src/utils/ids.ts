import { nanoid } from 'nanoid';

export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(24)}`;
}

// Map model names to prefixes
export const ID_PREFIXES = {
  customer: 'cus',
  bank_account: 'ba',
  payment_method: 'pm',
  payment: 'pay',
  payout: 'po',
  webhook: 'wh',
  event: 'evt',
} as const;

export function toExternalId(pulseId: string, prefix: string): string {
  if (pulseId.startsWith(`${prefix}_`)) return pulseId;
  return `${prefix}_${pulseId}`;
}
