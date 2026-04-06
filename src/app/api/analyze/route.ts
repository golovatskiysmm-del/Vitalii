export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { scrapeInstagramPost } from '@/lib/instagram-scraper';
import { prisma } from '@/lib/db';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Укажите URL Instagram-поста' }, { status: 400 });
    }

    const postData = await scrapeInstagramPost(url);

    const analyzed = await prisma.analyzedPost.create({
      data: {
        instagramUrl: url,
        shortcode: postData.shortcode,
        caption: postData.caption,
        slides: JSON.stringify(postData.slides),
        status: 'analyzed',
      },
    });

    return NextResponse.json({
      id: analyzed.id,
      shortcode: postData.shortcode,
      caption: postData.caption,
      slides: postData.slides,        // contains CDN URLs — browser renders them directly
      isCarousel: postData.isCarousel,
      authorUsername: postData.authorUsername,
      embedHtml: postData.embedHtml,
      slideCount: postData.slides.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
