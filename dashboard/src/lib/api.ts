const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('pulse_api_key') : null;
  if (apiKey) {
    headers['X-Pulse-Api-Key'] = apiKey;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || 'Request failed');
  }

  return response.json();
}

export interface Customer {
  id: string;
  object: string;
  email: string;
  name: string;
  phone: string | null;
  created: number;
}

export interface Payment {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  customer: string | null;
  fee: number;
  net_amount: number;
  payment_type: string;
  direction: string;
  bank_account?: {
    id: string;
    institution: string;
    name: string;
    last4: string;
    account_type: string;
  };
  created: number;
}

export interface BankAccount {
  id: string;
  object: string;
  institution: string;
  name: string;
  last4: string;
  account_type: string;
  account_subtype: string;
  verified: boolean;
  created: number;
}

export interface Payout {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  created: number;
}

export interface Balance {
  object: string;
  available: number;
  pending: number;
  currency: string;
}

export interface PaginatedList<T> {
  object: string;
  data: T[];
  has_more: boolean;
  total: number;
}
