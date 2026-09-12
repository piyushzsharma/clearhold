import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    const escrows = await prisma.escrow.findMany({
      where: {
        OR: [
          { buyerId: session.user.id },
          { sellerId: session.user.id }
        ]
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        priceCents: true,
        status: true,
        verificationDeadline: true,
        createdAt: true,
        title: true,
        buyerId: true,
        sellerId: true,
        buyer: { select: { name: true, id: true } },
        seller: { select: { name: true, id: true } }
      }
    });

    let nextCursor = null;
    if (escrows.length > limit) {
      const nextItem = escrows.pop();
      nextCursor = nextItem?.id || null;
    }

    const serializedEscrows = escrows.map(e => ({
      ...e,
      priceCents: e.priceCents.toString()
    }));

    return NextResponse.json({ escrows: serializedEscrows, nextCursor });
  } catch (error) {
    console.error('Error fetching escrows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
