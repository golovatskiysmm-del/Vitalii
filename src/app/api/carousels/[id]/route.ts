import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const carousel = await prisma.carousel.findUnique({
      where: { id: params.id },
      include: { analyzedPost: true },
    });
    if (!carousel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...carousel,
      slides: JSON.parse(carousel.slides),
      analyzedPost: carousel.analyzedPost
        ? { ...carousel.analyzedPost, slides: JSON.parse(carousel.analyzedPost.slides) }
        : null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { status, caption, slides, scheduledAt } = body;

    const updated = await prisma.carousel.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(caption && { caption }),
        ...(slides && { slides: JSON.stringify(slides) }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      },
    });

    return NextResponse.json({ ...updated, slides: JSON.parse(updated.slides) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.carousel.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
