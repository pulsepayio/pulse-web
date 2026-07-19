# Pulse SDK

A JavaScript SDK for the Pulse payment API.

## Installation

```bash
npm install @pulse/sdk
# or
yarn add @pulse/sdk
```

## Quick Start

```js
const Pulse = require('@pulse/sdk');

const pulse = new Pulse({
  apiKey: 'pk_test_your_api_key',
});

// Create a customer
const customer = await pulse.customers.create({
  email: 'jenny@example.com',
  name: 'Jenny Rosen',
});

// Connect a bank account (requires Plaid Link on frontend)
const bankAccounts = await pulse.bankAccounts.connect({
  public_token: 'public-sandbox-xxx',
  customer: customer.id,
});

// Create a payment
const payment = await pulse.payments.create({
  amount: 1000, // $10.00
  customer: customer.id,
  payment_method: bankAccounts.data[0].id,
  description: 'Order #1234',
});

console.log(payment);
// {
//   id: 'pay_cuid123',
//   amount: 1000,
//   status: 'processing',
//   ...
// }
```

## Resources

### Customers

```js
// Create
await pulse.customers.create({ email, name, phone, address, metadata });

// Retrieve
await pulse.customers.retrieve('cus_xxx');

// List
await pulse.customers.list({ limit: 10 });

// Update
await pulse.customers.update('cus_xxx', { name: 'New Name' });

// Delete
await pulse.customers.del('cus_xxx');
```

### Bank Accounts

```js
// Get a Plaid Link token
const { link_token } = await pulse.bankAccounts.createLinkToken();

// Connect bank (exchange public token)
const accounts = await pulse.bankAccounts.connect({
  public_token: 'public-sandbox-xxx',
  customer: 'cus_xxx',
});

// List
await pulse.bankAccounts.list();

// Retrieve
await pulse.bankAccounts.retrieve('ba_xxx');

// Delete
await pulse.bankAccounts.del('ba_xxx');
```

### Payments

```js
// Create
await pulse.payments.create({
  amount: 1000,        // Amount in cents
  customer: 'cus_xxx',
  payment_method: 'pm_xxx',
  description: 'Order #1234',
  metadata: { order_id: '1234' },
});

// Retrieve
await pulse.payments.retrieve('pay_xxx');

// List
await pulse.payments.list({ status: 'succeeded', limit: 20 });

// Cancel (before settlement)
await pulse.payments.cancel('pay_xxx');
```

### Payouts

```js
// Create payout to bank account
await pulse.payouts.create({
  amount: 5000,
  bank_account: 'ba_xxx',
  method: 'standard', // or 'instant'
  description: 'Monthly payout',
});
```

### Balance

```js
const balance = await pulse.balance.retrieve();
// { available: 10000, pending: 2500, currency: 'usd' }
```

### Webhooks

```js
// Create
const webhook = await pulse.webhooks.create({
  url: 'https://your-server.com/webhooks',
  events: ['payment.created', 'payment.succeeded', 'payment.failed'],
});

// Verify webhook signature in your server
const isValid = Pulse.verifySignature(
  req.body,
  req.headers['pulse-signature'],
  webhook.secret
);
```

## Error Handling

```js
try {
  await pulse.payments.create({ amount: -100 });
} catch (error) {
  console.log(error.statusCode); // 400
  console.log(error.type);       // invalid_request_error
  console.log(error.code);       // parameter_invalid
  console.log(error.message);    // Amount must be positive
}
```
