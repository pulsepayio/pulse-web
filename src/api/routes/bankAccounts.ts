import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';
import * as stripeBankService from '../../services/stripe-bank';
import * as webhookService from '../../services/webhooks';
import { generateId } from '../../utils/ids';

const router = Router();
const prisma = new PrismaClient();

function ext(pulseId: string, prefix: string): string {
  return pulseId.startsWith(`${prefix}_`) ? pulseId : `${prefix}_${pulseId}`;
}

// POST /v1/bank_accounts/session - create a Financial Connections session for bank linking
router.post('/session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await stripeBankService.createFinancialConnectionsSession(req.userId!);
    res.json({
      object: 'session',
      id: result.sessionId,
      client_secret: result.clientSecret,
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: 'Failed to create session' } });
  }
});

// POST /v1/bank_accounts/connect - connect a Financial Connections account
router.post('/connect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { account_id, customer } = req.body;
    if (!account_id) {
      throw new ValidationError('account_id is required');
    }

    // Retrieve the account from Stripe to get details
    const account = await stripeBankService.retrieveFinancialConnectionsAccount(
      '',
      account_id
    );

    // Resolve customer
    let customerId: string | undefined;
    if (customer) {
      const cust = await prisma.customer.findFirst({
        where: { pulseId: customer, userId: req.userId },
      });
      if (cust) customerId = cust.id;
    }

    // Create a US bank account payment method from the Financial Connections account
    const paymentMethod = await stripeBankService.createUsBankAccountPaymentMethod(
      '',
      account_id
    );

    // Extract account details from the payment method
    const usBankAccount = paymentMethod.us_bank_account as any;
    const routingNumber = usBankAccount?.routing_number || undefined;
    const last4 = usBankAccount?.last4 || undefined;

    const extId = generateId('ba');
    const bankAccount = await prisma.bankAccount.create({
      data: {
        userId: req.userId!,
        pulseId: extId,
        customerId,
        stripeFinancialAccountId: account_id,
        stripePaymentMethodId: paymentMethod.id,
        institutionName: (account as any).institution?.name || undefined,
        accountName: usBankAccount?.bank_name || undefined,
        accountType: 'depository',
        accountSubtype: usBankAccount?.account_holder_type || undefined,
        mask: last4,
        routingNumber,
        verified: !!routingNumber,
      },
    });

    await webhookService.createEvent(
      req.userId!,
      'bank_account.created',
      'bank_account',
      extId,
      { id: extId, verified: bankAccount.verified }
    );

    res.status(201).json({
      id: extId,
      object: 'bank_account',
      institution: bankAccount.institutionName,
      name: bankAccount.accountName,
      last4: bankAccount.mask,
      account_type: bankAccount.accountType,
      account_subtype: bankAccount.accountSubtype,
      verified: bankAccount.verified,
      created: Math.floor(bankAccount.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Failed to connect bank account' } });
  }
});

// GET /v1/bank_accounts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      object: 'list',
      data: accounts.map((a) => ({
        id: ext(a.pulseId, 'ba'),
        object: 'bank_account',
        institution: a.institutionName,
        name: a.accountName,
        last4: a.mask,
        account_type: a.accountType,
        account_subtype: a.accountSubtype,
        verified: a.verified,
        customer: a.customerId,
        created: Math.floor(a.createdAt.getTime() / 1000),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to list bank accounts' } });
  }
});

// GET /v1/bank_accounts/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const account = await prisma.bankAccount.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!account) throw new NotFoundError('bank_account', req.params.id);

    res.json({
      id: ext(account.pulseId, 'ba'),
      object: 'bank_account',
      institution: account.institutionName,
      name: account.accountName,
      last4: account.mask,
      routing_last4: account.routingNumber?.slice(-4),
      account_type: account.accountType,
      account_subtype: account.accountSubtype,
      verified: account.verified,
      customer: account.customerId,
      created: Math.floor(account.createdAt.getTime() / 1000),
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to retrieve bank account' } });
  }
});

// DELETE /v1/bank_accounts/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const account = await prisma.bankAccount.findFirst({
      where: { pulseId: req.params.id, userId: req.userId },
    });
    if (!account) throw new NotFoundError('bank_account', req.params.id);

    // Detach payment method from Stripe if it exists
    if (account.stripePaymentMethodId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.paymentMethods.detach(account.stripePaymentMethodId);
      } catch {
        // Continue even if Stripe detach fails
      }
    }

    await prisma.bankAccount.delete({ where: { id: account.id } });

    res.json({
      id: ext(account.pulseId, 'ba'),
      object: 'bank_account',
      deleted: true,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Failed to delete bank account' } });
  }
});

export default router;
