# Pulse API Documentation

Base URL: `https://api.pulse.sh`

## Authentication

All requests require authentication via API key:

```bash
curl -H "Authorization: Bearer pk_test_your_key" https://api.pulse.sh/v1/payments
```

Or using the custom header:

```bash
curl -H "X-Pulse-Api-Key: pk_test_your_key" https://api.pulse.sh/v1/payments
```

---

## Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/register` | Create a new account |
| POST | `/v1/auth/login` | Sign in to existing account |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/customers` | Create a customer |
| GET | `/v1/customers/:id` | Retrieve a customer |
| GET | `/v1/customers` | List all customers |
| POST | `/v1/customers/:id` | Update a customer |
| DELETE | `/v1/customers/:id` | Delete a customer |

### Bank Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/bank_accounts/link_token` | Get Plaid Link token |
| POST | `/v1/bank_accounts/connect` | Connect bank account |
| GET | `/v1/bank_accounts` | List bank accounts |
| GET | `/v1/bank_accounts/:id` | Retrieve a bank account |
| DELETE | `/v1/bank_accounts/:id` | Disconnect bank account |

### Payment Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/payment_methods` | Create payment method |
| GET | `/v1/payment_methods` | List payment methods |
| GET | `/v1/payment_methods/:id` | Retrieve payment method |
| DELETE | `/v1/payment_methods/:id` | Detach payment method |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/payments` | Create a payment |
| GET | `/v1/payments/:id` | Retrieve a payment |
| GET | `/v1/payments` | List payments |
| POST | `/v1/payments/:id/cancel` | Cancel a payment |

### Payouts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/payouts` | Create a payout |
| GET | `/v1/payouts/:id` | Retrieve a payout |
| GET | `/v1/payouts` | List payouts |

### Balance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/balance` | Retrieve balance |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/webhooks` | Create a webhook |
| GET | `/v1/webhooks` | List webhooks |
| GET | `/v1/webhooks/:id` | Retrieve a webhook |
| DELETE | `/v1/webhooks/:id` | Delete a webhook |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/events` | List events |
| GET | `/v1/events/:id` | Retrieve an event |

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `payment.created` | Payment initiated |
| `payment.processing` | Payment processing started |
| `payment.succeeded` | Payment settled |
| `payment.failed` | Payment failed |
| `payment.canceled` | Payment canceled |
| `customer.created` | Customer created |
| `customer.updated` | Customer updated |
| `customer.deleted` | Customer deleted |
| `bank_account.created` | Bank account connected |
| `bank_account.verified` | Bank account verified |
| `payout.created` | Payout initiated |
| `payout.paid` | Payout completed |

## Webhook Signature Verification

```js
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const [timestampPart, signaturePart] = signature.split(',');
  const timestamp = timestampPart.replace('t=', '');
  const v1 = signaturePart.replace('v1=', '');

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
```

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Authentication error |
| 404 | Resource not found |
| 409 | Conflict (idempotency mismatch) |
| 429 | Rate limit exceeded |
| 500 | Server error |

## ACH Payment Lifecycle

```
pending → processing → succeeded
                    → failed (with return code)
```

| Status | Description |
|--------|-------------|
| `pending` | Payment created but not confirmed |
| `processing` | ACH transfer initiated |
| `succeeded` | Funds settled (2-3 business days) |
| `failed` | ACH return received |
| `canceled` | Payment canceled before settlement |

## Common ACH Return Codes

| Code | Description |
|------|-------------|
| R01 | Insufficient funds |
| R02 | Account closed |
| R03 | No account / unable to locate |
| R04 | Invalid account number |
| R07 | Authorization revoked |
| R08 | Payment stopped |
| R10 | Customer advises unauthorized |
| R29 | Corporate customer advises not authorized |
