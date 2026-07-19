# Pulse

Real-time bank payment infrastructure. A Stripe-like platform for ACH payments.

## Architecture

```
pulse/
├── src/                    # API server (Express + TypeScript)
│   ├── api/routes/         # REST endpoints
│   ├── api/middleware/      # Auth, error handling
│   ├── services/           # Business logic
│   │   ├── plaid/          # Plaid bank integrations
│   │   ├── payments/       # Payment processing
│   │   └── webhooks/       # Event delivery
│   ├── types/              # TypeScript types
│   └── utils/              # Config, crypto, logging
├── prisma/                 # Database schema
├── dashboard/              # Next.js admin dashboard
├── sdk/                    # JavaScript client SDK
└── docs/                   # API documentation
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your Plaid + Stripe keys

# 3. Set up database
npx prisma db push
npx prisma generate

# 4. Start the API server
npm run dev

# 5. Start the dashboard (in another terminal)
cd dashboard && npm install && npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid API secret |
| `STRIPE_SECRET_KEY` | Stripe secret key (for Treasury) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `ENCRYPTION_KEY` | 32-char key for encrypting bank account numbers |

## API Usage

```bash
# Register
curl -X POST http://localhost:3001/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@co.com","password":"securepass123"}'

# Create customer
curl -X POST http://localhost:3001/v1/customers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"jenny@example.com","name":"Jenny Rosen"}'

# Connect bank (after Plaid Link)
curl -X POST http://localhost:3001/v1/bank_accounts/connect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"public_token":"public-sandbox-xxx"}'

# Create payment
curl -X POST http://localhost:3001/v1/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"customer":"cus_xxx","payment_method":"pm_xxx"}'

# Check balance
curl http://localhost:3001/v1/balance \
  -H "Authorization: Bearer <token>"
```

## How Real Payments Work

1. **Link Bank Account** - User connects their bank via Plaid Link (sandbox/plaid.com/link)
2. **Create Payment** - API initiates an ACH debit transfer via Plaid
3. **Processing** - Plaid submits to the ACH network
4. **Settlement** - Funds arrive in 2-3 business days (ACH standard)
5. **Payout** - Withdraw available balance to your bank account

## Tech Stack

- **API**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Banking**: Plaid API (ACH transfers)
- **Dashboard**: Next.js + React + Tailwind CSS
- **SDK**: Vanilla JavaScript
