import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// This endpoint returns scheduled posts that are due, for a cron job to trigger
export async function GET() {
  try {
    const now = new Date();
    const due = await prisma.carousel.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
    });
    return NextResponse.json(due.map((c) => ({ ...c, slides: JSON.parse(c.slides) })));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Trigger scheduled posts manually (for serverless environments without cron)
export async function POST(req: NextRequest) {
  try {
    const { carouselId, scheduledAt } = await req.json();

    if (carouselId && scheduledAt) {
      const carousel = await prisma.carousel.update({
        where: { id: carouselId },
        data: { status: 'scheduled', scheduledAt: new Date(scheduledAt) },
      });
      return NextResponse.json({ ...carousel, slides: JSON.parse(carousel.slides) });
    }

    // Process all due scheduled posts
    const now = new Date();
    const due = await prisma.carousel.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
    });

    const results = [];
    for (const carousel of due) {
      try {
        // Trigger posting via the post API
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carouselId: carousel.id }),
        });
        const data = await res.json();
        results.push({ id: carousel.id, ...data });
      } catch (err) {
        results.push({ id: carousel.id, error: String(err) });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
