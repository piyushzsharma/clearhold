import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withIdempotency } from '@/lib/idempotency';
import { reserveEscrowFunds } from '@/lib/ledger';
import { inngest } from '@/lib/inngest';
import { z } from 'zod';

const createEscrowSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  priceCents: z.number().int().positive('Price must be positive'),
  sellerIdentifier: z.string().min(1, 'Seller identifier is required'),
});

async function handler(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const idempotencyKey = request.headers.get('idempotency-key');
    const body = await request.json();
    const { title, priceCents, sellerIdentifier } = createEscrowSchema.parse(body);
    const buyerId = session.user.id;

    // Lookup seller by email
    const seller = await prisma.user.findUnique({
      where: { email: sellerIdentifier }
    });

    if (!seller) {
      return NextResponse.json({ message: 'Seller not found' }, { status: 404 });
    }

    const sellerId = seller.id;

    if (buyerId === sellerId) {
      return NextResponse.json({ message: 'Cannot create escrow with yourself' }, { status: 400 });
    }

    // Process escrow creation in a single transaction
    const escrow = await prisma.$transaction(async (tx) => {
      // 1. Pre-create the escrow record so we can link the ledger entries to it.
      // Notice: we generate the ID explicitly using a cuid so we can pass it to reserveEscrowFunds
      // Prisma doesn't let us easily generate ID beforehand unless we rely on DB default, but we can just create it first since we are in a tx.
      
      const newEscrow = await tx.escrowTransaction.create({
        data: {
          title,
          priceCents: BigInt(priceCents),
          buyerId,
          sellerId,
          status: 'AWAITING_CREDENTIALS',
        },
      });

      // 2. Reserve funds (debit available, credit held). Throws error if insufficient funds.
      await reserveEscrowFunds(tx, {
        buyerId,
        escrowId: newEscrow.id,
        amountCents: BigInt(priceCents),
        idempotencyKeyPrefix: `create_escrow:${idempotencyKey}`,
      });

      // 3. Write EscrowEvent audit log
      await tx.escrowEvent.create({
        data: {
          escrowId: newEscrow.id,
          type: 'EscrowCreated',
          actorId: buyerId,
          metadata: { priceCents, sellerId },
        },
      });

      return newEscrow;
    });

    // 4. Trigger Inngest 48h timeout for awaiting credentials
    await inngest.send({
      name: 'escrow/created',
      data: { escrowId: escrow.id },
    });

    return NextResponse.json({
      message: 'Escrow created successfully',
      escrowId: escrow.id,
      status: escrow.status,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === 'Insufficient available balance' || error.message === 'Buyer wallet not found') {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
    }
    console.error('Escrow creation error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withIdempotency(handler);
