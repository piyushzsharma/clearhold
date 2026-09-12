import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.js';
import { prisma } from '@/lib/db.js';
import { withIdempotency } from '@/lib/idempotency.js';
import { z } from 'zod';

const disputeSchema = z.object({
  reasonCode: z.enum([
    'CREDENTIALS_INVALID',
    'ACCOUNT_BANNED',
    'ACCOUNT_RECLAIMED',
    'ITEM_NOT_AS_DESCRIBED',
    'OTHER'
  ], { required_error: 'Reason code is required' }),
  notes: z.string().max(1000).optional(),
});

async function handler(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: escrowId } = params;
    const userId = session.user.id;
    const body = await request.json();
    const { reasonCode, notes } = disputeSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the escrow row
      const escrowRows = await tx.$queryRaw`
        SELECT status, "buyerId", "sellerId", version FROM escrow_transactions WHERE id = ${escrowId} FOR UPDATE
      `;
      
      if (!escrowRows || escrowRows.length === 0) {
        throw new Error('Escrow not found');
      }
      
      const escrow = escrowRows[0];

      if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
        throw new Error('Unauthorized: Only participants can open a dispute');
      }

      if (escrow.status !== 'VERIFICATION_WINDOW' && escrow.status !== 'AWAITING_CREDENTIALS') {
        throw new Error(`Invalid transition: Cannot dispute from state ${escrow.status}`);
      }

      // 2. Transition to DISPUTED and increment version for optimistic concurrency
      const updatedEscrow = await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: {
          status: 'DISPUTED',
          version: { increment: 1 },
        }
      });

      // 3. Write audit log
      await tx.escrowEvent.create({
        data: {
          escrowId,
          type: 'Disputed',
          actorId: userId,
          metadata: { reasonCode, notes },
        }
      });

      return updatedEscrow;
    });

    return NextResponse.json({
      message: 'Dispute opened successfully',
      status: result.status,
    }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message.startsWith('Invalid transition') || error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      if (error.message === 'Escrow not found') {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
    }
    console.error('Escrow dispute error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withIdempotency(handler);
