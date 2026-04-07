'use client';

import { useState, useEffect, useRef } from 'react';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Voice {
  voice_id: string;
  name: string;
  preview_url: string;
  category: string;
  labels?: Record<string, string>;
}

type MeditationType = 'sleep' | 'anxiety' | 'focus' | 'energy' | 'gratitude' | 'breathing' | 'bodyscan' | 'visualization' | 'custom';
type Language = 'ru' | 'en';
type Step = 'settings' | 'text' | 'audio';

const MEDITATION_TYPES: { value: MeditationType; emoji: string; label: string; desc: string }[] = [
  { value: 'sleep',          emoji: '🌙', label: 'Сон',           desc: 'Засыпание и глубокий отдых' },
  { value: 'anxiety',        emoji: '🌊', label: 'Тревога',       desc: 'Снятие стресса и тревоги' },
  { value: 'focus',          emoji: '🎯', label: 'Фокус',         desc: 'Концентрация и ясность' },
  { value: 'energy',         emoji: '⚡', label: 'Энергия',       desc: 'Бодрость и витальность' },
  { value: 'gratitude',      emoji: '🙏', label: 'Благодарность', desc: 'Принятие и благодарность' },
  { value: 'breathing',      emoji: '💨', label: 'Дыхание',       desc: 'Дыхательные практики' },
  { value: 'bodyscan',       emoji: '🧘', label: 'Тело',          desc: 'Сканирование и расслабление' },
  { value: 'visualization',  emoji: '🌟', label: 'Визуализация',  desc: 'Образы и цели' },
  { value: 'custom',         emoji: '✨', label: 'Своя тема',     desc: 'Опишите сами' },
];

const DURATIONS = [5, 10, 15, 20];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function HomePage() {
  // Settings
  const [type, setType] = useState<MeditationType>('sleep');
  const [duration, setDuration] = useState(10);
  const [language, setLanguage] = useState<Language>('ru');
  const [customTopic, setCustomTopic] = useState('');
  const [userName, setUserName] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [stability, setStability] = useState(0.5);
  const [speed, setSpeed] = useState(0.85);

  // Voices
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesError, setVoicesError] = useState('');
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState('');

  // Text
  const [step, setStep] = useState<Step>('settings');
  const [meditationText, setMeditationText] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState('');

  // Audio
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFilename, setAudioFilename] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  /* ── Load voices ─────────────────────────────────────────────────────── */
  useEffect(() => {
    async function loadVoices() {
      try {
        const res = await fetch('/api/voices');
        const data = await res.json() as { voices?: Voice[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки голосов');
        setVoices(data.voices ?? []);
        // Auto-select first voice
        if (data.voices && data.voices.length > 0) {
          setVoiceId(data.voices[0].voice_id);
        }
      } catch (err) {
        setVoicesError(err instanceof Error ? err.message : 'Ошибка');
      } finally {
        setVoicesLoading(false);
      }
    }
    loadVoices();
  }, []);

  /* ── Preview voice ───────────────────────────────────────────────────── */
  function previewVoice(voice: Voice) {
    if (!voice.preview_url) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (previewingId === voice.voice_id) {
      setPreviewingId('');
      return;
    }
    const audio = new Audio(voice.preview_url);
    previewAudioRef.current = audio;
    audio.play();
    setPreviewingId(voice.voice_id);
    audio.onended = () => setPreviewingId('');
  }

  /* ── Generate text ───────────────────────────────────────────────────── */
  async function handleGenerateText() {
    if (type === 'custom' && !customTopic.trim()) {
      setTextError('Введите тему медитации');
      return;
    }
    setTextError('');
    setTextLoading(true);
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, duration, language, customTopic, userName }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации');
      setMeditationText(data.text ?? '');
      setStep('text');
    } catch (err) {
      setTextError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTextLoading(false);
    }
  }

  /* ── Generate audio ──────────────────────────────────────────────────── */
  async function handleGenerateAudio() {
    if (!voiceId) { setAudioError('Выберите голос'); return; }
    if (!meditationText.trim()) { setAudioError('Текст пустой'); return; }
    setAudioError('');
    setAudioLoading(true);
    setAudioUrl('');
    try {
      const res = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: meditationText,
          voiceId,
          stability,
          similarityBoost: 0.75,
          style: 0.3,
          speed,
        }),
      });
      const data = await res.json() as {
        url?: string;
        base64?: string;
        filename?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации аудио');

      let url = '';
      if (data.url) {
        url = data.url;
      } else if (data.base64) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))],
          { type: 'audio/mpeg' }
        );
        url = URL.createObjectURL(blob);
      }

      setAudioUrl(url);
      setAudioFilename(data.filename ?? 'meditation.mp3');
      setStep('audio');
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setAudioLoading(false);
    }
  }

  /* ── Audio player controls ───────────────────────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setTotalTime(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  }

  function handleDownload() {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = audioFilename;
    a.click();
  }

  const selectedVoice = voices.find(v => v.voice_id === voiceId);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2 animate-fade-in">
          <div className="text-5xl mb-3">🧘</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Meditation Studio</h1>
          <p className="text-gray-400">Создавайте персональные медитации с AI-голосом</p>
        </div>

        {/* Steps nav */}
        <div className="flex items-center justify-center gap-2 text-sm">
          {(['settings', 'text', 'audio'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => step !== 'settings' && s !== 'audio' && setStep(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                  step === s
                    ? 'bg-indigo-600 text-white font-medium'
                    : s === 'audio' || (s === 'text' && !meditationText)
                    ? 'text-gray-600 cursor-default'
                    : 'text-gray-400 hover:text-gray-200 cursor-pointer'
                }`}
              >
                <span className="text-xs font-bold opacity-60">{i + 1}</span>
                <span>{ s === 'settings' ? 'Настройки' : s === 'text' ? 'Текст' : 'Аудио' }</span>
              </button>
              {i < 2 && <div className="w-4 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Settings ──────────────────────────────────────────── */}
        {step === 'settings' && (
          <div className="space-y-6 animate-slide-up">

            {/* Meditation type */}
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-white">Тип медитации</h2>
              <div className="grid grid-cols-3 gap-2">
                {MEDITATION_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    onClick={() => setType(mt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      type === mt.value
                        ? 'border-indigo-500 bg-indigo-600/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-xl mb-1">{mt.emoji}</div>
                    <div className="text-xs font-medium">{mt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 hidden sm:block">{mt.desc}</div>
                  </button>
                ))}
              </div>

              {type === 'custom' && (
                <div>
                  <label className="label">Ваша тема</label>
                  <input
                    className="input"
                    placeholder="Например: медитация для утра перед важной встречей…"
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Duration + Language + Name */}
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-white">Параметры</h2>

              <div>
                <label className="label">Длительность</label>
                <div className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        duration === d
                          ? 'border-indigo-500 bg-indigo-600/20 text-white'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Язык</label>
                  <select className="input" value={language} onChange={e => setLanguage(e.target.value as Language)}>
                    <option value="ru">🇷🇺 Русский</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
                </div>
                <div>
                  <label className="label">Имя слушателя <span className="text-gray-600 normal-case">(необязательно)</span></label>
                  <input
                    className="input"
                    placeholder="Алексей"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Voice selection */}
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-white">Голос</h2>

              {voicesLoading && (
                <div className="text-center py-6 text-gray-500">
                  <div className="inline-block w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-2" />
                  <p className="text-sm">Загружаю голоса…</p>
                </div>
              )}

              {voicesError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
                  ⚠️ {voicesError}
                  <p className="text-xs text-red-400/70 mt-1">Проверьте ELEVENLABS_API_KEY</p>
                </div>
              )}

              {!voicesLoading && voices.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {voices.map(voice => (
                    <button
                      key={voice.voice_id}
                      onClick={() => setVoiceId(voice.voice_id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        voiceId === voice.voice_id
                          ? 'border-indigo-500 bg-indigo-600/20'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          voiceId === voice.voice_id ? 'bg-indigo-600' : 'bg-white/10'
                        }`}>
                          {voice.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${voiceId === voice.voice_id ? 'text-white' : 'text-gray-300'}`}>
                            {voice.name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {voice.category === 'cloned' ? '⭐ Клонированный' : voice.category}
                            {voice.labels?.accent ? ` · ${voice.labels.accent}` : ''}
                          </p>
                        </div>
                      </div>
                      {voice.preview_url && (
                        <button
                          onClick={e => { e.stopPropagation(); previewVoice(voice); }}
                          className={`p-2 rounded-lg transition-colors text-sm ${
                            previewingId === voice.voice_id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Прослушать голос"
                        >
                          {previewingId === voice.voice_id ? '⏹' : '▶'}
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Voice settings */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="label">Стабильность: {Math.round(stability * 100)}%</label>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={stability}
                    onChange={e => setStability(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">Выше = монотоннее, ниже = выразительнее</p>
                </div>
                <div>
                  <label className="label">Скорость: {speed}x</label>
                  <input
                    type="range" min="0.7" max="1.2" step="0.05"
                    value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">0.85 оптимально для медитации</p>
                </div>
              </div>
            </div>

            {textError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
                ⚠️ {textError}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleGenerateText}
              disabled={textLoading || voicesLoading}
            >
              {textLoading ? (
                <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Генерирую текст…</>
              ) : '✨ Создать текст медитации'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Text ──────────────────────────────────────────────── */}
        {step === 'text' && (
          <div className="space-y-4 animate-slide-up">
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Текст медитации</h2>
                <div className="flex gap-2">
                  <button className="btn-ghost text-xs" onClick={() => setStep('settings')}>
                    ← Назад
                  </button>
                  <button
                    className="btn-ghost text-xs text-indigo-400 hover:text-indigo-300"
                    onClick={handleGenerateText}
                    disabled={textLoading}
                  >
                    {textLoading ? '⏳' : '🔄 Перегенерировать'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Отредактируйте текст по желанию — затем озвучьте выбранным голосом.
              </p>

              <textarea
                className="input resize-none w-full font-light leading-relaxed"
                rows={14}
                value={meditationText}
                onChange={e => setMeditationText(e.target.value)}
              />

              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{meditationText.split(/\s+/).filter(Boolean).length} слов</span>
                <span>~{Math.round(meditationText.split(/\s+/).filter(Boolean).length / 120)} мин при чтении</span>
                <span>{meditationText.length} символов</span>
              </div>
            </div>

            {/* Selected voice reminder */}
            {selectedVoice && (
              <div className="card-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center text-sm font-bold text-indigo-300">
                    {selectedVoice.name[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white">{selectedVoice.name}</p>
                    <p className="text-xs text-gray-500">Скорость {speed}x · Стабильность {Math.round(stability * 100)}%</p>
                  </div>
                </div>
                <button className="btn-ghost text-xs" onClick={() => setStep('settings')}>Изменить</button>
              </div>
            )}

            {audioError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
                ⚠️ {audioError}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleGenerateAudio}
              disabled={audioLoading || !voiceId || !meditationText.trim()}
            >
              {audioLoading ? (
                <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Генерирую аудио…</>
              ) : '🎙️ Озвучить медитацию'}
            </button>

            <p className="text-center text-xs text-gray-600">
              Генерация занимает 10–60 секунд в зависимости от длины
            </p>
          </div>
        )}

        {/* ── STEP 3: Audio player ──────────────────────────────────────── */}
        {step === 'audio' && audioUrl && (
          <div className="space-y-4 animate-slide-up">

            {/* Player */}
            <div className="card space-y-5">
              <div className="text-center space-y-1">
                <div className="text-4xl">{MEDITATION_TYPES.find(m => m.value === type)?.emoji ?? '🧘'}</div>
                <h2 className="text-lg font-semibold text-white">
                  {MEDITATION_TYPES.find(m => m.value === type)?.label ?? 'Медитация'}
                </h2>
                {userName && <p className="text-sm text-gray-400">для {userName}</p>}
                <p className="text-xs text-gray-500">{duration} мин · {selectedVoice?.name}</p>
              </div>

              {/* Hidden audio element */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio ref={audioRef} src={audioUrl} preload="metadata" />

              {/* Progress bar */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={totalTime || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={seek}
                  className="w-full accent-indigo-500 h-1.5"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatDuration(Math.floor(currentTime))}</span>
                  <span>{totalTime ? formatDuration(Math.floor(totalTime)) : '--:--'}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 15; }}
                  className="btn-ghost text-lg w-12 h-12 rounded-full"
                  title="-15 сек"
                >⏪</button>

                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/30 transition-all hover:scale-105"
                >
                  {playing ? '⏸' : '▶️'}
                </button>

                <button
                  onClick={() => { if (audioRef.current) audioRef.current.currentTime += 15; }}
                  className="btn-ghost text-lg w-12 h-12 rounded-full"
                  title="+15 сек"
                >⏩</button>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleDownload} className="btn-primary py-3">
                ⬇️ Скачать MP3
              </button>
              <button
                className="btn-secondary py-3"
                onClick={() => {
                  setAudioUrl('');
                  setMeditationText('');
                  setStep('settings');
                  setPlaying(false);
                }}
              >
                ✨ Новая медитация
              </button>
            </div>

            <button
              className="btn-ghost w-full text-sm"
              onClick={() => { setAudioUrl(''); setStep('text'); setPlaying(false); }}
            >
              ← Изменить текст и переозвучить
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
