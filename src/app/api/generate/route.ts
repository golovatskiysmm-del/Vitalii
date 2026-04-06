import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeAndGenerate } from '@/lib/content-generator';
import { generateSlideImage, compositeAvatarOnImage } from '@/lib/image-generator';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { analyzedPostId, niche, tone, brandName, additionalInstructions, avatarId, generateImages } = await req.json();

    if (!analyzedPostId) {
      return NextResponse.json({ error: 'analyzedPostId is required' }, { status: 400 });
    }

    const analyzed = await prisma.analyzedPost.findUnique({ where: { id: analyzedPostId } });
    if (!analyzed) return NextResponse.json({ error: 'Analyzed post not found' }, { status: 404 });

    await prisma.analyzedPost.update({ where: { id: analyzedPostId }, data: { status: 'generating' } });

    const postData = {
      shortcode: analyzed.shortcode,
      caption: analyzed.caption || '',
      slides: JSON.parse(analyzed.slides),
      isCarousel: true,
      authorUsername: undefined,
    };

    // Generate content with Claude
    const generated = await analyzeAndGenerate(postData, { niche, tone, brandName, additionalInstructions });

    // Get active avatar if requested
    let avatarPath: string | null = null;
    if (avatarId) {
      const avatar = await prisma.avatar.findUnique({ where: { id: avatarId } });
      avatarPath = avatar?.imagePath || null;
    } else {
      const activeAvatar = await prisma.avatar.findFirst({ where: { isActive: true } });
      avatarPath = activeAvatar?.imagePath || null;
    }

    // Generate images for each slide
    const slidesWithImages = await Promise.all(
      generated.slides.map(async (slide, i) => {
        let imagePath: string | undefined;

        if (generateImages && process.env.OPENAI_API_KEY) {
          try {
            imagePath = await generateSlideImage(slide.imagePrompt);

            // Composite avatar on image if available
            if (avatarPath) {
              try {
                imagePath = await compositeAvatarOnImage(imagePath, avatarPath, 'bottom-left');
              } catch {
                // Avatar composite failed, use image without avatar
              }
            }
          } catch {
            imagePath = undefined;
          }
        }

        return { ...slide, imageUrl: imagePath, index: i };
      })
    );

    const caption = `${generated.caption}\n\n${generated.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`;

    const carousel = await prisma.carousel.create({
      data: {
        analyzedPostId,
        caption,
        slides: JSON.stringify(slidesWithImages),
        status: 'draft',
      },
    });

    await prisma.analyzedPost.update({ where: { id: analyzedPostId }, data: { status: 'generated' } });

    return NextResponse.json({
      id: carousel.id,
      caption,
      slides: slidesWithImages,
      niche: generated.niche,
      tone: generated.tone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
