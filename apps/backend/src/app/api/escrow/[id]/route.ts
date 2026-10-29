import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';

async function handler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
  principal: Principal,
) {
  try {
    const { id } = await params;

    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        priceCents: true,
        buyerId: true,
        sellerId: true,
        status: true,
        createdAt: true,
        verificationDeadline: true,
        version: true,
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        events: {
          select: { id: true, type: true, createdAt: true, actorId: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!escrow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Security check: Must be buyer, seller, or admin
    if (
      escrow.buyerId !== principal.id &&
      escrow.sellerId !== principal.id &&
      principal.platformRole !== 'ADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serializedEscrow = {
      ...escrow,
      priceCents: escrow.priceCents.toString()
    };

    return NextResponse.json({ escrow: serializedEscrow });
  } catch (error) {
    console.error('Error fetching escrow details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuthorization(handler);
