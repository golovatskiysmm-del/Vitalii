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
      setError('Токен доступа и ID аккаунта обязательны');
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
      setMsg('Instagram-аккаунт успешно подключён!');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подключиться');
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(id: string) {
    if (!confirm('Удалить этот Instagram-аккаунт?')) return;
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
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-gray-400 text-sm mt-1">Настройте аккаунт Instagram и API-ключи</p>
      </div>

      {msg && <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-green-400 text-sm">{msg}</div>}
      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">⚠️ {error}</div>}

      {/* Connected Accounts */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Подключённые Instagram-аккаунты</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Загрузка...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Нет подключённых аккаунтов</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">@{account.username}</span>
                    {account.isActive && <span className="badge badge-approved">Активный</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {account.accountId}</p>
                </div>
                <button onClick={() => removeAccount(account.id)} className="btn-danger text-xs px-3 py-1.5">
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect New Account */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Подключить Instagram-аккаунт</h2>

        <div className="space-y-4">
          <div>
            <label className="label">ID бизнес-аккаунта Instagram</label>
            <input
              className="input"
              placeholder="например, 17841400123456789"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Долгосрочный токен доступа</label>
            <input
              className="input"
              type="password"
              placeholder="EAABm..."
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Имя пользователя (необязательно, будет проверено)</label>
            <input
              className="input"
              placeholder="@yourname"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <button className="btn-primary" onClick={connectAccount} disabled={saving}>
            {saving ? '⏳ Подключение...' : '🔗 Подключить аккаунт'}
          </button>
        </div>
      </div>

      {/* How to get token */}
      <div className="card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Как получить учётные данные Instagram API</h3>
        <ol className="space-y-2 text-sm text-gray-500 list-decimal list-inside">
          <li>Перейдите на <span className="text-purple-400">developers.facebook.com</span> и создайте приложение</li>
          <li>Добавьте продукт «Instagram Graph API» в приложение</li>
          <li>Подключите Instagram Business/Creator аккаунт через страницу Facebook</li>
          <li>Сгенерируйте долгосрочный токен доступа (60 дней)</li>
          <li>Найдите ID бизнес-аккаунта Instagram в Graph API Explorer</li>
          <li>Необходимые разрешения: <code className="text-purple-400">instagram_basic, instagram_content_publish</code></li>
        </ol>
      </div>

      {/* API Keys reminder */}
      <div className="card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Переменные среды</h3>
        <p className="text-sm text-gray-500 mb-2">Убедитесь, что они указаны в файле <code className="text-purple-400">.env</code>:</p>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex justify-between text-gray-500">
            <span>ANTHROPIC_API_KEY</span>
            <span className={process.env.ANTHROPIC_API_KEY ? 'text-green-400' : 'text-red-400'}>
              Необходим для генерации контента
            </span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>OPENAI_API_KEY</span>
            <span className="text-yellow-500">Необходим для генерации изображений</span>
          </div>
        </div>
      </div>
    </div>
  );
}
