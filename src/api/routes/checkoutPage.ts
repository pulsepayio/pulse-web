import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as checkoutService from '../../services/checkout';
import { provisionAllWallets } from '../../services/crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const htmlRouter = Router();
const apiRouter = Router();

const templatePath = path.join(__dirname, '../../../src/views/checkout.html');
const template = fs.readFileSync(templatePath, 'utf-8');

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// GET /checkout/:id - serve hosted checkout page (public, no auth)
htmlRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await checkoutService.getCheckoutSession(req.params.id);

    if (!session) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Not Found</title>
        <style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .msg{text-align:center}.msg h1{font-size:48px;margin-bottom:8px}.msg p{color:#888}</style></head>
        <body><div class="msg"><h1>404</h1><p>This checkout session does not exist or has expired.</p></div></body></html>
      `);
      return;
    }

    if (session.status !== 'open') {
      const statusMsg = session.status === 'confirmed'
        ? 'This payment has been completed.'
        : 'This checkout session has expired.';

      res.status(410).send(`
        <!DOCTYPE html>
        <html><head><title>${session.status}</title>
        <style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .msg{text-align:center}.msg h1{font-size:36px;margin-bottom:8px;color:${session.status === 'confirmed' ? '#22c55e' : '#ef4444'}}
        .msg p{color:#888}</style></head>
        <body><div class="msg"><h1>${session.status === 'confirmed' ? 'Paid' : 'Expired'}</h1><p>${statusMsg}</p></div></body></html>
      `);
      return;
    }

    const html = template.replace('{{SESSION_ID}}', req.params.id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

// GET /session/:id - JSON API for checkout data (used by the page's JS)
apiRouter.get('/session/:id', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!rateLimit(ip)) {
      res.status(429).json({ error: { message: 'Rate limit exceeded' } });
      return;
    }

    const session = await checkoutService.getCheckoutSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: { message: 'Session not found' } });
      return;
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// POST /session/:id/email - store buyer email with the checkout session
apiRouter.post('/session/:id/email', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!rateLimit(ip)) {
      res.status(429).json({ error: { message: 'Rate limit exceeded' } });
      return;
    }

    const { email } = req.body;
    if (!email || !email.includes('@') || email.length > 254) {
      res.status(400).json({ error: { message: 'Valid email required' } });
      return;
    }

    const ok = await checkoutService.setBuyerEmail(req.params.id, email);
    if (!ok) {
      res.status(404).json({ error: { message: 'Session not found or not open' } });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// POST /session/:id/deliver - get delivery items (requires email match + confirmed payment)
apiRouter.post('/session/:id/deliver', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!rateLimit(ip)) {
      res.status(429).json({ error: { message: 'Rate limit exceeded' } });
      return;
    }

    const { email } = req.body;
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: { message: 'Email required' } });
      return;
    }

    const data = await checkoutService.getDeliveryData(req.params.id, email);
    if (!data) {
      res.status(403).json({ error: { message: 'Payment not confirmed or email does not match' } });
      return;
    }

    res.json({
      items: data.items,
      _delivery_token: data.deliveryToken,
      _delivery_expires: data.deliveryExpires,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// GET /wallets/:sessionId/:currency - public wallet address lookup for checkout
apiRouter.get('/wallets/:sessionId/:currency', async (req: Request, res: Response) => {
  try {
    const session = await prisma.checkoutSession.findUnique({
      where: { pulseId: req.params.sessionId },
      select: { userId: true, status: true },
    });
    if (!session || session.status !== 'open') {
      res.status(404).json({ error: { message: 'Session not found' } });
      return;
    }
    await provisionAllWallets(session.userId);
    const wallet = await prisma.cryptoWallet.findFirst({
      where: { userId: session.userId, currency: req.params.currency.toUpperCase() },
    });
    if (!wallet) {
      res.status(404).json({ error: { message: 'Wallet not found for this currency' } });
      return;
    }
    res.json({ address: wallet.address, currency: wallet.currency });
  } catch (error) {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

apiRouter.post('/test-confirm/:sessionId', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: { message: 'Email required in body' } });
      return;
    }

    const session = await prisma.checkoutSession.findUnique({
      where: { pulseId: req.params.sessionId },
      include: { cryptoPayment: true, product: true },
    });
    if (!session) {
      res.status(404).json({ error: { message: 'Session not found' } });
      return;
    }

    if (session.cryptoPayment) {
      await prisma.cryptoPayment.update({
        where: { id: session.cryptoPaymentId! },
        data: { status: 'confirmed', paidAt: new Date() },
      });
    }
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'confirmed', completedAt: new Date(), buyerEmail: email.toLowerCase().trim() },
    });

    const items = session.product?.deliveryItems ? JSON.parse(session.product.deliveryItems) : [];
    res.json({ ok: true, message: 'Session confirmed', email, delivery_items: items });
  } catch (error) {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export { htmlRouter, apiRouter };
export default htmlRouter;
