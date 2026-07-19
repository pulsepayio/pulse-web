import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="mb-8">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pulse-500 to-indigo-600">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="mb-4 text-6xl font-bold tracking-tight">
            <span className="gradient-text">Pulse</span>
          </h1>
          <p className="text-xl text-gray-400">
            Real-time bank payment infrastructure for modern businesses.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-3 gap-4 text-left">
          <div className="glass rounded-xl p-4">
            <div className="mb-2 text-pulse-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="font-semibold">ACH Payments</h3>
            <p className="text-sm text-gray-500">Send and receive bank-to-bank transfers</p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="mb-2 text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold">Bank Verified</h3>
            <p className="text-sm text-gray-500">Plaid-powered bank account verification</p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="mb-2 text-purple-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="font-semibold">Webhooks</h3>
            <p className="text-sm text-gray-500">Real-time payment event notifications</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/auth"
            className="rounded-lg bg-gradient-to-r from-pulse-500 to-indigo-600 px-8 py-3 font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg hover:shadow-pulse-500/25"
          >
            Get Started
          </Link>
          <a
            href="/docs"
            className="glass rounded-lg px-8 py-3 font-semibold text-gray-300 transition-all hover:text-white"
          >
            API Docs
          </a>
        </div>

        <div className="mt-16 text-sm text-gray-600">
          <code className="glass rounded-md px-3 py-1">
            curl -X POST https://api.pulse.sh/v1/payments -d '{"{"} amount: 1000 {"}"}'
          </code>
        </div>
      </div>
    </main>
  );
}
