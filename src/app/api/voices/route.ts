export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getVoices } from '@/lib/elevenlabs';

export async function GET() {
  try {
    const voices = await getVoices();

    // Sort: custom/cloned voices first, then premade
    const sorted = [...voices].sort((a, b) => {
      if (a.category === 'cloned' && b.category !== 'cloned') return -1;
      if (b.category === 'cloned' && a.category !== 'cloned') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ voices: sorted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки голосов';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
