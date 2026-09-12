import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

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
      escrow.buyerId !== session.user.id &&
      escrow.sellerId !== session.user.id &&
      session.user.role !== 'admin'
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
