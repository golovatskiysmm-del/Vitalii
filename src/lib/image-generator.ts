import OpenAI from 'openai';
import axios from 'axios';
import sharp from 'sharp';
import { saveImage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSlideImage(prompt: string, style?: string): Promise<string> {
  const enhancedPrompt = `${prompt}. Style: ${style || 'modern, clean, professional, Instagram-ready, high quality, vibrant colors'}. No text, no words, no letters in the image.`;

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

  // Download and save
  const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const buffer = await sharp(Buffer.from(imgRes.data)).jpeg({ quality: 90 }).toBuffer();

  return saveImage(buffer, 'jpg');
}

export async function compositeAvatarOnImage(
  baseImageUrl: string,
  avatarUrl: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-left'
): Promise<string> {
  const [baseRes, avatarRes] = await Promise.all([
    axios.get(baseImageUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${baseImageUrl}` : baseImageUrl, { responseType: 'arraybuffer', timeout: 30000 }),
    axios.get(avatarUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${avatarUrl}` : avatarUrl, { responseType: 'arraybuffer', timeout: 30000 }),
  ]);

  const baseBuffer = Buffer.from(baseRes.data);
  const avatarBuffer = Buffer.from(avatarRes.data);

  const baseImage = sharp(baseBuffer);
  const { width = 1024, height = 1024 } = await baseImage.metadata();

  const avatarSize = Math.round(Math.min(width, height) * 0.18);
  const margin = Math.round(avatarSize * 0.25);

  // Crop avatar to circle
  const circleBuffer = Buffer.from(
    `<svg width="${avatarSize}" height="${avatarSize}">
      <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="white"/>
    </svg>`
  );

  const avatarResized = await sharp(avatarBuffer)
    .resize(avatarSize, avatarSize, { fit: 'cover' })
    .composite([{ input: circleBuffer, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Add white border ring
  const ringSize = avatarSize + 6;
  const ringBuffer = Buffer.from(
    `<svg width="${ringSize}" height="${ringSize}">
      <circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2}" fill="white"/>
    </svg>`
  );

  const avatarWithRing = await sharp(ringBuffer)
    .composite([{ input: avatarResized, gravity: 'center' }])
    .png()
    .toBuffer();

  const positions = {
    'top-left': { left: margin, top: margin },
    'top-right': { left: width - ringSize - margin, top: margin },
    'bottom-left': { left: margin, top: height - ringSize - margin },
    'bottom-right': { left: width - ringSize - margin, top: height - ringSize - margin },
  };

  const pos = positions[position];

  const resultBuffer = await baseImage
    .composite([{ input: avatarWithRing, left: pos.left, top: pos.top }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return saveImage(resultBuffer, 'jpg');
}

export async function downloadImageToLocal(url: string): Promise<string> {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = await sharp(Buffer.from(res.data)).jpeg({ quality: 90 }).toBuffer();
  return saveImage(buffer, 'jpg');
}
