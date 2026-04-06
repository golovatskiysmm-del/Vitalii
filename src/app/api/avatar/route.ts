export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import sharp from 'sharp';
import { saveUpload } from '@/lib/storage';

export async function GET() {
  try {
    const avatars = await prisma.avatar.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(avatars);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || 'My Avatar';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    // Resize and crop to square
    const buffer = await sharp(rawBuffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();

    const imagePath = await saveUpload(buffer, 'avatar', 'jpg');

    const avatar = await prisma.avatar.create({
      data: { name, imagePath, isActive: false },
    });

    return NextResponse.json(avatar);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, isActive, name } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (isActive) {
      await prisma.avatar.updateMany({ data: { isActive: false } });
    }

    const avatar = await prisma.avatar.update({
      where: { id },
      data: { ...(isActive !== undefined && { isActive }), ...(name && { name }) },
    });

    return NextResponse.json(avatar);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.avatar.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
