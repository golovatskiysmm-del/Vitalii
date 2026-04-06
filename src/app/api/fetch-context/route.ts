export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

function extractNotionPageId(url: string): string | null {
  // Match 32-char hex or UUID format at the end of the URL
  const cleaned = url.split('?')[0].replace(/-/g, '');
  const match = cleaned.match(/([a-f0-9]{32})$/i);
  return match ? match[1] : null;
}

function convertGoogleDocsUrl(url: string): string | null {
  // https://docs.google.com/document/d/ID/edit → export as txt
  const match = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'URL обязателен' }, { status: 400 });
    }

    const trimmedUrl = url.trim();

    // ── Google Docs ──────────────────────────────────────────────────────────
    if (trimmedUrl.includes('docs.google.com/document')) {
      const exportUrl = convertGoogleDocsUrl(trimmedUrl);
      if (!exportUrl) {
        return NextResponse.json({ error: 'Не удалось распознать ссылку Google Docs' }, { status: 400 });
      }
      try {
        const res = await axios.get(exportUrl, {
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          responseType: 'text',
        });
        const text = (res.data as string).trim();
        if (!text) return NextResponse.json({ error: 'Документ пустой или закрыт' }, { status: 422 });
        return NextResponse.json({ text, title: 'Google Docs' });
      } catch {
        return NextResponse.json({
          error: 'Не удалось загрузить Google Doc. Убедитесь, что документ открыт (доступ "для всех по ссылке")',
        }, { status: 422 });
      }
    }

    // ── Notion ───────────────────────────────────────────────────────────────
    if (trimmedUrl.includes('notion.so') || trimmedUrl.includes('notion.site')) {
      const pageId = extractNotionPageId(trimmedUrl);
      if (!pageId) {
        return NextResponse.json({ error: 'Не удалось определить ID страницы Notion' }, { status: 400 });
      }

      // Try unofficial Notion API (works for public pages)
      try {
        const res = await axios.get(`https://notion-api.splitbee.io/v1/page/${pageId}`, {
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        const blocks = res.data as Record<string, { value: { type: string; properties?: { title?: [string[]] } } }>;
        const textParts: string[] = [];

        for (const block of Object.values(blocks)) {
          const bv = block?.value;
          if (!bv) continue;
          const titleArr = bv.properties?.title;
          if (titleArr) {
            const text = titleArr.map((t) => t[0]).join('');
            if (text.trim()) textParts.push(text);
          }
        }

        const text = textParts.join('\n').trim();
        if (!text) return NextResponse.json({ error: 'Страница Notion пустая или недоступна' }, { status: 422 });
        return NextResponse.json({ text, title: 'Notion' });
      } catch {
        return NextResponse.json({
          error: 'Не удалось загрузить Notion. Убедитесь, что страница публичная (Share → Publish to web)',
        }, { status: 422 });
      }
    }

    // ── Generic URL ──────────────────────────────────────────────────────────
    const response = await axios.get(trimmedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru,en;q=0.9',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data as string;
    const $ = cheerio.load(html);

    $('script, style, nav, header, footer, iframe, noscript, [aria-hidden="true"]').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    let text = '';
    for (const sel of ['main', 'article', '[role="main"]', '.content', '#content', '.post-content', '.entry-content']) {
      const el = $(sel);
      if (el.length) { text = el.text(); break; }
    }
    if (!text) text = $('body').text();

    text = text.replace(/\t/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    if (!text) {
      return NextResponse.json({ error: 'Не удалось извлечь текст со страницы' }, { status: 422 });
    }

    return NextResponse.json({ text, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
