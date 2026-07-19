import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';
import fs from 'fs';

const COOKIE_PATH = './cookie.json';

const FALLBACK = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'pulsepay.io@gmail.com',
  pass: 'ryem ixwo ejym ryzb',
  from: 'Pulse <pulsepay.io@gmail.com>',
};

interface smtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

interface DeliveryItem {
  label: string;
  value: string;
}

function loadSmtp(): smtpConfig {
  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf-8');
    const conf = JSON.parse(raw);
    if (conf.host && conf.user && conf.pass) {
      return {
        host: conf.host,
        port: conf.port || 587,
        user: conf.user,
        pass: conf.pass,
        from: conf.from || conf.user,
      };
    }
  } catch {}
  return { ...FALLBACK };
}

function transporterFromConfig(): nodemailer.Transporter {
  const smtp = loadSmtp();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

export async function sendDeliveryEmail(to: string, productName: string, items: DeliveryItem[]): Promise<boolean> {
  const smtp = loadSmtp();
  const transporter = transporterFromConfig();

  const itemsHtml = items.map(i =>
    `<tr><td style="padding:8px 12px;font-size:12px;color:#666;font-weight:600;border-bottom:1px solid #222">${i.label}</td><td style="padding:8px 12px;font-size:14px;color:#fff;font-family:monospace;word-break:break-all">${i.value}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;border:1px solid #222">
<tr><td style="padding:32px">
<div style="text-align:center;margin-bottom:24px"><div style="font-size:20px;font-weight:700;color:#8b5cf6">Pulse</div><div style="font-size:13px;color:#555;margin-top:4px">Payment confirmed</div></div>
<div style="text-align:center;margin-bottom:24px">
<div style="width:48px;height:48px;background:#166534;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#22c55e">&#10003;</div>
<div style="font-size:18px;color:#fff;margin-top:12px;font-weight:700">Your purchase is ready</div>
<div style="font-size:13px;color:#888;margin-top:6px">${productName || 'Digital Product'}</div>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;border:1px solid #2a2a2a"><tr><td style="padding:18px 20px"><div style="font-size:11px;color:#8b5cf6;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;margin-bottom:14px">Your delivery</div><table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr></table>
<div style="text-align:center;font-size:11px;color:#333;margin-top:24px">Powered by Pulse</div>
</td></tr></table></td></tr></table></body></html>`;

  try {
    const resp = await transporter.sendMail({
      from: smtp.from,
      to: to,
      cc: smtp.from,
      subject: `Your purchase from Pulse - ${productName || 'Digital Product'}`,
      html: html,
    });

    logger.info('Delivery email sent', { to: to.substring(0, 3) + '***', messageId: resp.messageId });
    return true;
  } catch (err: any) {
    logger.error('SMTP email error', { error: err.message });
    return false;
  }
}

export function setSmtpCredentials(config: smtpConfig): void {
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(config, null, 2));
}

export function getSmtpCredentials(): smtpConfig {
  return loadSmtp();
}
