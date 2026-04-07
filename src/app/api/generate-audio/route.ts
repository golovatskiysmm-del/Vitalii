export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech } from '@/lib/elevenlabs';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

// ElevenLabs limit: ~5000 chars per request on free tier
const MAX_CHARS = 4800;

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?…])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      voiceId,
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.3,
      speed = 0.85,
    } = await req.json() as {
      text: string;
      voiceId: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      speed?: number;
    };

    if (!text?.trim()) return NextResponse.json({ error: 'Текст не может быть пустым' }, { status: 400 });
    if (!voiceId) return NextResponse.json({ error: 'Выберите голос' }, { status: 400 });

    const chunks = splitTextIntoChunks(text.trim(), MAX_CHARS);

    // Generate audio for each chunk
    const buffers = await Promise.all(
      chunks.map(chunk =>
        textToSpeech({ voiceId, text: chunk, stability, similarityBoost, style, speed })
      )
    );

    // Concatenate all buffers
    const combined = Buffer.concat(buffers);

    // Try to store in Vercel Blob
    const filename = `meditation_${uuidv4()}.mp3`;
    let audioUrl: string | null = null;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import('@vercel/blob');
        const blob = await put(filename, combined, {
          access: 'public',
          contentType: 'audio/mpeg',
        });
        audioUrl = blob.url;
      } catch {
        // Fall through to base64 response
      }
    }

    if (audioUrl) {
      // Return URL reference
      return NextResponse.json({
        url: audioUrl,
        filename,
        sizeKb: Math.round(combined.length / 1024),
        chunks: chunks.length,
      });
    }

    // Fallback: return audio directly as base64
    return NextResponse.json({
      base64: combined.toString('base64'),
      contentType: 'audio/mpeg',
      filename,
      sizeKb: Math.round(combined.length / 1024),
      chunks: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка генерации аудио';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
