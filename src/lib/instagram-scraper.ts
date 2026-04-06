import axios from 'axios';

export interface InstagramSlide {
  type: 'image' | 'video';
  url: string;        // CDN URL (direct from Instagram oEmbed)
  storedUrl?: string; // stored copy if we managed to save it
  width?: number;
  height?: number;
}

export interface InstagramPostData {
  shortcode: string;
  caption: string;
  slides: InstagramSlide[];
  isCarousel: boolean;
  authorUsername?: string;
  embedHtml?: string;
}

function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match)
    throw new Error('Некорректный Instagram URL. Формат: https://www.instagram.com/p/КОД/');
  return match[1];
}

interface OembedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
}

async function fetchOembed(postUrl: string): Promise<OembedResponse | null> {
  try {
    const res = await axios.get('https://www.instagram.com/oembed/', {
      params: { url: postUrl },
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    return res.data as OembedResponse;
  } catch {
    return null;
  }
}

export async function scrapeInstagramPost(url: string): Promise<InstagramPostData> {
  const shortcode = extractShortcode(url);
  const baseUrl = `https://www.instagram.com/p/${shortcode}/`;

  // ── Get base post info ────────────────────────────────────────────────────
  const base = await fetchOembed(baseUrl);

  if (!base) {
    // oEmbed failed entirely — post is private or doesn't exist
    return {
      shortcode,
      caption: '',
      slides: [],
      isCarousel: false,
    };
  }

  const caption = base.title || '';
  const authorUsername = base.author_name;
  const embedHtml = base.html;

  const slides: InstagramSlide[] = [];
  const seenUrls = new Set<string>();

  if (base.thumbnail_url) {
    slides.push({
      type: 'image',
      url: base.thumbnail_url,
      width: base.thumbnail_width,
      height: base.thumbnail_height,
    });
    seenUrls.add(base.thumbnail_url);
  }

  // ── Fetch each carousel slide via ?img_index=N ────────────────────────────
  // Instagram oEmbed supports img_index — returns the thumbnail for that specific slide.
  // We fetch indices 2..15 in parallel batches and stop when we see repeats.
  const MAX_SLIDES = 15;

  // Try slides 2 to MAX_SLIDES in batches of 4 to avoid hammering Instagram
  for (let batchStart = 2; batchStart <= MAX_SLIDES; batchStart += 4) {
    const batchEnd = Math.min(batchStart + 3, MAX_SLIDES);
    const batch = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

    const results = await Promise.all(
      batch.map((idx) =>
        fetchOembed(`${baseUrl}?img_index=${idx}`)
      )
    );

    let anyNew = false;
    for (const oembed of results) {
      if (!oembed?.thumbnail_url) continue;
      if (seenUrls.has(oembed.thumbnail_url)) continue; // duplicate = no more slides
      seenUrls.add(oembed.thumbnail_url);
      slides.push({
        type: 'image',
        url: oembed.thumbnail_url,
        width: oembed.thumbnail_width,
        height: oembed.thumbnail_height,
      });
      anyNew = true;
    }

    // If no new slides in this batch, we've reached the end
    if (!anyNew) break;
  }

  return {
    shortcode,
    caption,
    slides,
    isCarousel: slides.length > 1,
    authorUsername,
    embedHtml,
  };
}
