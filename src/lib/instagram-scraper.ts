import axios from 'axios';

export interface InstagramSlide {
  type: 'image' | 'video';
  url: string;
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
  embedUrl?: string; // iframe URL for direct browser embed
}

function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match)
    throw new Error('Некорректный Instagram URL. Формат: https://www.instagram.com/p/КОД/');
  return match[1];
}

export async function scrapeInstagramPost(url: string): Promise<InstagramPostData> {
  const shortcode = extractShortcode(url);

  let caption = '';
  let authorUsername: string | undefined;
  let embedHtml: string | undefined;

  // Try oEmbed for caption + author (lightweight call)
  try {
    const res = await axios.get('https://www.instagram.com/oembed/', {
      params: { url: `https://www.instagram.com/p/${shortcode}/` },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; oEmbed/1.0)',
      },
    });
    caption = res.data.title || '';
    authorUsername = res.data.author_name;
    embedHtml = res.data.html;
  } catch {
    // oEmbed failed — caption will be empty, but embed iframe still works
  }

  // The embed iframe URL is public and always works in the browser
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;

  return {
    shortcode,
    caption,
    slides: [],  // We don't fetch slide images server-side (Instagram blocks Vercel IPs)
    isCarousel: true,
    authorUsername,
    embedHtml,
    embedUrl,
  };
}
