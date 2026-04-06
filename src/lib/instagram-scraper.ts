import axios from 'axios';

export interface InstagramSlide {
  type: 'image' | 'video';
  url: string;
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
  slideCount?: number; // user-provided slide count hint
}

function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Некорректный Instagram URL. Ожидаемый формат: https://www.instagram.com/p/КОД/');
  return match[1];
}

export async function scrapeInstagramPost(url: string): Promise<InstagramPostData> {
  const shortcode = extractShortcode(url);

  // Method 1: Instagram oEmbed API (no auth required)
  try {
    const oembedRes = await axios.get(
      `https://www.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    const oembed = oembedRes.data;

    const slides: InstagramSlide[] = [];
    if (oembed.thumbnail_url) {
      slides.push({ type: 'image', url: oembed.thumbnail_url });
    }

    return {
      shortcode,
      caption: oembed.title || '',
      slides,
      authorUsername: oembed.author_name,
      isCarousel: false, // oEmbed doesn't tell us
    };
  } catch {
    // Continue to next method
  }

  // Method 2: Try Instagram's ?__a=1 JSON endpoint
  try {
    const res = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (res.data?.items?.[0]) {
      const item = res.data.items[0];
      return parseApiItem(shortcode, item);
    }
  } catch {
    // Continue to next method
  }

  // Fallback: return empty data so the user can still generate
  return {
    shortcode,
    caption: '',
    slides: [],
    isCarousel: true,
    authorUsername: undefined,
  };
}

function parseApiItem(shortcode: string, item: Record<string, unknown>): InstagramPostData {
  const isCarousel = item.media_type === 8;
  const slides: InstagramSlide[] = [];

  if (isCarousel && Array.isArray(item.carousel_media)) {
    for (const media of item.carousel_media as Record<string, unknown>[]) {
      const isVideo = media.media_type === 2;
      if (isVideo) {
        const thumb = (media.image_versions2 as { candidates?: { url: string }[] })?.candidates?.[0]?.url;
        slides.push({ type: 'video', url: thumb || '' });
      } else {
        const candidates = (media.image_versions2 as { candidates?: { url: string; width: number; height: number }[] })?.candidates || [];
        const best = candidates.reduce((a, b) => (b.width > (a?.width || 0) ? b : a), candidates[0]);
        slides.push({ type: 'image', url: best?.url || '', width: best?.width, height: best?.height });
      }
    }
  } else {
    const isVideo = item.media_type === 2;
    const candidates = (item.image_versions2 as { candidates?: { url: string; width: number; height: number }[] })?.candidates || [];
    const best = candidates.reduce((a, b) => (b.width > (a?.width || 0) ? b : a), candidates[0]);
    slides.push({ type: isVideo ? 'video' : 'image', url: best?.url || '' });
  }

  const captionText = (item.caption as { text?: string } | null)?.text || '';

  return {
    shortcode,
    caption: captionText,
    slides,
    isCarousel,
    authorUsername: (item.user as { username?: string })?.username,
  };
}
