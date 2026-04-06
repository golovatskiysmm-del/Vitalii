import axios from 'axios';
import * as cheerio from 'cheerio';

export interface InstagramSlide {
  type: 'image' | 'video';
  url: string;           // original CDN URL
  storedUrl?: string;    // our stored copy on Vercel Blob / local
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export interface InstagramPostData {
  shortcode: string;
  caption: string;
  slides: InstagramSlide[];
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  authorUsername?: string;
  authorFullName?: string;
  isCarousel: boolean;
  embedHtml?: string;    // Instagram oEmbed HTML for iframe display
}

const IG_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Referer': 'https://www.instagram.com/',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match)
    throw new Error(
      'Некорректный Instagram URL. Формат: https://www.instagram.com/p/КОД/'
    );
  return match[1];
}

/** Try to download an image and return a buffer */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': IG_HEADERS['User-Agent'], Referer: 'https://www.instagram.com/' },
    });
    return Buffer.from(res.data as ArrayBuffer);
  } catch {
    return null;
  }
}

/** Store image in Vercel Blob (prod) or local /public/cached (dev) */
async function storeImage(
  buffer: Buffer,
  filename: string,
  contentType = 'image/jpeg'
): Promise<string | null> {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const blob = await put(`instagram/${filename}`, buffer, {
        access: 'public',
        contentType,
      });
      return blob.url;
    }
    // Dev: write to public/cached
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'public', 'cached');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return `/cached/${filename}`;
  } catch {
    return null;
  }
}

/** Parse carousel images from Instagram embed page HTML */
function parseEmbedImages(html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  // Embedded media images
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (
      src.includes('cdninstagram') ||
      src.includes('fbcdn') ||
      src.includes('instagram.f')
    ) {
      urls.push(src);
    }
  });

  // JSON in script tags
  $('script[type="application/json"]').each((_, el) => {
    try {
      const text = $(el).text();
      const allUrls = [...text.matchAll(/"(https:\/\/[^"]+(?:cdninstagram|fbcdn)[^"]+\.jpg[^"]*)"/g)];
      for (const m of allUrls) urls.push(m[1]);
    } catch {
      //
    }
  });

  // Deduplicate
  return [...new Set(urls)].filter((u) => !u.includes('profile_pic') && u.length > 20);
}

export async function scrapeInstagramPost(url: string): Promise<InstagramPostData> {
  const shortcode = extractShortcode(url);

  let caption = '';
  let authorUsername: string | undefined;
  let embedHtml: string | undefined;
  const slides: InstagramSlide[] = [];

  // ── Method 1: oEmbed ────────────────────────────────────────────────────
  try {
    const res = await axios.get(
      `https://www.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`,
      { timeout: 10000, headers: { 'User-Agent': IG_HEADERS['User-Agent'] } }
    );
    caption = res.data.title || '';
    authorUsername = res.data.author_name;
    embedHtml = res.data.html;

    if (res.data.thumbnail_url) {
      slides.push({ type: 'image', url: res.data.thumbnail_url });
    }
  } catch {
    // Continue
  }

  // ── Method 2: Embed page HTML → extract CDN image URLs ─────────────────
  try {
    const embedRes = await axios.get(
      `https://www.instagram.com/p/${shortcode}/embed/captioned/?cr=1&v=14`,
      { timeout: 12000, headers: IG_HEADERS }
    );
    const foundUrls = parseEmbedImages(embedRes.data as string);
    for (const u of foundUrls) {
      if (!slides.find((s) => s.url === u)) {
        slides.push({ type: 'image', url: u });
      }
    }
  } catch {
    // Continue
  }

  // ── Method 3: ?__a=1 JSON API ───────────────────────────────────────────
  if (slides.length <= 1) {
    try {
      const res = await axios.get(
        `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
        {
          timeout: 10000,
          headers: {
            ...IG_HEADERS,
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20A362 Instagram/303.0',
            'X-Instagram-AJAX': '1',
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
      );
      const items = res.data?.items || res.data?.graphql?.shortcode_media;
      if (items) {
        const item = Array.isArray(items) ? items[0] : items;
        const parsed = parseApiItem(shortcode, item);
        if (parsed.caption && !caption) caption = parsed.caption;
        if (parsed.authorUsername && !authorUsername) authorUsername = parsed.authorUsername;
        for (const s of parsed.slides) {
          if (!slides.find((x) => x.url === s.url)) slides.push(s);
        }
      }
    } catch {
      // Continue
    }
  }

  // ── Download & store images ─────────────────────────────────────────────
  const storedSlides: InstagramSlide[] = [];
  for (let i = 0; i < Math.min(slides.length, 10); i++) {
    const slide = slides[i];
    if (!slide.url) { storedSlides.push(slide); continue; }

    const buf = await fetchImageBuffer(slide.url);
    if (buf) {
      const ext = slide.url.includes('.mp4') ? 'mp4' : 'jpg';
      const stored = await storeImage(buf, `${shortcode}_${i}.${ext}`);
      storedSlides.push({ ...slide, storedUrl: stored || undefined });
    } else {
      storedSlides.push(slide);
    }
  }

  return {
    shortcode,
    caption,
    slides: storedSlides.length > 0 ? storedSlides : slides,
    isCarousel: storedSlides.length > 1,
    authorUsername,
    embedHtml,
  };
}

function parseApiItem(shortcode: string, item: Record<string, unknown>): InstagramPostData {
  const isCarousel = item.media_type === 8 || item.__typename === 'GraphSidecar';
  const slides: InstagramSlide[] = [];

  const bestFromCandidates = (
    candidates: { url: string; width: number; height: number }[]
  ) => candidates.reduce((a, b) => (b.width > (a?.width || 0) ? b : a), candidates[0]);

  if (isCarousel) {
    const carouselMedia =
      (item.carousel_media as Record<string, unknown>[]) ||
      ((item.edge_sidecar_to_children as { edges: { node: Record<string, unknown> }[] })?.edges?.map(
        (e) => e.node
      ));
    for (const media of carouselMedia || []) {
      const isVideo = media.media_type === 2 || media.is_video === true;
      const candidates =
        (media.image_versions2 as { candidates?: { url: string; width: number; height: number }[] })?.candidates ||
        ((media.display_resources as { src: string; config_width: number; config_height: number }[]) || []).map((r) => ({
          url: r.src,
          width: r.config_width,
          height: r.config_height,
        }));
      const best = candidates.length ? bestFromCandidates(candidates) : null;
      const fallbackUrl = (media.display_url as string) || '';
      slides.push({
        type: isVideo ? 'video' : 'image',
        url: best?.url || fallbackUrl,
        width: best?.width,
        height: best?.height,
      });
    }
  } else {
    const isVideo = item.media_type === 2 || item.is_video === true;
    const candidates =
      (item.image_versions2 as { candidates?: { url: string; width: number; height: number }[] })?.candidates ||
      ((item.display_resources as { src: string; config_width: number; config_height: number }[]) || []).map((r) => ({
        url: r.src,
        width: r.config_width,
        height: r.config_height,
      }));
    const best = candidates.length ? bestFromCandidates(candidates) : null;
    slides.push({
      type: isVideo ? 'video' : 'image',
      url: best?.url || (item.display_url as string) || '',
    });
  }

  const captionText =
    (item.caption as { text?: string } | null)?.text ||
    (item.edge_media_to_caption as { edges: { node: { text: string } }[] })?.edges?.[0]?.node?.text ||
    '';

  return {
    shortcode,
    caption: captionText,
    slides,
    isCarousel,
    authorUsername:
      (item.user as { username?: string })?.username ||
      (item.owner as { username?: string })?.username,
  };
}
