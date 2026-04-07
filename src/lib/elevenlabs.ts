export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
}

export interface TTSOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
  speed?: number;
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY не задан в переменных окружения');
  return key;
}

const BASE_URL = 'https://api.elevenlabs.io/v1';

export async function getVoices(): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { 'xi-api-key': getApiKey() },
    next: { revalidate: 300 }, // cache 5 min
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs voices error ${res.status}: ${err}`);
  }

  const data = await res.json() as { voices: ElevenLabsVoice[] };
  return data.voices;
}

export async function textToSpeech(opts: TTSOptions): Promise<Buffer> {
  const {
    voiceId,
    text,
    modelId = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.3,
    speakerBoost = true,
    speed = 0.85, // slightly slower for meditation
  } = opts;

  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': getApiKey(),
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: speakerBoost,
        speed,
      },
    }),
  });

  if (!res.ok) {
    let errMsg = `ElevenLabs TTS error ${res.status}`;
    try {
      const errData = await res.json() as { detail?: { message?: string } | string };
      if (typeof errData.detail === 'string') errMsg += `: ${errData.detail}`;
      else if (errData.detail?.message) errMsg += `: ${errData.detail.message}`;
    } catch { /* ignore parse error */ }
    throw new Error(errMsg);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getUserInfo(): Promise<{ character_count: number; character_limit: number }> {
  const res = await fetch(`${BASE_URL}/user/subscription`, {
    headers: { 'xi-api-key': getApiKey() },
  });
  if (!res.ok) throw new Error(`ElevenLabs user info error ${res.status}`);
  return res.json();
}
