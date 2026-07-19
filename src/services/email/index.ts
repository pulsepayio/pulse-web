import { logger } from '../../utils/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

interface DeliveryItem {
  label: string;
  value: string;
}

export async function sendDeliveryEmail(to: string, productName: string, items: DeliveryItem[]): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logger.warn('Resend API key not set, skipping email', { to });
    return false;
  }

  const itemsHtml = items.map(i =>
    `<tr><td style="padding:8px 12px;font-size:12px;color:#666;font-weight:600;border-bottom:1px solid #222">${i.label}</td><td style="padding:8px 12px;font-size:14px;color:#fff;font-family:monospace;border-bottom:1px solid #222;word-break:break-all">${i.value}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;border:1px solid #222">
<tr><td style="padding:32px">
<div style="text-align:center;margin-bottom:24px">
<div style="font-size:20px;font-weight:700;color:#8b5cf6">Pulse</div>
<div style="font-size:13px;color:#555;margin-top:4px">Payment confirmed</div>
</div>
<div style="text-align:center;margin-bottom:24px">
<div style="width:48px;height:48px;background:#166534;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#22c55e">&#10003;</div>
<div style="font-size:18px;font-weight:700;color:#fff;margin-top:12px">Your purchase is ready</div>
<div style="font-size:13px;color:#888;margin-top:6px">${productName || 'Digital product'}</div>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;border:1px solid #2a2a2a">
<tr><td style="padding:18px 20px">
<div style="font-size:11px;color:#8b5cf6;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;margin-bottom:14px">Your delivery</div>
<table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
</td></tr></table>
<div style="text-align:center;font-size:11px;color:#333;margin-top:24px">Powered by Pulse</div>
</td></tr></table></td></tr></table></body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pulse <delivery@pulsepay.up.railway.app>',
        to: [to],
        subject: `Your purchase from Pulse - ${productName || 'Digital Product'}`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('Resend email failed', { status: res.status, body });
      return false;
    }

    logger.info('Delivery email sent', { to: to.substring(0, 3) + '***' });
    return true;
  } catch (err: any) {
    logger.error('Resend email error', { error: err.message });
    return false;
  }
}
