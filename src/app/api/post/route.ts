export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { postCarouselToInstagram } from '@/lib/instagram-poster';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { carouselId, scheduledAt } = await req.json();

    if (!carouselId) return NextResponse.json({ error: 'carouselId is required' }, { status: 400 });

    const carousel = await prisma.carousel.findUnique({ where: { id: carouselId } });
    if (!carousel) return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });

    const account = await prisma.instagramAccount.findFirst({ where: { isActive: true } });
    if (!account) {
      return NextResponse.json(
        { error: 'No active Instagram account configured. Please add your Instagram account in Settings.' },
        { status: 400 }
      );
    }

    // If scheduling for later
    if (scheduledAt) {
      const scheduled = new Date(scheduledAt);
      if (scheduled <= new Date()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
      }
      await prisma.carousel.update({
        where: { id: carouselId },
        data: { status: 'scheduled', scheduledAt: scheduled },
      });
      return NextResponse.json({ success: true, status: 'scheduled', scheduledAt });
    }

    // Post immediately
    const slides = JSON.parse(carousel.slides) as { imageUrl?: string; imagePath?: string }[];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const postSlides = slides
      .filter((s) => s.imageUrl || s.imagePath)
      .map((s) => ({ imagePath: s.imageUrl || s.imagePath || '', imageUrl: undefined }));

    if (postSlides.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 slides with images to post a carousel. Please generate images first.' },
        { status: 400 }
      );
    }

    await prisma.carousel.update({ where: { id: carouselId }, data: { status: 'posting' } });

    try {
      const mediaId = await postCarouselToInstagram({
        accountId: account.accountId,
        accessToken: account.accessToken,
        slides: postSlides,
        caption: carousel.caption,
        appUrl,
      });

      await prisma.carousel.update({
        where: { id: carouselId },
        data: { status: 'posted', postedAt: new Date(), instagramPostId: mediaId },
      });

      return NextResponse.json({ success: true, mediaId, status: 'posted' });
    } catch (postError) {
      await prisma.carousel.update({ where: { id: carouselId }, data: { status: 'approved' } });
      throw postError;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
