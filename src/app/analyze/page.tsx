'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface AnalyzedPost {
  id: string;
  shortcode: string;
  caption: string;
  slides: { type: string; url: string }[];
  isCarousel: boolean;
  authorUsername?: string;
  embedHtml?: string;
}

type ImageProvider = 'none' | 'dalle' | 'flux-schnell' | 'flux-dev' | 'flux-pro' | 'ideogram' | 'sdxl';

interface GenerateOptions {
  niche: string;
  tone: string;
  brandName: string;
  additionalInstructions: string;
  imageProvider: ImageProvider;
  slideCount: number;
}

type Step = 1 | 2 | 3 | 4;
type ContextSource = 'file' | 'url' | 'manual';


const IMAGE_PROVIDERS: { value: ImageProvider; label: string; badge?: string }[] = [
  { value: 'none', label: 'Без изображений' },
  { value: 'dalle', label: 'DALL-E 3', badge: 'OpenAI' },
  { value: 'flux-schnell', label: 'Flux Schnell', badge: 'Быстрый' },
  { value: 'flux-dev', label: 'Flux Dev', badge: 'Качество' },
  { value: 'flux-pro', label: 'Flux 1.1 Pro', badge: 'Лучший Flux' },
  { value: 'ideogram', label: 'Ideogram v2', badge: 'Топ для соцсетей' },
  { value: 'sdxl', label: 'Stable Diffusion XL', badge: 'Бесплатно' },
];

/* ── Component ────────────────────────────────────────────────────────────── */
export default function AnalyzePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // Step 1
  const [igUrl, setIgUrl] = useState('');
  const [analyzed, setAnalyzed] = useState<AnalyzedPost | null>(null);
  const [carouselHint, setCarouselHint] = useState('');

  // Step 2
  const [contextSource, setContextSource] = useState<ContextSource>('file');
  const [projectContext, setProjectContext] = useState('');
  const [contextTitle, setContextTitle] = useState('');
  const [contextUrl, setContextUrl] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [options, setOptions] = useState<GenerateOptions>({
    niche: '',
    tone: 'engaging and professional',
    brandName: '',
    additionalInstructions: '',
    imageProvider: 'dalle',
    slideCount: 5,
  });

  /* ── Step 1: Analyze ───────────────────────────────────────────────────── */
  async function handleAnalyze() {
    if (!igUrl.trim()) { setGlobalError('Введите URL Instagram-поста'); return; }
    setGlobalError('');
    setGlobalLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: igUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось проанализировать пост');
      setAnalyzed(data);
      if (data.slides?.length > 1) setOptions((o) => ({ ...o, slideCount: data.slides.length }));
      setStep(2);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка анализа');
    } finally {
      setGlobalLoading(false);
    }
  }

  /* ── Step 2: Context ───────────────────────────────────────────────────── */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setContextError('');
    setContextLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload-context', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки файла');
      setProjectContext(data.text || '');
      setContextTitle(data.title || file.name);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setContextLoading(false);
    }
  }

  async function handleFetchUrl() {
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
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      setProjectContext(data.text || '');
      setContextTitle(data.title || contextUrl);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setContextLoading(false);
    }
  }

  /* ── Step 4: Generate ──────────────────────────────────────────────────── */
  async function handleGenerate() {
    if (!analyzed) return;
    setGlobalError('');
    setGlobalLoading(true);
    setStep(4);
    try {
      const extraContext = [
        projectContext ? `Контекст проекта / ДНК клиента:\n${projectContext}` : '',
        carouselHint ? `Описание оригинальной карусели конкурента:\n${carouselHint}` : '',
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
      router.push(`/carousel/${data.id}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка генерации');
      setStep(3);
    } finally {
      setGlobalLoading(false);
    }
  }

  /* ── Step indicator ────────────────────────────────────────────────────── */
  function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
    return (
      <div className={`flex items-center gap-2 ${active ? 'text-white' : done ? 'text-green-400' : 'text-gray-600'}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
          ${active ? 'bg-purple-600 border-purple-500' : done ? 'bg-green-700 border-green-600' : 'border-gray-700 bg-gray-800'}`}>
          {done ? '✓' : n}
        </div>
        <span className="text-sm hidden sm:block">{label}</span>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Новый карусель</h1>
        <p className="text-gray-400 text-sm mt-1">Анализ конкурента → ваш контекст → уникальный карусель</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 flex-wrap">
        <StepBadge n={1} label="Instagram" active={step === 1} done={step > 1} />
        <div className="w-6 h-px bg-gray-700 hidden sm:block" />
        <StepBadge n={2} label="Контекст" active={step === 2} done={step > 2} />
        <div className="w-6 h-px bg-gray-700 hidden sm:block" />
        <StepBadge n={3} label="Параметры" active={step === 3} done={step > 3} />
        <div className="w-6 h-px bg-gray-700 hidden sm:block" />
        <StepBadge n={4} label="Генерация" active={step === 4} done={false} />
      </div>

      {/* ── STEP 1: Instagram ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-white">
            Шаг 1 — Карусель конкурента
          </h2>
          <p className="text-sm text-gray-400">
            Вставьте ссылку на публичный Instagram-пост. Приложение вытянет фотографии и текст.
          </p>

          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="https://www.instagram.com/p/ABC123/"
              value={igUrl}
              onChange={(e) => setIgUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !globalLoading && handleAnalyze()}
              disabled={globalLoading}
            />
            <button
              className="btn-primary px-5"
              onClick={handleAnalyze}
              disabled={globalLoading || !igUrl.trim()}
            >
              {globalLoading ? '⏳' : 'Анализировать →'}
            </button>
          </div>

          <div className="bg-blue-950/40 border border-blue-800/30 rounded-lg p-3 text-xs text-blue-300 space-y-1">
            <p className="font-medium">ℹ️ Что происходит:</p>
            <p>Приложение скачивает фотографии карусели на свой сервер и читает подпись к посту. Instagram иногда ограничивает доступ — тогда вы сможете описать слайды вручную на следующем шаге.</p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Context ───────────────────────────────────────────── */}
      {step === 2 && analyzed && (
        <div className="space-y-4">

          {/* Результат анализа */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Карусель проанализирована ✓</h2>
              <button className="text-xs text-gray-500 hover:text-gray-300" onClick={() => { setStep(1); setAnalyzed(null); }}>
                ← Изменить
              </button>
            </div>

            {analyzed.authorUsername && (
              <p className="text-sm text-gray-400 mb-1">@{analyzed.authorUsername}</p>
            )}

            {/* Instagram embed iframe — shows real carousel in browser */}
            <div className="relative w-full rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
              <p className="text-xs text-gray-500 px-3 pt-2 pb-1">Карусель (пролистайте стрелками внутри):</p>
              <iframe
                src={`https://www.instagram.com/p/${analyzed.shortcode}/embed/`}
                className="w-full"
                style={{ height: '540px', border: 'none' }}
                scrolling="no"
                allowTransparency={true}
                allow="encrypted-media"
                title="Instagram карусель"
              />
            </div>

            {analyzed.caption && (
              <div className="bg-gray-800/80 rounded-lg p-3 text-sm text-gray-300 max-h-28 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-1">Текст поста:</p>
                {analyzed.caption.slice(0, 500)}{analyzed.caption.length > 500 ? '…' : ''}
              </div>
            )}

            {/* Hint about slides */}
            <div>
              <label className="label">Опишите карусель для Claude (необязательно — улучшает результат)</label>
              <textarea
                className="input resize-none w-full"
                rows={3}
                placeholder="Например: 6 слайдов о продуктивности. Слайд 1 — заголовок '5 привычек'. Слайд 2 — про утро. Слайд 3 — про фокус…"
                value={carouselHint}
                onChange={(e) => setCarouselHint(e.target.value)}
              />
            </div>
          </div>

          {/* Контекст */}
          <div className="card space-y-4">
            <h2 className="text-base font-semibold text-white">
              Шаг 2 — Ваш контекст / ДНК клиента
              <span className="ml-2 text-xs text-gray-500 font-normal">(необязательно)</span>
            </h2>
            <p className="text-sm text-gray-400">
              Загрузите файл с описанием вашего проекта, нишей, аудиторией — Claude будет адаптировать контент под вас.
            </p>

            {/* Tabs */}
            <div className="flex gap-2">
              {([
                { key: 'file', icon: '📁', label: 'Файл' },
                { key: 'url', icon: '🔗', label: 'Notion / Google Docs / URL' },
                { key: 'manual', icon: '✏️', label: 'Вручную' },
              ] as { key: ContextSource; icon: string; label: string }[]).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => { setContextSource(key); setContextError(''); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    contextSource === key
                      ? 'bg-purple-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <span>{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* File upload */}
            {contextSource === 'file' && (
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-purple-600 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-3xl mb-2">📄</div>
                  <p className="text-sm text-gray-400">Нажмите чтобы выбрать файл</p>
                  <p className="text-xs text-gray-600 mt-1">PDF, DOCX, TXT — макс. 5 МБ</p>
                  {contextLoading && <p className="text-xs text-purple-400 mt-2">⏳ Читаю файл…</p>}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {/* URL (Notion / Google Docs) */}
            {contextSource === 'url' && (
              <div className="space-y-3">
                <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3 text-xs text-blue-300 space-y-1">
                  <p className="font-medium">Поддерживаемые источники:</p>
                  <p>• <strong>Google Docs</strong> — откройте доступ «для всех по ссылке» → вставьте ссылку</p>
                  <p>• <strong>Notion</strong> — Share → Publish to web → вставьте ссылку</p>
                  <p>• <strong>Google NotebookLM</strong> — экспортируйте как Google Doc → вставьте ссылку</p>
                  <p>• Любой публичный сайт</p>
                </div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="https://docs.google.com/... или notion.so/..."
                    value={contextUrl}
                    onChange={(e) => setContextUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !contextLoading && handleFetchUrl()}
                  />
                  <button
                    className="btn-secondary px-4"
                    onClick={handleFetchUrl}
                    disabled={contextLoading || !contextUrl.trim()}
                  >
                    {contextLoading ? '⏳' : 'Загрузить'}
                  </button>
                </div>
              </div>
            )}

            {/* Manual */}
            {contextSource === 'manual' && (
              <textarea
                className="input resize-none w-full"
                rows={5}
                placeholder="Опишите ваш проект, нишу, целевую аудиторию, уникальное торговое предложение, тон общения, ключевые ценности…"
                value={projectContext}
                onChange={(e) => setProjectContext(e.target.value)}
              />
            )}

            {/* Error */}
            {contextError && (
              <div className="bg-red-950/30 border border-red-700/30 rounded-lg p-3 text-xs text-red-300">
                ⚠️ {contextError}
              </div>
            )}

            {/* Loaded preview */}
            {projectContext && (contextSource === 'file' || contextSource === 'url') && (
              <div className="bg-gray-800/60 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-400 font-medium">✓ {contextTitle || 'Контекст загружен'}</p>
                  <button className="text-xs text-gray-600 hover:text-gray-400" onClick={() => { setProjectContext(''); setContextTitle(''); }}>
                    Удалить
                  </button>
                </div>
                <p className="text-xs text-gray-500">{projectContext.length.toLocaleString()} символов</p>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
                  {projectContext.slice(0, 200)}…
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep(1)}>← Назад</button>
            <button className="btn-primary flex-1" onClick={() => setStep(3)}>Далее →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Options ───────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Шаг 3 — Параметры генерации</h2>
            <button className="text-xs text-gray-500 hover:text-gray-300" onClick={() => setStep(2)}>← Назад</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ниша / Тема</label>
              <input
                className="input"
                placeholder="фитнес, маркетинг, мышление…"
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
              <select className="input" value={options.tone} onChange={(e) => setOptions({ ...options, tone: e.target.value })}>
                <option value="engaging and professional">Вовлекающий и профессиональный</option>
                <option value="casual and friendly">Неформальный и дружелюбный</option>
                <option value="educational and informative">Образовательный</option>
                <option value="motivational and inspiring">Мотивирующий</option>
                <option value="witty and humorous">Остроумный и юмористический</option>
                <option value="luxury and premium">Люкс и премиум</option>
                <option value="bold and direct">Дерзкий и прямой</option>
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
          </div>

          {/* Image provider */}
          <div>
            <label className="label">Генерация изображений</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {IMAGE_PROVIDERS.map(({ value, label, badge }) => (
                <button
                  key={value}
                  onClick={() => setOptions({ ...options, imageProvider: value })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    options.imageProvider === value
                      ? 'border-purple-500 bg-purple-900/30 text-white'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  <p className="text-sm font-medium">{label}</p>
                  {badge && <p className="text-xs text-gray-500 mt-0.5">{badge}</p>}
                </button>
              ))}
            </div>
            {options.imageProvider !== 'none' && (
              <p className="text-xs text-gray-600 mt-2">
                Генерация изображений займёт 1–4 минуты. {options.imageProvider === 'ideogram' && 'Требует IDEOGRAM_API_KEY в Vercel.'}
                {(options.imageProvider === 'flux-schnell' || options.imageProvider === 'flux-dev' || options.imageProvider === 'flux-pro' || options.imageProvider === 'sdxl') && 'Требует REPLICATE_API_TOKEN в Vercel.'}
                {options.imageProvider === 'dalle' && 'Требует OPENAI_API_KEY в Vercel.'}
              </p>
            )}
          </div>

          <div>
            <label className="label">Дополнительные инструкции</label>
            <textarea
              className="input resize-none w-full"
              rows={2}
              placeholder="Что включить, что избегать, особый стиль…"
              value={options.additionalInstructions}
              onChange={(e) => setOptions({ ...options, additionalInstructions: e.target.value })}
            />
          </div>

          <button
            className="btn-primary w-full justify-center text-base py-3"
            onClick={handleGenerate}
            disabled={globalLoading}
          >
            ✨ Создать карусель
          </button>
        </div>
      )}

      {/* ── STEP 4: Generating ────────────────────────────────────────── */}
      {step === 4 && (
        <div className="card text-center py-12 space-y-4">
          <div className="text-5xl animate-bounce">🤖</div>
          <h2 className="text-white text-xl font-semibold">Claude создаёт карусель…</h2>
          <p className="text-gray-400 text-sm">
            Анализирую оригинал, пишу уникальный текст
            {options.imageProvider !== 'none' ? ', генерирую изображения' : ''}
          </p>
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-600">
            {options.imageProvider !== 'none' ? 'Займёт 2–4 минуты' : 'Займёт около 30 секунд'}
          </p>
        </div>
      )}

      {/* Global error */}
      {globalError && (
        <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm space-y-1">
          <p className="font-medium">⚠️ Ошибка</p>
          <p>{globalError}</p>
          {(globalError.includes('authentication') || globalError.includes('401') || globalError.includes('api-key')) && (
            <p className="text-red-400/70 text-xs">
              Проверьте ANTHROPIC_API_KEY в Vercel → Settings → Environment Variables. Ключ должен начинаться с <code>sk-ant-</code>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
