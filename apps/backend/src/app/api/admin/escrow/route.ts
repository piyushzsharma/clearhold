import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuthorization } from '@/lib/authorization';
import { z } from 'zod';

async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20) || 20, 1), 100);
    const status = z.enum(['DISPUTED', 'RELEASED', 'REFUNDED', 'PARTIAL_REFUND']).nullable().parse(searchParams.get('status'));

    const whereClause: any = { status: 'DISPUTED' };
    if (status) {
      whereClause.status = status;
    }

    const escrows = await prisma.escrowTransaction.findMany({
      where: whereClause,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        priceCents: true,
        status: true,
        version: true,
        verificationDeadline: true,
        createdAt: true,
        title: true,
        buyerId: true,
        sellerId: true,
        buyer: { select: { name: true, id: true, email: true } },
        seller: { select: { name: true, id: true, email: true } },
        events: { select: { type: true, metadata: true, createdAt: true, actor: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
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
    console.error('Error fetching admin escrows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuthorization(handler, { platformRoles: ['ADMIN'] });
