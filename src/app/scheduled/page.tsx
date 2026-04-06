'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Carousel {
  id: string;
  caption: string;
  status: string;
  slides: { imageUrl?: string; heading: string }[];
  scheduledAt?: string;
  postedAt?: string;
}

export default function ScheduledPage() {
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/carousels')
      .then((r) => r.json())
      .then((data) => {
        const filtered = Array.isArray(data)
          ? data.filter((c: Carousel) => c.status === 'scheduled' || c.status === 'posted')
          : [];
        setCarousels(filtered);
      })
      .finally(() => setLoading(false));
  }, []);

  async function processDue() {
    setProcessing(true);
    try {
      const res = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      setMsg(`Обработано ${data.processed} запланированных постов`);
      setTimeout(() => setMsg(''), 3000);
      // Reload
      const r2 = await fetch('/api/carousels');
      const d2 = await r2.json();
      setCarousels(Array.isArray(d2) ? d2.filter((c: Carousel) => c.status === 'scheduled' || c.status === 'posted') : []);
    } finally {
      setProcessing(false);
    }
  }

  const scheduled = carousels.filter((c) => c.status === 'scheduled');
  const posted = carousels.filter((c) => c.status === 'posted');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Запланированные посты</h1>
          <p className="text-gray-400 text-sm mt-1">Управление запланированными Instagram-каруселями</p>
        </div>
        <button className="btn-secondary" onClick={processDue} disabled={processing}>
          {processing ? '⏳ Обработка...' : '🔄 Опубликовать готовые'}
        </button>
      </div>

      {msg && <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-green-400 text-sm">{msg}</div>}

      {/* Scheduled */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">
          Запланировано ({scheduled.length})
        </h2>
        {loading ? (
          <p className="text-gray-500 text-sm text-center py-6">Загрузка...</p>
        ) : scheduled.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">Нет запланированных постов</p>
        ) : (
          <div className="space-y-3">
            {scheduled.map((c) => (
              <CarouselItem key={c.id} carousel={c} />
            ))}
          </div>
        )}
      </div>

      {/* Posted */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">
          История публикаций ({posted.length})
        </h2>
        {posted.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">Пока нет опубликованных каруселей</p>
        ) : (
          <div className="space-y-3">
            {posted.map((c) => (
              <CarouselItem key={c.id} carousel={c} />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Информация о расписании</h3>
        <ul className="space-y-1 text-sm text-gray-500">
          <li>• Запланированные посты обрабатываются при нажатии «Опубликовать готовые»</li>
          <li>• Для автоматической обработки настройте cron-задачу: <code className="text-purple-400">POST /api/schedule</code></li>
          <li>• Пример для Vercel cron: добавьте <code className="text-purple-400">vercel.json</code> с конфигурацией cron</li>
        </ul>
      </div>
    </div>
  );
}

function CarouselItem({ carousel }: { carousel: Carousel }) {
  const isOverdue = carousel.status === 'scheduled' && carousel.scheduledAt && new Date(carousel.scheduledAt) < new Date();

  return (
    <Link
      href={`/carousel/${carousel.id}`}
      className="flex items-center gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-800 hover:border-gray-700 transition-all group"
    >
      <div className="w-14 h-14 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
        {carousel.slides[0]?.imageUrl ? (
          <Image src={carousel.slides[0].imageUrl} alt="slide" width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">📷</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 truncate">{carousel.caption.slice(0, 80)}</p>
        <p className={`text-xs mt-1 ${isOverdue ? 'text-orange-400' : 'text-gray-500'}`}>
          {carousel.status === 'scheduled'
            ? `${isOverdue ? '⚠️ Просрочено: ' : '🕐 '}${new Date(carousel.scheduledAt!).toLocaleString()}`
            : `✅ Опубликовано: ${new Date(carousel.postedAt!).toLocaleString()}`}
        </p>
      </div>
      <span className={`badge badge-${carousel.status}`}>
        {carousel.status === 'scheduled' ? 'Запланировано' : 'Опубликовано'}
      </span>
    </Link>
  );
}
