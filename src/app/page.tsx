'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';

interface Carousel {
  id: string;
  caption: string;
  status: string;
  slides: { imageUrl?: string; heading: string }[];
  createdAt: string;
  scheduledAt?: string;
  postedAt?: string;
  analyzedPost?: { instagramUrl: string; authorUsername?: string };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'badge-draft',
    approved: 'badge-approved',
    scheduled: 'badge-scheduled',
    posted: 'badge-posted',
    failed: 'badge-failed',
    generating: 'badge-generating',
    posting: 'badge-generating',
  };
  const labels: Record<string, string> = {
    draft: 'Черновик',
    approved: 'Одобрено',
    scheduled: 'Запланировано',
    posted: 'Опубликовано',
    failed: 'Ошибка',
    generating: 'Генерация...',
    posting: 'Публикация...',
  };
  return <span className={map[status] || 'badge-draft'}>{labels[status] || status}</span>;
}

export default function Dashboard() {
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/carousels')
      .then((r) => r.json())
      .then((data) => setCarousels(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: carousels.length,
    draft: carousels.filter((c) => c.status === 'draft').length,
    scheduled: carousels.filter((c) => c.status === 'scheduled').length,
    posted: carousels.filter((c) => c.status === 'posted').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Главная</h1>
          <p className="text-gray-400 text-sm mt-1">Управление контентом Instagram-каруселей</p>
        </div>
        <Link href="/analyze" className="btn-primary">
          ✨ Новый карусель
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Всего', value: stats.total, color: 'text-white' },
          { label: 'Черновики', value: stats.draft, color: 'text-gray-400' },
          { label: 'Запланировано', value: stats.scheduled, color: 'text-blue-400' },
          { label: 'Опубликовано', value: stats.posted, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={clsx('text-3xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Carousels List */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Последние карусели</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : carousels.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📸</div>
            <p className="text-gray-400 mb-4">Нет каруселей</p>
            <Link href="/analyze" className="btn-primary">
              Создать первый карусель
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {carousels.map((carousel) => (
              <Link
                key={carousel.id}
                href={`/carousel/${carousel.id}`}
                className="flex items-center gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-800 hover:border-gray-700 hover:bg-gray-800 transition-all group"
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                  {carousel.slides[0]?.imageUrl ? (
                    <Image
                      src={carousel.slides[0].imageUrl}
                      alt="slide"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">📷</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={carousel.status} />
                    <span className="text-xs text-gray-600">{carousel.slides.length} слайдов</span>
                    {carousel.analyzedPost?.authorUsername && (
                      <span className="text-xs text-gray-600">из @{carousel.analyzedPost.authorUsername}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 truncate">{carousel.caption.slice(0, 100)}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {carousel.scheduledAt
                      ? `Запланировано: ${new Date(carousel.scheduledAt).toLocaleString()}`
                      : carousel.postedAt
                      ? `Опубликовано: ${new Date(carousel.postedAt).toLocaleString()}`
                      : `Создано: ${new Date(carousel.createdAt).toLocaleDateString()}`}
                  </p>
                </div>

                <div className="text-gray-600 group-hover:text-gray-400 transition-colors">›</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
