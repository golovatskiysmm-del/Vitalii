'use client';

import { useEffect, useState } from 'react';

interface InstagramAccount {
  id: string;
  username: string;
  accountId: string;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    accessToken: '',
    accountId: '',
    username: '',
  });

  useEffect(() => {
    fetch('/api/instagram-auth')
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function connectAccount() {
    if (!form.accessToken || !form.accountId) {
      setError('Access token and account ID are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/instagram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccounts((prev) => [data, ...prev.map((a) => ({ ...a, isActive: false }))]);
      setForm({ accessToken: '', accountId: '', username: '' });
      setMsg('Instagram account connected successfully!');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(id: string) {
    if (!confirm('Remove this Instagram account?')) return;
    await fetch('/api/instagram-auth', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Configure your Instagram account and API keys</p>
      </div>

      {msg && <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-green-400 text-sm">{msg}</div>}
      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">⚠️ {error}</div>}

      {/* Connected Accounts */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Connected Instagram Accounts</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No accounts connected</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">@{account.username}</span>
                    {account.isActive && <span className="badge badge-approved">Active</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {account.accountId}</p>
                </div>
                <button onClick={() => removeAccount(account.id)} className="btn-danger text-xs px-3 py-1.5">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect New Account */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Connect Instagram Account</h2>

        <div className="space-y-4">
          <div>
            <label className="label">Instagram Business Account ID</label>
            <input
              className="input"
              placeholder="e.g. 17841400123456789"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Long-lived Access Token</label>
            <input
              className="input"
              type="password"
              placeholder="EAABm..."
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Username (optional, will be verified)</label>
            <input
              className="input"
              placeholder="@yourusername"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <button className="btn-primary" onClick={connectAccount} disabled={saving}>
            {saving ? '⏳ Connecting...' : '🔗 Connect Account'}
          </button>
        </div>
      </div>

      {/* How to get token */}
      <div className="card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">How to get your Instagram API credentials</h3>
        <ol className="space-y-2 text-sm text-gray-500 list-decimal list-inside">
          <li>Go to <span className="text-purple-400">developers.facebook.com</span> and create an app</li>
          <li>Add "Instagram Graph API" product to your app</li>
          <li>Connect your Instagram Business/Creator account via Facebook Page</li>
          <li>Generate a long-lived access token (60 days)</li>
          <li>Find your Instagram Business Account ID in the Graph API Explorer</li>
          <li>Required permissions: <code className="text-purple-400">instagram_basic, instagram_content_publish</code></li>
        </ol>
      </div>

      {/* API Keys reminder */}
      <div className="card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Environment Variables</h3>
        <p className="text-sm text-gray-500 mb-2">Make sure these are set in your <code className="text-purple-400">.env</code> file:</p>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex justify-between text-gray-500">
            <span>ANTHROPIC_API_KEY</span>
            <span className={process.env.ANTHROPIC_API_KEY ? 'text-green-400' : 'text-red-400'}>
              Required for content generation
            </span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>OPENAI_API_KEY</span>
            <span className="text-yellow-500">Required for image generation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
