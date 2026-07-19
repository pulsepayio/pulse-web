'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api<{ token: string; api_key: string; id: string }>(
        `/v1/auth/${mode}`,
        {
          method: 'POST',
          body: { email, password, business_name: businessName || undefined },
        }
      );

      localStorage.setItem('pulse_token', result.token);
      localStorage.setItem('pulse_api_key', result.api_key);
      localStorage.setItem('pulse_user_id', result.id);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="glass w-full max-w-md rounded-2xl p-8 glow">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pulse-500 to-indigo-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">
            {mode === 'register' ? 'Create your Pulse account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {mode === 'register'
              ? 'Start accepting bank payments in minutes'
              : 'Sign in to your dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-pulse-500 focus:outline-none"
                placeholder="Acme Inc."
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-pulse-500 focus:outline-none"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-pulse-500 focus:outline-none"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-pulse-500 to-indigo-600 py-3 font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {mode === 'register' ? (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-pulse-400 hover:underline">
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <button onClick={() => setMode('register')} className="text-pulse-400 hover:underline">
                Create one
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
