import crypto from 'crypto';

const SECRET = process.env.DELIVERY_HMAC_SECRET || 'pulse-delivery-secret-change-in-production';

export function signDeliveryToken(sessionId: string, email: string, expiresAt: number): string {
  const payload = `${sessionId}:${email.toLowerCase()}:${expiresAt}`;
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function verifyDeliveryToken(sessionId: string, email: string, expiresAt: number, token: string): boolean {
  const expected = signDeliveryToken(sessionId, email, expiresAt);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
}

export function generateDeliveryToken(sessionId: string, email: string, validMinutes: number = 60): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + validMinutes * 60_000;
  const token = signDeliveryToken(sessionId, email, expiresAt);
  return { token, expiresAt };
}
