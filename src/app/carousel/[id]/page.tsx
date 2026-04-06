'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';

interface Slide {
  index: number;
  heading: string;
  bodyText: string;
  imagePrompt: string;
  imageUrl?: string;
}

interface Carousel {
  id: string;
  caption: string;
  status: string;
  slides: Slide[];
  scheduledAt?: string;
  postedAt?: string;
  instagramPostId?: string;
  analyzedPost?: { instagramUrl: string; authorUsername?: string };
}

export default function CarouselPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [caption, setCaption] = useState('');
  const [editingCaption, setEditingCaption] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/carousels/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCarousel(data);
        setCaption(data.caption);
        if (data.scheduledAt) {
          const d = new Date(data.scheduledAt);
          setScheduledAt(d.toISOString().slice(0, 16));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function approve() {
    setError('');
    const res = await fetch(`/api/carousels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', caption }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setCarousel(data);
    setMsg('Карусель одобрен!');
    setTimeout(() => setMsg(''), 3000);
  }

  async function postNow() {
    if (!confirm('Опубликовать этот карусель в Instagram сейчас?')) return;
    setPosting(true);
    setError('');
    try {
      const res = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carouselId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCarousel((c) => c ? { ...c, status: 'posted', postedAt: new Date().toISOString(), instagramPostId: data.mediaId } : c);
      setMsg('Опубликовано в Instagram!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  async function schedulePost() {
    if (!scheduledAt) { setError('Пожалуйста, выберите дату и время'); return; }
    setPosting(true);
    setError('');
    try {
      const res = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carouselId: id, scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCarousel((c) => c ? { ...c, status: 'scheduled', scheduledAt } : c);
      setMsg(`Запланировано на ${new Date(scheduledAt).toLocaleString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setPosting(false);
    }
  }

  async function saveCaption() {
    const res = await fetch(`/api/carousels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    });
    if (res.ok) { setEditingCaption(false); setMsg('Подпись сохранена!'); setTimeout(() => setMsg(''), 2000); }
  }

  async function deleteCarousel() {
    if (!confirm('Удалить этот карусель?')) return;
    await fetch(`/api/carousels/${id}`, { method: 'DELETE' });
    router.push('/');
  }

  if (loading) return <div className="text-center py-20 text-gray-500">Загрузка...</div>;
  if (!carousel) return <div className="text-center py-20 text-red-400">Карусель не найден</div>;

  const isPosted = carousel.status === 'posted';
  const canPost = carousel.status === 'approved';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-300 text-sm">← Back</button>
          </div>
          <h1 className="text-xl font-bold text-white">Carousel Preview</h1>
          {carousel.analyzedPost?.authorUsername && (
            <p className="text-sm text-gray-500">Based on @{carousel.analyzedPost.authorUsername}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge badge-${carousel.status === 'posting' ? 'generating' : carousel.status}`}>
            {carousel.status.charAt(0).toUpperCase() + carousel.status.slice(1)}
          </span>
          <button onClick={deleteCarousel} className="btn-danger text-xs px-3 py-1.5">Delete</button>
        </div>
      </div>

      {/* Messages */}
      {msg && <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-green-400 text-sm">{msg}</div>}
      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">⚠️ {error}</div>}
      {isPosted && (
        <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3 text-purple-400 text-sm">
          ✅ Posted to Instagram! Media ID: {carousel.instagramPostId}
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Slide preview */}
        <div className="col-span-3 space-y-4">
          {/* Main slide */}
          <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 relative">
            {carousel.slides[activeSlide]?.imageUrl ? (
              <Image
                src={carousel.slides[activeSlide].imageUrl!}
                alt="Slide"
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-5xl mb-4">🖼️</div>
                <p className="text-gray-400 text-xs">Image generation was not enabled</p>
              </div>
            )}

            {/* Overlay text */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
              <p className="text-white font-bold text-lg leading-tight">{carousel.slides[activeSlide]?.heading}</p>
              <p className="text-gray-200 text-sm mt-1 line-clamp-2">{carousel.slides[activeSlide]?.bodyText}</p>
            </div>

            {/* Slide counter */}
            <div className="absolute top-3 right-3 bg-black/60 rounded-full px-2 py-1 text-xs text-white">
              {activeSlide + 1}/{carousel.slides.length}
            </div>
          </div>

          {/* Slide thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {carousel.slides.map((slide, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  i === activeSlide ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                {slide.imageUrl ? (
                  <Image src={slide.imageUrl} alt={`Slide ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 text-xs">{i + 1}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="col-span-2 space-y-4">
          {/* Current slide text */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Slide {activeSlide + 1} Text</h3>
            <p className="text-white font-semibold text-sm mb-1">{carousel.slides[activeSlide]?.heading}</p>
            <p className="text-gray-300 text-sm">{carousel.slides[activeSlide]?.bodyText}</p>
            <details className="mt-2">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-500">Image prompt</summary>
              <p className="text-xs text-gray-600 mt-1">{carousel.slides[activeSlide]?.imagePrompt}</p>
            </details>
          </div>

          {/* Caption */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-400">Caption</h3>
              <button
                onClick={() => editingCaption ? saveCaption() : setEditingCaption(true)}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {editingCaption ? 'Save' : 'Edit'}
              </button>
            </div>
            {editingCaption ? (
              <textarea
                className="input resize-none text-xs"
                rows={6}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            ) : (
              <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                {caption.slice(0, 300)}{caption.length > 300 ? '...' : ''}
              </p>
            )}
          </div>

          {/* Actions */}
          {!isPosted && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-400">Actions</h3>

              {carousel.status === 'draft' && (
                <button className="btn-primary w-full justify-center" onClick={approve}>
                  ✅ Approve Carousel
                </button>
              )}

              {canPost && (
                <>
                  <button
                    className="btn-primary w-full justify-center"
                    onClick={postNow}
                    disabled={posting}
                  >
                    {posting ? '⏳ Posting...' : '🚀 Post Now'}
                  </button>

                  <div className="border-t border-gray-800 pt-3">
                    <label className="label">Schedule for later</label>
                    <input
                      type="datetime-local"
                      className="input text-sm mb-2"
                      value={scheduledAt}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                    <button
                      className="btn-secondary w-full justify-center"
                      onClick={schedulePost}
                      disabled={posting || !scheduledAt}
                    >
                      🕐 Schedule
                    </button>
                  </div>
                </>
              )}

              {carousel.status === 'scheduled' && (
                <>
                  <p className="text-sm text-blue-400">
                    Scheduled: {new Date(carousel.scheduledAt!).toLocaleString()}
                  </p>
                  <button className="btn-primary w-full justify-center" onClick={postNow} disabled={posting}>
                    🚀 Post Now Instead
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
