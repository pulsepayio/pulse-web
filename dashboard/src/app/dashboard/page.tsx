'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Payment, Customer, BankAccount, Balance, Payout } from '@/lib/api';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    succeeded: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    canceled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}

// ── Sidebar ───────────────────────────────────────────────────

function Sidebar({ active, onNavigate }: { active: string; onNavigate: (tab: string) => void }) {
  const router = useRouter();
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'payments', label: 'Payments', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'customers', label: 'Customers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'bank_accounts', label: 'Bank Accounts', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { id: 'payouts', label: 'Payouts', icon: 'M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3' },
    { id: 'webhooks', label: 'Webhooks', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-800 bg-[#0d0d0d]">
      <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pulse-500 to-indigo-600">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-lg font-bold">Pulse</span>
      </div>

      <nav className="mt-4 space-y-1 px-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-pulse-500/10 text-pulse-400'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="absolute bottom-4 left-3 right-3">
        <button
          onClick={() => {
            localStorage.clear();
            router.push('/');
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-800/50 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Dashboard ─────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiKey = localStorage.getItem('pulse_api_key');
    if (!apiKey) {
      router.push('/auth');
      return;
    }
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bal, pay, cust, banks, po] = await Promise.all([
        api<any>('/v1/balance').catch(() => ({ available: 0, pending: 0 })),
        api<any>('/v1/payments?limit=20').catch(() => ({ data: [] })),
        api<any>('/v1/customers?limit=20').catch(() => ({ data: [] })),
        api<any>('/v1/bank_accounts').catch(() => ({ data: [] })),
        api<any>('/v1/payouts?limit=20').catch(() => ({ data: [] })),
      ]);
      setBalance(bal);
      setPayments(pay.data || []);
      setCustomers(cust.data || []);
      setBankAccounts(banks.data || []);
      setPayouts(po.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar active={activeTab} onNavigate={setActiveTab} />

      <main className="ml-64 flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold capitalize">{activeTab.replace('_', ' ')}</h1>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {activeTab === 'overview' && (
          <OverviewTab balance={balance} payments={payments} customers={customers} bankAccounts={bankAccounts} />
        )}
        {activeTab === 'payments' && <PaymentsTab payments={payments} />}
        {activeTab === 'customers' && <CustomersTab customers={customers} />}
        {activeTab === 'bank_accounts' && <BankAccountsTab accounts={bankAccounts} />}
        {activeTab === 'payouts' && <PayoutsTab payouts={payouts} />}
        {activeTab === 'webhooks' && <WebhooksTab />}
      </main>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────

function OverviewTab({ balance, payments, customers, bankAccounts }: any) {
  const totalPayments = payments.length;
  const succeededPayments = payments.filter((p: Payment) => p.status === 'succeeded');
  const totalVolume = succeededPayments.reduce((sum: number, p: Payment) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Available Balance" value={formatCents(balance?.available || 0)} color="green" />
        <StatCard label="Pending" value={formatCents(balance?.pending || 0)} color="yellow" />
        <StatCard label="Total Payments" value={totalPayments.toString()} color="blue" />
        <StatCard label="Customers" value={customers.length.toString()} color="purple" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="glass rounded-xl p-6">
          <h3 className="mb-4 text-lg font-semibold">Recent Payments</h3>
          <div className="space-y-3">
            {payments.slice(0, 5).map((p: Payment) => (
              <div key={p.id} className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <p className="font-medium">{p.description || p.id}</p>
                  <p className="text-sm text-gray-500">{formatDate(p.created)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCents(p.amount)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="py-8 text-center text-gray-500">No payments yet</p>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <h3 className="mb-4 text-lg font-semibold">Connected Banks</h3>
          <div className="space-y-3">
            {bankAccounts.map((b: BankAccount) => (
              <div key={b.id} className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">{b.institution || 'Bank'}</p>
                    <p className="text-sm text-gray-500">****{b.last4}</p>
                  </div>
                </div>
                <StatusBadge status={b.verified ? 'active' : 'pending'} />
              </div>
            ))}
            {bankAccounts.length === 0 && (
              <p className="py-8 text-center text-gray-500">No bank accounts connected</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'from-green-500/10 to-green-500/5 border-green-500/20',
    yellow: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-b p-5 ${colors[color]}`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────

function PaymentsTab({ payments }: { payments: Payment[] }) {
  return (
    <div className="glass rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-6 py-4 font-medium text-gray-400">ID</th>
              <th className="px-6 py-4 font-medium text-gray-400">Amount</th>
              <th className="px-6 py-4 font-medium text-gray-400">Status</th>
              <th className="px-6 py-4 font-medium text-gray-400">Type</th>
              <th className="px-6 py-4 font-medium text-gray-400">Description</th>
              <th className="px-6 py-4 font-medium text-gray-400">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/20">
                <td className="px-6 py-4 font-mono text-xs text-gray-300">{p.id}</td>
                <td className="px-6 py-4 font-medium">{formatCents(p.amount)}</td>
                <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                <td className="px-6 py-4 text-gray-400">{p.payment_type}</td>
                <td className="px-6 py-4 text-gray-400">{p.description || '—'}</td>
                <td className="px-6 py-4 text-gray-400">{formatDate(p.created)}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No payments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────

function CustomersTab({ customers }: { customers: Customer[] }) {
  return (
    <div className="glass rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-6 py-4 font-medium text-gray-400">ID</th>
              <th className="px-6 py-4 font-medium text-gray-400">Name</th>
              <th className="px-6 py-4 font-medium text-gray-400">Email</th>
              <th className="px-6 py-4 font-medium text-gray-400">Date</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/20">
                <td className="px-6 py-4 font-mono text-xs text-gray-300">{c.id}</td>
                <td className="px-6 py-4">{c.name || '—'}</td>
                <td className="px-6 py-4 text-gray-400">{c.email || '—'}</td>
                <td className="px-6 py-4 text-gray-400">{formatDate(c.created)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No customers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bank Accounts ─────────────────────────────────────────────

function BankAccountsTab({ accounts }: { accounts: BankAccount[] }) {
  return (
    <div className="space-y-4">
      {accounts.map((b) => (
        <div key={b.id} className="glass flex items-center justify-between rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">{b.institution || 'Bank Account'}</h3>
              <p className="text-sm text-gray-400">{b.name} &middot; ****{b.last4}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-gray-400">
              <p>{b.account_type}{b.account_subtype ? ` / ${b.account_subtype}` : ''}</p>
            </div>
            <StatusBadge status={b.verified ? 'active' : 'pending'} />
          </div>
        </div>
      ))}
      {accounts.length === 0 && (
        <div className="glass rounded-xl p-12 text-center text-gray-500">
          No bank accounts connected. Use the API to connect one.
        </div>
      )}
    </div>
  );
}

// ── Payouts ───────────────────────────────────────────────────

function PayoutsTab({ payouts }: { payouts: Payout[] }) {
  return (
    <div className="glass rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-6 py-4 font-medium text-gray-400">ID</th>
              <th className="px-6 py-4 font-medium text-gray-400">Amount</th>
              <th className="px-6 py-4 font-medium text-gray-400">Status</th>
              <th className="px-6 py-4 font-medium text-gray-400">Method</th>
              <th className="px-6 py-4 font-medium text-gray-400">Date</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/20">
                <td className="px-6 py-4 font-mono text-xs text-gray-300">{p.id}</td>
                <td className="px-6 py-4 font-medium">{formatCents(p.amount)}</td>
                <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                <td className="px-6 py-4 text-gray-400">{p.method}</td>
                <td className="px-6 py-4 text-gray-400">{formatDate(p.created)}</td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No payouts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Webhooks ──────────────────────────────────────────────────

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('payment.created,payment.succeeded,payment.failed');

  useEffect(() => {
    api<any>('/v1/webhooks')
      .then((res) => setWebhooks(res.data || []))
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api<any>('/v1/webhooks', {
        method: 'POST',
        body: { url, events: events.split(',').map((e) => e.trim()) },
      });
      setWebhooks([result, ...webhooks]);
      setUrl('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <h3 className="mb-4 text-lg font-semibold">Create Webhook</h3>
        <form onSubmit={handleCreate} className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks"
            required
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 focus:border-pulse-500 focus:outline-none"
          />
          <input
            type="text"
            value={events}
            onChange={(e) => setEvents(e.target.value)}
            placeholder="payment.created, payment.succeeded"
            className="w-80 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 focus:border-pulse-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-pulse-500 to-indigo-600 px-6 py-2.5 font-semibold text-white transition-all hover:opacity-90"
          >
            Create
          </button>
        </form>
      </div>

      <div className="glass rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-6 py-4 font-medium text-gray-400">ID</th>
                <th className="px-6 py-4 font-medium text-gray-400">URL</th>
                <th className="px-6 py-4 font-medium text-gray-400">Events</th>
                <th className="px-6 py-4 font-medium text-gray-400">Status</th>
                <th className="px-6 py-4 font-medium text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} className="border-b border-gray-800/50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-300">{w.id}</td>
                  <td className="px-6 py-4 text-gray-300">{w.url}</td>
                  <td className="px-6 py-4 text-gray-400">{w.events?.join(', ')}</td>
                  <td className="px-6 py-4"><StatusBadge status={w.active ? 'active' : 'failed'} /></td>
                  <td className="px-6 py-4 text-gray-400">{formatDate(w.created)}</td>
                </tr>
              ))}
              {webhooks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No webhooks configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
