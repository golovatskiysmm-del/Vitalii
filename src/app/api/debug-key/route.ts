export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY || '';

  // Show safe diagnostic info (never expose full key)
  const info = {
    exists: key.length > 0,
    length: key.length,
    prefix: key.slice(0, 10),        // first 10 chars
    suffix: key.slice(-4),            // last 4 chars
    startsCorrectly: key.startsWith('sk-ant-'),
    hasSpaces: key.includes(' '),
    hasNewline: key.includes('\n') || key.includes('\r'),
  };

  // Try a real API call
  let apiWorks = false;
  let apiError = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    if (res.ok) {
      apiWorks = true;
    } else {
      const data = await res.json();
      apiError = `${res.status}: ${JSON.stringify(data)}`;
    }
  } catch (e) {
    apiError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ info, apiWorks, apiError });
}
