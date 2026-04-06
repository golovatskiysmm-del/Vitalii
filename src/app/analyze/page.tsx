'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnalyzedSlide {
  type: 'image' | 'video';
  url: string;
}

interface AnalyzedPost {
  id: string;
  caption: string;
  slides: AnalyzedSlide[];
  isCarousel: boolean;
  authorUsername?: string;
}

interface GenerateOptions {
  niche: string;
  tone: string;
  brandName: string;
  additionalInstructions: string;
  imageProvider: 'none' | 'dalle' | 'flux-schnell' | 'flux-dev';
  slideCount: number;
}

type Step = 'input' | 'analyzed' | 'generating' | 'done';
type ContextSource = 'manual' | 'url';

export default function AnalyzePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyzed, setAnalyzed] = useState<AnalyzedPost | null>(null);
  const [options, setOptions] = useState<GenerateOptions>({
    niche: '',
    tone: 'engaging and professional',
    brandName: '',
    additionalInstructions: '',
    imageProvider: 'dalle',
    slideCount: 5,
  });

  // Manual carousel description
  const [carouselDescription, setCarouselDescription] = useState('');

  // Context state
  const [contextSource, setContextSource] = useState<ContextSource>('manual');
  const [contextUrl, setContextUrl] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [contextTitle, setContextTitle] = useState('');

  async function handleAnalyze() {
    if (!url.trim()) { setError('Введите URL Instagram-поста'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось проанализировать пост');
      setAnalyzed(data);
      if (data.slides?.length > 1) {
        setOptions((o) => ({ ...o, slideCount: data.slides.length }));
      }
      setStep('analyzed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchContext() {
    if (!contextUrl.trim()) { setContextError('Введите URL'); return; }
    setContextError('');
    setContextLoading(true);
    try {
      const res = await fetch('/api/fetch-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: contextUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось загрузить контекст');
      setProjectContext(data.text || '');
      if (data.title) setContextTitle(data.title);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setContextLoading(false);
    }
  }

  async function handleGenerate() {
    if (!analyzed) return;
    setError('');
    setLoading(true);
    setStep('generating');
    try {
      const extraContext = [
        projectContext ? `Контекст проекта:\n${projectContext}` : '',
        carouselDescription ? `Описание оригинальной карусели:\n${carouselDescription}` : '',
        options.additionalInstructions,
      ].filter(Boolean).join('\n\n');

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyzedPostId: analyzed.id,
          niche: options.niche,
          tone: options.tone,
          brandName: options.brandName,
          additionalInstructions: extraContext,
          generateImages: options.imageProvider !== 'none',
          imageProvider: options.imageProvider,
          slideCount: options.slideCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сгенерировать карусель');
      setStep('done');
      router.push(`/carousel/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setStep('analyzed');
    } finally {
      setLoading(false);
    }
  }

  const slideColors = [
    'bg-purple-800', 'bg-blue-800', 'bg-pink-800', 'bg-indigo-800',
    'bg-teal-800', 'bg-orange-800', 'bg-rose-800', 'bg-cyan-800',
  ];

  const gotCaption = analyzed && analyzed.caption && analyzed.caption.length > 0;
  const gotSlides = analyzed && analyzed.slides && analyzed.slides.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Новый карусель</h1>
        <p className="text-gray-400 text-sm mt-1">
          Вставьте ссылку на Instagram-пост → ИИ анализирует → генерирует уникальный карусель
        </p>
      </div>

      {/* Step 1: URL Input */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">1</span>
          URL Instagram-поста
        </h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="https://www.instagram.com/p/ABC123/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && step === 'input' && handleAnalyze()}
            disabled={loading || step !== 'input'}
          />
          <button
            className="btn-primary px-5"
            onClick={handleAnalyze}
            disabled={loading || !url.trim() || step !== 'input'}
          >
            {loading && step === 'input' ? 'Анализ...' : 'Анализировать'}
          </button>
        </div>
        {step !== 'input' && (
          <button
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => { setStep('input'); setAnalyzed(null); setError(''); setCarouselDescription(''); }}
          >
            ← Использовать другой URL
          </button>
        )}
      </div>

      {/* Step 2: Review Analyzed Post */}
      {analyzed && (step === 'analyzed' || step === 'generating' || step === 'done') && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">2</span>
            Анализ поста
            {gotCaption && <span className="ml-2 text-xs text-green-400">✓ текст получен</span>}
          </h2>

          {analyzed.authorUsername && (
            <p className="text-sm text-gray-400 mb-3">Источник: @{analyzed.authorUsername}</p>
          )}

          {/* Slides grid */}
          {gotSlides && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {analyzed.slides.slice(0, 8).map((slide, i) => (
                <div key={i} className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-800 overflow-hidden border border-gray-700">
                  {slide.type === 'image' && slide.url ? (
                    <img
                      src={slide.url}
                      alt={`Слайд ${i + 1}`}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.classList.add(slideColors[i % slideColors.length]);
                          parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white font-bold text-lg">${i + 1}</div>`;
                        }
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${slideColors[i % slideColors.length]}`}>
                      {slide.type === 'video' ? (
                        <span className="text-2xl">🎬</span>
                      ) : (
                        <span className="text-white font-bold text-lg">{i + 1}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {analyzed.slides.length > 8 && (
                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-sm text-gray-500">
                  +{analyzed.slides.length - 8}
                </div>
              )}
            </div>
          )}

          {/* Instagram limitation notice */}
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-3 text-xs text-yellow-300">
            <p className="font-medium mb-1">ℹ️ О доступе к Instagram</p>
            <p className="text-yellow-400/80">
              Instagram ограничивает доступ к изображениям слайдов с серверов.
              Подпись к посту {gotCaption ? 'загружена' : 'недоступна'}.
              Опишите карусель вручную ниже — Claude создаст точный аналог.
            </p>
          </div>

          {analyzed.caption && (
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 max-h-24 overflow-y-auto mb-3">
              <p className="text-xs text-gray-500 mb-1">Подпись из Instagram:</p>
              {analyzed.caption.slice(0, 400)}{analyzed.caption.length > 400 ? '...' : ''}
            </div>
          )}

          {/* Manual carousel description */}
          <div>
            <label className="label">Опишите, что было в карусели (необязательно, но улучшает результат)</label>
            <textarea
              className="input resize-none w-full"
              rows={3}
              placeholder="Например: 5 слайдов о продуктивности. Слайд 1 — заголовок '5 привычек успешных людей'. Слайд 2 — про утренний ритуал. И т.д."
              value={carouselDescription}
              onChange={(e) => setCarouselDescription(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 3: Project Context */}
      {(step === 'analyzed' || step === 'generating') && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">3</span>
            Контекст проекта
            <span className="ml-2 text-xs text-gray-500">(необязательно)</span>
          </h2>

          {/* Source tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { key: 'manual', label: 'Ввести вручную' },
              { key: 'url', label: 'Загрузить с URL / Notion / Google Docs' },
            ] as { key: ContextSource; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setContextSource(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  contextSource === key
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Manual input */}
          {contextSource === 'manual' && (
            <>
              <textarea
                className="input resize-none w-full"
                rows={4}
                placeholder="Опишите ваш проект, целевую аудиторию, ключевые ценности, тематику..."
                value={projectContext}
                onChange={(e) => setProjectContext(e.target.value)}
              />
              {projectContext && (
                <p className="text-xs text-gray-600 mt-1">{projectContext.length} символов</p>
              )}
            </>
          )}

          {/* URL input */}
          {contextSource === 'url' && (
            <div className="space-y-3">
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-xs text-blue-300">
                <p className="font-medium mb-1">Поддерживается:</p>
                <ul className="text-blue-400/80 space-y-0.5">
                  <li>• <strong>Google Docs</strong> — документ должен быть открыт (доступ «для всех по ссылке»)</li>
                  <li>• <strong>Notion</strong> — страница должна быть публичной (Share → Publish to web)</li>
                  <li>• <strong>Любой сайт</strong> — публичные страницы</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="https://docs.google.com/... или notion.so/... или любой URL"
                  value={contextUrl}
                  onChange={(e) => setContextUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchContext()}
                />
                <button
                  className="btn-secondary px-4"
                  onClick={handleFetchContext}
                  disabled={contextLoading || !contextUrl.trim()}
                >
                  {contextLoading ? '⏳' : 'Загрузить'}
                </button>
              </div>
              {contextError && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded p-2">
                  ⚠️ {contextError}
                </p>
              )}
              {projectContext && (
                <div className="bg-gray-800 rounded-lg p-3">
                  {contextTitle && <p className="text-xs text-purple-400 mb-1 font-medium">✓ {contextTitle}</p>}
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {projectContext.slice(0, 600)}{projectContext.length > 600 ? '...' : ''}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">Загружено: {projectContext.length} символов</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Generation Options */}
      {(step === 'analyzed' || step === 'generating') && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">4</span>
            Параметры генерации
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ниша / Тема</label>
              <input
                className="input"
                placeholder="например, фитнес, маркетинг..."
                value={options.niche}
                onChange={(e) => setOptions({ ...options, niche: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Название бренда</label>
              <input
                className="input"
                placeholder="Ваш бренд или аккаунт"
                value={options.brandName}
                onChange={(e) => setOptions({ ...options, brandName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Тон</label>
              <select
                className="input"
                value={options.tone}
                onChange={(e) => setOptions({ ...options, tone: e.target.value })}
              >
                <option value="engaging and professional">Вовлекающий и профессиональный</option>
                <option value="casual and friendly">Неформальный и дружелюбный</option>
                <option value="educational and informative">Образовательный</option>
                <option value="motivational and inspiring">Мотивирующий</option>
                <option value="witty and humorous">Остроумный и юмористический</option>
                <option value="luxury and premium">Люкс и премиум</option>
              </select>
            </div>
            <div>
              <label className="label">Количество слайдов</label>
              <input
                className="input"
                type="number"
                min={2}
                max={15}
                value={options.slideCount}
                onChange={(e) => setOptions({ ...options, slideCount: parseInt(e.target.value) || 5 })}
              />
            </div>
            <div className="col-span-2">
              <label className="label">Генерация изображений</label>
              <select
                className="input"
                value={options.imageProvider}
                onChange={(e) => setOptions({ ...options, imageProvider: e.target.value as GenerateOptions['imageProvider'] })}
              >
                <option value="none">Не генерировать картинки</option>
                <option value="dalle">DALL-E 3 (OpenAI) — нужен OPENAI_API_KEY</option>
                <option value="flux-schnell">Flux Schnell (Replicate) — быстрый</option>
                <option value="flux-dev">Flux Dev (Replicate) — качественный</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Дополнительные инструкции</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Конкретные запросы, что включить или избегать..."
                value={options.additionalInstructions}
                onChange={(e) => setOptions({ ...options, additionalInstructions: e.target.value })}
              />
            </div>
          </div>

          <button
            className="btn-primary mt-5 w-full justify-center"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <><span className="animate-spin mr-2">⏳</span>Генерация карусели...</>
            ) : (
              <>✨ Сгенерировать карусель</>
            )}
          </button>

          {options.imageProvider !== 'none' && (
            <p className="text-xs text-gray-600 mt-2 text-center">
              Генерация изображений занимает 1–3 минуты
            </p>
          )}
        </div>
      )}

      {/* Generating state */}
      {step === 'generating' && (
        <div className="card text-center py-8">
          <div className="text-4xl mb-3 animate-bounce">🤖</div>
          <p className="text-white font-semibold mb-1">Claude анализирует и генерирует...</p>
          <p className="text-gray-500 text-sm">Создание уникального текста и изображений</p>
          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-400 text-sm">
          <p className="font-medium mb-1">⚠️ Ошибка</p>
          <p>{error}</p>
          {error.includes('authentication') || error.includes('401') || error.includes('x-api-key') ? (
            <p className="mt-2 text-red-300/70 text-xs">
              Проблема с API ключом. Зайдите в Vercel → Settings → Environment Variables и проверьте ANTHROPIC_API_KEY (должен начинаться с <code>sk-ant-</code>).
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
