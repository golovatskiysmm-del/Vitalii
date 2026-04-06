import axios from 'axios';
import sharp from 'sharp';
import { saveImage } from './storage';

export type ImageProvider = 'dalle' | 'flux-schnell' | 'flux-dev' | 'flux-pro' | 'ideogram' | 'sdxl';

// Lazy init
function getOpenAI() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require('openai');
  return new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
}

function getReplicate() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const baseStyle = style || 'modern, clean, visually stunning, professional Instagram carousel slide, vibrant colors, high contrast';
  const enhancedPrompt = `${prompt}. Visual style: ${baseStyle}. NO text, NO words, NO letters in the image.`;

  // ── DALL-E 3 ─────────────────────────────────────────────────────────────
  if (provider === 'dalle') {
    const openai = getOpenAI();
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'url',
    });
    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error('DALL-E не вернул изображение');
    return downloadAndSave(imageUrl);
  }

  // ── Flux Schnell / Dev / Pro (Replicate) ─────────────────────────────────
  if (provider === 'flux-schnell' || provider === 'flux-dev' || provider === 'flux-pro') {
    const replicate = getReplicate();
    const modelMap: Record<string, string> = {
      'flux-schnell': 'black-forest-labs/flux-schnell',
      'flux-dev': 'black-forest-labs/flux-dev',
      'flux-pro': 'black-forest-labs/flux-1.1-pro',
    };
    const model = modelMap[provider];
    const output = await replicate.run(model, {
      input: {
        prompt: enhancedPrompt,
        aspect_ratio: '1:1',
        output_format: 'jpg',
        output_quality: 95,
        num_outputs: 1,
      },
    });
    const imageUrl = Array.isArray(output) ? String(output[0]) : String(output);
    if (!imageUrl) throw new Error('Replicate не вернул изображение');
    return downloadAndSave(imageUrl);
  }

  // ── Stable Diffusion XL (Replicate) ──────────────────────────────────────
  if (provider === 'sdxl') {
    const replicate = getReplicate();
    const output = await replicate.run('stability-ai/sdxl:39ed52f2319f9c78c9890f4a86ff2d8b38fd7b9f23c5c0b73e92b1c36e06d8c8', {
      input: {
        prompt: enhancedPrompt,
        negative_prompt: 'text, watermark, blurry, low quality, ugly',
        width: 1024,
        height: 1024,
        num_outputs: 1,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    });
    const imageUrl = Array.isArray(output) ? String(output[0]) : String(output);
    if (!imageUrl) throw new Error('SDXL не вернул изображение');
    return downloadAndSave(imageUrl);
  }

  // ── Ideogram v2 (best for social media + text in images) ─────────────────
  if (provider === 'ideogram') {
    const apiKey = process.env.IDEOGRAM_API_KEY;
    if (!apiKey) throw new Error('IDEOGRAM_API_KEY не задан');

    const res = await axios.post(
      'https://api.ideogram.ai/generate',
      {
        image_request: {
          prompt: enhancedPrompt,
          aspect_ratio: 'ASPECT_1_1',
          model: 'V_2',
          magic_prompt_option: 'AUTO',
        },
      },
      {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const imageUrl = res.data?.data?.[0]?.url;
    if (!imageUrl) throw new Error('Ideogram не вернул изображение');
    return downloadAndSave(imageUrl);
  }

  throw new Error(`Неизвестный провайдер изображений: ${provider}`);
}

async function downloadAndSave(url: string): Promise<string> {
  const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  const buffer = await sharp(Buffer.from(imgRes.data as ArrayBuffer))
    .jpeg({ quality: 92 })
    .toBuffer();
  return saveImage(buffer, 'jpg');
}

export async function compositeAvatarOnImage(
  baseImageUrl: string,
  avatarUrl: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-left'
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resolveUrl = (u: string) => (u.startsWith('/') ? `${appUrl}${u}` : u);

  const [baseRes, avatarRes] = await Promise.all([
    axios.get(resolveUrl(baseImageUrl), { responseType: 'arraybuffer', timeout: 30000 }),
    axios.get(resolveUrl(avatarUrl), { responseType: 'arraybuffer', timeout: 30000 }),
  ]);

  const baseBuffer = Buffer.from(baseRes.data as ArrayBuffer);
  const avatarBuffer = Buffer.from(avatarRes.data as ArrayBuffer);

  const baseImage = sharp(baseBuffer);
  const { width = 1024, height = 1024 } = await baseImage.metadata();

  const avatarSize = Math.round(Math.min(width, height) * 0.18);
  const margin = Math.round(avatarSize * 0.25);
  const ringSize = avatarSize + 6;

  const circleBuffer = Buffer.from(
    `<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="white"/></svg>`
  );
  const avatarResized = await sharp(avatarBuffer)
    .resize(avatarSize, avatarSize, { fit: 'cover' })
    .composite([{ input: circleBuffer, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const ringBuffer = Buffer.from(
    `<svg width="${ringSize}" height="${ringSize}"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2}" fill="white"/></svg>`
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

  const resultBuffer = await baseImage
    .composite([{ input: avatarWithRing, left: positions[position].left, top: positions[position].top }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return saveImage(resultBuffer, 'jpg');
}
