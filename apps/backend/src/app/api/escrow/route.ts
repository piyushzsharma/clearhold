import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';

async function handler(req: Request, _context: unknown, principal: Principal) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);

    const escrows = await prisma.escrowTransaction.findMany({
      where: {
        OR: [
          { buyerId: principal.id },
          { sellerId: principal.id }
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

export const GET = withAuthorization(handler, { platformRoles: ['USER'] });
