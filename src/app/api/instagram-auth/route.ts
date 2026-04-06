import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateInstagramToken } from '@/lib/instagram-poster';

export async function GET() {
  try {
    const accounts = await prisma.instagramAccount.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(accounts.map((a) => ({ ...a, accessToken: '***' })));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, accountId, username } = await req.json();

    if (!accessToken || !accountId) {
      return NextResponse.json({ error: 'accessToken and accountId are required' }, { status: 400 });
    }

    // Validate the token
    let validatedUsername = username;
    try {
      const info = await validateInstagramToken(accountId, accessToken);
      validatedUsername = info.username;
    } catch {
      return NextResponse.json({ error: 'Invalid access token or account ID. Please check your credentials.' }, { status: 400 });
    }

    // Deactivate existing accounts
    await prisma.instagramAccount.updateMany({ data: { isActive: false } });

    const account = await prisma.instagramAccount.create({
      data: {
        username: validatedUsername || username || 'unknown',
        accessToken,
        accountId,
        isActive: true,
      },
    });

    return NextResponse.json({ ...account, accessToken: '***' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, isActive } = await req.json();
    if (isActive) await prisma.instagramAccount.updateMany({ data: { isActive: false } });
    const account = await prisma.instagramAccount.update({ where: { id }, data: { isActive } });
    return NextResponse.json({ ...account, accessToken: '***' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.instagramAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
