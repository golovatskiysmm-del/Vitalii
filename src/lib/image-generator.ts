import axios from 'axios';
import sharp from 'sharp';
import { saveImage } from './storage';

export type ImageProvider = 'dalle' | 'flux-schnell' | 'flux-dev';

// Lazy init
function getOpenAI() {
  const OpenAI = require('openai');
  return new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
}

function getReplicate() {
  const Replicate = require('replicate');
  return new Replicate.default({ auth: process.env.REPLICATE_API_TOKEN || '' });
}

export async function generateSlideImage(prompt: string, style?: string): Promise<string> {
  return generateSlideImageWithProvider(prompt, 'dalle', style);
}

export async function generateSlideImageWithProvider(
  prompt: string,
  provider: ImageProvider | 'none' = 'dalle',
  style?: string
): Promise<string> {
  const enhancedPrompt = `${prompt}. Style: ${style || 'modern, clean, professional, Instagram-ready, high quality, vibrant colors'}. No text, no words, no letters in the image.`;

  if (provider === 'dalle') {
    const openai = getOpenAI();
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error('No image URL returned from DALL-E');

    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = await sharp(Buffer.from(imgRes.data)).jpeg({ quality: 90 }).toBuffer();
    return saveImage(buffer, 'jpg');
  }

  if (provider === 'flux-schnell' || provider === 'flux-dev') {
    const replicate = getReplicate();
    const model = provider === 'flux-schnell'
      ? 'black-forest-labs/flux-schnell'
      : 'black-forest-labs/flux-dev';

    const output = await replicate.run(model, {
      input: {
        prompt: enhancedPrompt,
        aspect_ratio: '1:1',
        output_format: 'jpg',
        output_quality: 90,
        num_outputs: 1,
      },
    });

    // output is typically an array of URLs or a ReadableStream
    let imageUrl: string | undefined;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = typeof output[0] === 'string' ? output[0] : String(output[0]);
    } else if (typeof output === 'string') {
      imageUrl = output;
    }

    if (!imageUrl) throw new Error('No image URL returned from Replicate');

    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = await sharp(Buffer.from(imgRes.data)).jpeg({ quality: 90 }).toBuffer();
    return saveImage(buffer, 'jpg');
  }

  throw new Error(`Unknown image provider: ${provider}`);
}

export async function compositeAvatarOnImage(
  baseImageUrl: string,
  avatarUrl: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-left'
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resolveUrl = (u: string) => u.startsWith('/') ? `${appUrl}${u}` : u;

  const [baseRes, avatarRes] = await Promise.all([
    axios.get(resolveUrl(baseImageUrl), { responseType: 'arraybuffer', timeout: 30000 }),
    axios.get(resolveUrl(avatarUrl), { responseType: 'arraybuffer', timeout: 30000 }),
  ]);

  const baseBuffer = Buffer.from(baseRes.data);
  const avatarBuffer = Buffer.from(avatarRes.data);

  const baseImage = sharp(baseBuffer);
  const { width = 1024, height = 1024 } = await baseImage.metadata();

  const avatarSize = Math.round(Math.min(width, height) * 0.18);
  const margin = Math.round(avatarSize * 0.25);
  const ringSize = avatarSize + 6;

  const circleBuffer = Buffer.from(
    `<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="white"/></svg>`
  );
  const avatarResized = await sharp(avatarBuffer).resize(avatarSize, avatarSize, { fit: 'cover' }).composite([{ input: circleBuffer, blend: 'dest-in' }]).png().toBuffer();
  const ringBuffer = Buffer.from(
    `<svg width="${ringSize}" height="${ringSize}"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2}" fill="white"/></svg>`
  );
  const avatarWithRing = await sharp(ringBuffer).composite([{ input: avatarResized, gravity: 'center' }]).png().toBuffer();

  const positions = {
    'top-left': { left: margin, top: margin },
    'top-right': { left: width - ringSize - margin, top: margin },
    'bottom-left': { left: margin, top: height - ringSize - margin },
    'bottom-right': { left: width - ringSize - margin, top: height - ringSize - margin },
  };

  const resultBuffer = await baseImage
    .composite([{ input: avatarWithRing, left: positions[position].left, top: positions[position].top }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return saveImage(resultBuffer, 'jpg');
}
