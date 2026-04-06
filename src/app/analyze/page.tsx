'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  generateImages: boolean;
}

type Step = 'input' | 'analyzed' | 'generating' | 'done';

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
    generateImages: true,
  });

  async function handleAnalyze() {
    if (!url.trim()) { setError('Please enter an Instagram URL'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze post');
      setAnalyzed(data);
      setStep('analyzed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!analyzed) return;
    setError('');
    setLoading(true);
    setStep('generating');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyzedPostId: analyzed.id,
          ...options,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate carousel');
      setStep('done');
      router.push(`/carousel/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('analyzed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">New Carousel</h1>
        <p className="text-gray-400 text-sm mt-1">
          Paste an Instagram post URL → AI analyzes it → generates your unique carousel
        </p>
      </div>

      {/* Step 1: URL Input */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">1</span>
          Instagram Post URL
        </h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="https://www.instagram.com/p/ABC123/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            disabled={loading || step !== 'input'}
          />
          <button
            className="btn-primary px-5"
            onClick={handleAnalyze}
            disabled={loading || !url.trim() || step !== 'input'}
          >
            {loading && step === 'input' ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {step !== 'input' && (
          <button
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => { setStep('input'); setAnalyzed(null); setError(''); }}
          >
            ← Use different URL
          </button>
        )}
      </div>

      {/* Step 2: Review Analyzed Post */}
      {analyzed && (step === 'analyzed' || step === 'generating' || step === 'done') && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">2</span>
            Analyzed Post
            <span className="ml-2 text-xs text-green-400">✓ {analyzed.slides.length} slides found</span>
          </h2>

          {analyzed.authorUsername && (
            <p className="text-sm text-gray-400 mb-3">Source: @{analyzed.authorUsername}</p>
          )}

          {/* Slides preview */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {analyzed.slides.slice(0, 8).map((slide, i) => (
              <div key={i} className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-800 overflow-hidden border border-gray-700">
                {slide.type === 'image' && slide.url ? (
                  <img src={slide.url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    {slide.type === 'video' ? '🎬' : '🖼️'}
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

          {analyzed.caption && (
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 max-h-24 overflow-y-auto">
              {analyzed.caption.slice(0, 300)}{analyzed.caption.length > 300 ? '...' : ''}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Generation Options */}
      {(step === 'analyzed' || step === 'generating') && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-xs mr-2">3</span>
            Generation Options
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Your Niche / Topic</label>
              <input
                className="input"
                placeholder="e.g. fitness, marketing, mindset..."
                value={options.niche}
                onChange={(e) => setOptions({ ...options, niche: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Brand Name</label>
              <input
                className="input"
                placeholder="Your brand or account name"
                value={options.brandName}
                onChange={(e) => setOptions({ ...options, brandName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tone</label>
              <select
                className="input"
                value={options.tone}
                onChange={(e) => setOptions({ ...options, tone: e.target.value })}
              >
                <option value="engaging and professional">Engaging & Professional</option>
                <option value="casual and friendly">Casual & Friendly</option>
                <option value="educational and informative">Educational</option>
                <option value="motivational and inspiring">Motivational</option>
                <option value="witty and humorous">Witty & Humorous</option>
                <option value="luxury and premium">Luxury & Premium</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="generateImages"
                className="w-4 h-4 accent-purple-500"
                checked={options.generateImages}
                onChange={(e) => setOptions({ ...options, generateImages: e.target.checked })}
              />
              <label htmlFor="generateImages" className="text-sm text-gray-300 cursor-pointer">
                Generate AI images (DALL-E 3)
              </label>
            </div>
            <div className="col-span-2">
              <label className="label">Additional Instructions</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Any specific requests, topics to include, things to avoid..."
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
              <>
                <span className="animate-spin">⏳</span>
                Generating your carousel...
              </>
            ) : (
              <>✨ Generate My Carousel</>
            )}
          </button>

          {options.generateImages && (
            <p className="text-xs text-gray-600 mt-2 text-center">
              Image generation takes 1-3 min depending on slide count
            </p>
          )}
        </div>
      )}

      {/* Generating state */}
      {step === 'generating' && (
        <div className="card text-center py-8">
          <div className="text-4xl mb-3 animate-bounce">🤖</div>
          <p className="text-white font-semibold mb-1">Claude is analyzing and generating...</p>
          <p className="text-gray-500 text-sm">Analyzing original content, writing unique text, generating images</p>
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
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
