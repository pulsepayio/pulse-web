const https = require('https');
const http = require('http');
const crypto = require('crypto');

class Pulse {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.PULSE_API_KEY;
    this.baseUrl = options.baseUrl || 'https://api.pulse.sh';
    this.timeout = options.timeout || 30000;

    if (!this.apiKey) {
      throw new Error('Pulse API key is required');
    }
  }

  async _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Pulse-Api-Key': this.apiKey,
          'Pulse-Version': '2024-10-01',
        },
        timeout: this.timeout,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const error = new Error(parsed.error?.message || 'Request failed');
              error.statusCode = res.statusCode;
              error.type = parsed.error?.type;
              error.code = parsed.error?.code;
              reject(error);
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // ── Customers ─────────────────────────────────────────────

  customers = {
    create: (params) => this._request('POST', '/v1/customers', params),
    retrieve: (id) => this._request('GET', `/v1/customers/${id}`),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this._request('GET', `/v1/customers${qs ? '?' + qs : ''}`);
    },
    update: (id, params) => this._request('POST', `/v1/customers/${id}`, params),
    del: (id) => this._request('DELETE', `/v1/customers/${id}`),
  };

  // ── Payment Methods ───────────────────────────────────────

  paymentMethods = {
    create: (params) => this._request('POST', '/v1/payment_methods', params),
    retrieve: (id) => this._request('GET', `/v1/payment_methods/${id}`),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this._request('GET', `/v1/payment_methods${qs ? '?' + qs : ''}`);
    },
    detach: (id) => this._request('DELETE', `/v1/payment_methods/${id}`),
  };

  // ── Bank Accounts ─────────────────────────────────────────

  bankAccounts = {
    createLinkToken: () => this._request('POST', '/v1/bank_accounts/link_token'),
    connect: (params) => this._request('POST', '/v1/bank_accounts/connect', params),
    retrieve: (id) => this._request('GET', `/v1/bank_accounts/${id}`),
    list: () => this._request('GET', '/v1/bank_accounts'),
    del: (id) => this._request('DELETE', `/v1/bank_accounts/${id}`),
  };

  // ── Payments ──────────────────────────────────────────────

  payments = {
    create: (params) => this._request('POST', '/v1/payments', params),
    retrieve: (id) => this._request('GET', `/v1/payments/${id}`),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this._request('GET', `/v1/payments${qs ? '?' + qs : ''}`);
    },
    cancel: (id) => this._request('POST', `/v1/payments/${id}/cancel`),
  };

  // ── Payouts ───────────────────────────────────────────────

  payouts = {
    create: (params) => this._request('POST', '/v1/payouts', params),
    retrieve: (id) => this._request('GET', `/v1/payouts/${id}`),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this._request('GET', `/v1/payouts${qs ? '?' + qs : ''}`);
    },
  };

  // ── Balance ───────────────────────────────────────────────

  balance = {
    retrieve: () => this._request('GET', '/v1/balance'),
  };

  // ── Webhooks ──────────────────────────────────────────────

  webhooks = {
    create: (params) => this._request('POST', '/v1/webhooks', params),
    retrieve: (id) => this._request('GET', `/v1/webhooks/${id}`),
    list: () => this._request('GET', '/v1/webhooks'),
    del: (id) => this._request('DELETE', `/v1/webhooks/${id}`),
  };

  // ── Events ────────────────────────────────────────────────

  events = {
    retrieve: (id) => this._request('GET', `/v1/events/${id}`),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this._request('GET', `/v1/events${qs ? '?' + qs : ''}`);
    },
  };

  // ── Signature verification ────────────────────────────────

  static verifySignature(payload, signature, secret) {
    const [timestampPart, signaturePart] = signature.split(',');
    const timestamp = timestampPart?.replace('t=', '');
    const v1 = signaturePart?.replace('v1=', '');

    if (!timestamp || !v1) return false;

    const tolerance = 300;
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > tolerance) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature));
  }
}

module.exports = Pulse;
module.exports.default = Pulse;
