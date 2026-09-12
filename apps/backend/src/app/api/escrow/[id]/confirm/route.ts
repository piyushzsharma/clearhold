import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withIdempotency } from '@/lib/idempotency';
import { releaseEscrowFunds } from '@/lib/ledger';

async function handler(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: escrowId } = params;
    const idempotencyKey = request.headers.get('idempotency-key');
    const buyerId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Acquire row-level lock on the escrow transaction to prevent concurrent auto-release or dispute
      const escrowRows = await tx.$queryRaw`
        SELECT status, "buyerId", "sellerId", "priceCents" FROM escrow_transactions WHERE id = ${escrowId} FOR UPDATE
      `;
      
      if (!escrowRows || escrowRows.length === 0) {
        throw new Error('Escrow not found');
      }
      
      const escrow = escrowRows[0];

      // 2. Re-check current status AFTER acquiring the lock
      // If it's already RELEASED or AUTO_RELEASED, we just return the current state instead of erroring
      if (escrow.status === 'RELEASED' || escrow.status === 'AUTO_RELEASED') {
        return { status: escrow.status, alreadyReleased: true };
      }

      if (escrow.status !== 'VERIFICATION_WINDOW') {
        throw new Error(`Invalid transition: Cannot release funds from state ${escrow.status}`);
      }

      if (escrow.buyerId !== buyerId) {
        throw new Error('Unauthorized: Only the buyer can confirm release');
      }

      // 3. Write DEBIT/CREDIT ledger pair
      await releaseEscrowFunds(tx, {
        buyerId: escrow.buyerId,
        sellerId: escrow.sellerId,
        escrowId,
        amountCents: escrow.priceCents,
        idempotencyKeyPrefix: `release_escrow:${idempotencyKey}`,
      });

      // 4. Transition to RELEASED and cryptographically shred the credentials
      const updatedEscrow = await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: {
          status: 'RELEASED',
          // Shred the DEK wrapper. The ciphertext remains, but it is now permanently unreadable.
          wrappedCredentialKey: null,
        }
      });

      // 5. Write audit log
      await tx.escrowEvent.create({
        data: {
          escrowId,
          type: 'Released',
          actorId: buyerId,
        }
      });

      return { status: updatedEscrow.status, alreadyReleased: false };
    });

    if (result.alreadyReleased) {
      return NextResponse.json({
        message: 'Escrow was already released',
        status: result.status,
      }, { status: 200 });
    }

    return NextResponse.json({
      message: 'Funds released successfully',
      status: result.status,
    }, { status: 200 });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('Invalid transition') || error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      if (error.message === 'Escrow not found') {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
    }
    console.error('Escrow release error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withIdempotency(handler);
