export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const carousels = await prisma.carousel.findMany({
      orderBy: { createdAt: 'desc' },
      include: { analyzedPost: true },
    });

    return NextResponse.json(
      carousels.map((c) => ({
        ...c,
        slides: JSON.parse(c.slides),
        analyzedPost: c.analyzedPost
          ? { ...c.analyzedPost, slides: JSON.parse(c.analyzedPost.slides) }
          : null,
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
