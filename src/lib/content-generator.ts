import Anthropic from '@anthropic-ai/sdk';
import type { InstagramPostData } from './instagram-scraper';

// Lazy init - don't create client at module level
function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy' });
}

export interface GeneratedSlide {
  imagePrompt: string;
  heading: string;
  bodyText: string;
  imageUrl?: string;
}

export interface GeneratedCarousel {
  caption: string;
  hashtags: string[];
  slides: GeneratedSlide[];
  niche: string;
  tone: string;
}

export async function analyzeAndGenerate(
  post: InstagramPostData,
  userContext: {
    niche?: string;
    tone?: string;
    brandName?: string;
    additionalInstructions?: string;
  } = {}
): Promise<GeneratedCarousel> {
  const anthropic = getClient();

  const imageContents: Anthropic.ImageBlockParam[] = post.slides
    .filter((s) => s.type === 'image' && s.url)
    .slice(0, 10)
    .map((s) => ({
      type: 'image' as const,
      source: { type: 'url' as const, url: s.url },
    }));

  const textContext = `
Original Instagram post caption:
"${post.caption}"

Number of slides: ${post.slides.length}
Post type: ${post.isCarousel ? 'Carousel' : 'Single post'}
Author: ${post.authorUsername || 'unknown'}
  `.trim();

  const systemPrompt = `You are a professional Instagram content strategist and copywriter.
Your task is to analyze an Instagram carousel post and create a completely unique version for a different creator.
The content must be original, not a copy. Same topic/niche but different perspective, angles, examples, and wording.
Always respond with valid JSON only.`;

  const userPrompt = `Analyze this Instagram post and create a unique carousel for my account.

${textContext}

My context:
- Niche/Topic: ${userContext.niche || 'same niche as original'}
- Tone: ${userContext.tone || 'engaging, professional'}
- Brand name: ${userContext.brandName || 'my brand'}
- Additional instructions: ${userContext.additionalInstructions || 'none'}

Please analyze the images above and the caption, then create a UNIQUE carousel (not a copy).

Return a JSON object with this exact structure:
{
  "niche": "detected niche of original post",
  "tone": "tone used",
  "caption": "new Instagram caption (with emojis, max 300 chars)",
  "hashtags": ["hashtag1", "hashtag2", ...up to 15 hashtags],
  "slides": [
    {
      "heading": "slide heading (short, punchy, max 8 words)",
      "bodyText": "slide body text (2-4 lines, engaging)",
      "imagePrompt": "detailed DALL-E prompt for generating the slide image (describe visual style, colors, composition, NO text in image)"
    }
  ]
}

Create ${Math.min(post.slides.length, 7)} slides minimum. Make each slide stand alone but flow together as a story.`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        ...imageContents,
        { type: 'text', text: userPrompt },
      ],
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = response.content.find((c) => c.type === 'text')?.text || '';
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');

  return JSON.parse(jsonMatch[0]) as GeneratedCarousel;
}
