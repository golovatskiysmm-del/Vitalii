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
}

function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Invalid Instagram URL. Expected format: https://www.instagram.com/p/CODE/');
  return match[1];
}

function getBestImage(candidates: { url: string; width?: number; height?: number }[]): { url: string; width?: number; height?: number } {
  return candidates.reduce((best, c) => (!best || (c.width || 0) > (best.width || 0) ? c : best), candidates[0]);
}

export async function scrapeInstagramPost(url: string): Promise<InstagramPostData> {
  const shortcode = extractShortcode(url);

  // Try Instagram oEmbed (works without auth, returns limited data)
  try {
    const oembedRes = await axios.get(
      `https://www.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`,
      { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const oembed = oembedRes.data;

    // oEmbed doesn't give us carousel slides, just the thumbnail
    // Return what we have — the generator will use Claude vision on available images
    return {
      shortcode,
      caption: oembed.title || '',
      slides: [{ type: 'image', url: oembed.thumbnail_url }],
      authorUsername: oembed.author_name,
      isCarousel: false,
    };
  } catch {
    // Fallback: try scraping the page
  }

  // Try scraping the page HTML for embedded JSON
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
      Referer: 'https://www.instagram.com/',
    };

    const res = await axios.get(`https://www.instagram.com/p/${shortcode}/`, {
      headers,
      timeout: 15000,
    });

    const html: string = res.data;

    // Extract embedded JSON from __additionalDataLoaded or similar
    const jsonMatch = html.match(/"shortcode_media"\s*:\s*(\{.+?\})\s*[,}]/s);
    if (jsonMatch) {
      const media = JSON.parse(jsonMatch[1]);
      return parseMediaObject(shortcode, media);
    }

    // Try window._sharedData
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});<\/script>/s);
    if (sharedDataMatch) {
      const sharedData = JSON.parse(sharedDataMatch[1]);
      const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (media) return parseMediaObject(shortcode, media);
    }

    throw new Error('Could not extract post data from page');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to scrape Instagram post: ${message}. Make sure the post is public.`);
  }
}

function parseMediaObject(shortcode: string, media: Record<string, unknown>): InstagramPostData {
  const isCarousel = media.__typename === 'GraphSidecar';
  const slides: InstagramSlide[] = [];

  if (isCarousel) {
    const edges = (media.edge_sidecar_to_children as { edges: { node: Record<string, unknown> }[] }).edges;
    for (const edge of edges) {
      const node = edge.node as Record<string, unknown>;
      const isVideo = node.is_video as boolean;
      const resources = (node.display_resources as { src: string; config_width: number; config_height: number }[]) || [];
      const best = resources.length ? getBestImage(resources.map((r) => ({ url: r.src, width: r.config_width, height: r.config_height }))) : { url: node.display_url as string };
      slides.push({
        type: isVideo ? 'video' : 'image',
        url: best.url,
        thumbnailUrl: node.display_url as string | undefined,
        width: best.width,
        height: best.height,
      });
    }
  } else {
    const isVideo = media.is_video as boolean;
    const resources = (media.display_resources as { src: string; config_width: number; config_height: number }[]) || [];
    const best = resources.length ? getBestImage(resources.map((r) => ({ url: r.src, width: r.config_width, height: r.config_height }))) : { url: media.display_url as string };
    slides.push({
      type: isVideo ? 'video' : 'image',
      url: best.url,
      thumbnailUrl: media.display_url as string | undefined,
      width: best.width,
      height: best.height,
    });
  }

  const captionEdges = (media.edge_media_to_caption as { edges: { node: { text: string } }[] })?.edges;
  const caption = captionEdges?.[0]?.node?.text || '';

  return {
    shortcode,
    caption,
    slides,
    isCarousel,
    authorUsername: (media.owner as { username: string })?.username,
    authorFullName: (media.owner as { full_name: string })?.full_name,
    timestamp: media.taken_at_timestamp ? new Date((media.taken_at_timestamp as number) * 1000).toISOString() : undefined,
  };
}
