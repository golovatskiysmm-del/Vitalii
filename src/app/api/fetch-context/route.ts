import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  try {
    const { url, type, notionToken } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (type === 'notion' || (type === 'url' && url.includes('notion.so') && notionToken)) {
      // Notion API
      const pageIdMatch = url.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (!pageIdMatch) {
        return NextResponse.json({ error: 'Не удалось определить ID страницы Notion' }, { status: 400 });
      }
      const pageId = pageIdMatch[1].replace(/-/g, '');

      const blocksRes = await axios.get(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
        },
        timeout: 15000,
      });

      const blocks = blocksRes.data.results || [];
      const textParts: string[] = [];

      for (const block of blocks) {
        const bt = block.type;
        const content = block[bt];
        if (content?.rich_text) {
          const text = content.rich_text.map((rt: { plain_text: string }) => rt.plain_text).join('');
          if (text.trim()) textParts.push(text);
        }
      }

      return NextResponse.json({ text: textParts.join('\n'), title: 'Notion страница' });
    }

    // Generic URL fetch + cheerio text extraction
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarouselBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data as string;
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, header, footer, iframe, noscript, [aria-hidden="true"]').remove();

    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    // Get main content
    let text = '';
    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post-content', '.entry-content'];
    for (const sel of mainSelectors) {
      const el = $(sel);
      if (el.length) {
        text = el.text();
        break;
      }
    }
    if (!text) {
      text = $('body').text();
    }

    // Clean up whitespace
    text = text
      .replace(/\t/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text) {
      return NextResponse.json({ error: 'Не удалось извлечь текст со страницы' }, { status: 422 });
    }

    return NextResponse.json({ text, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
