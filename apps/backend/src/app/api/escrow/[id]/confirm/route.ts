import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeIdempotentCommand, idempotencyErrorResponse } from '@/lib/idempotency';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';
import { releaseEscrowFunds } from '@/lib/ledger';
import { EscrowNotFoundError, lockEscrow, transitionEscrow } from '@/lib/escrow-state-machine';
import { InvalidEscrowTransitionError } from '@/lib/escrow-state-policy';

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }, principal: Principal) {
  try {
    const { id: escrowId } = await params;
    const buyerId = principal.id;

    const { response } = await executeIdempotentCommand({
      db: prisma,
      request,
      principalId: buyerId,
      run: async (tx, journalPrefix) => {
      const escrow = await lockEscrow(tx, escrowId);

      if (escrow.buyerId !== buyerId) {
        throw new Error('Unauthorized: Only the buyer can confirm release');
      }

      // Re-check current status after authorization and after acquiring the lock.
      // If it's already RELEASED or AUTO_RELEASED, we just return the current state instead of erroring
      if (escrow.status === 'RELEASED' || escrow.status === 'AUTO_RELEASED') {
        return { status: 200, body: { message: 'Escrow was already released', status: escrow.status } };
      }

      // 3. Write DEBIT/CREDIT ledger pair
      await releaseEscrowFunds(tx, {
        buyerId: escrow.buyerId,
        sellerId: escrow.sellerId,
        escrowId,
        amountCents: escrow.priceCents,
        idempotencyKeyPrefix: journalPrefix,
      });

      const updatedEscrow = await transitionEscrow(tx, {
        escrow,
        transition: 'CONFIRM_RELEASE',
        actor: { type: 'USER', id: buyerId },
      });

      return { status: 200, body: { message: 'Funds released successfully', status: updatedEscrow.status } };
      },
    });
    return response;

  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error);
    if (idempotencyError) return idempotencyError;
    if (error instanceof Error) {
      if (error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
    }
    if (error instanceof InvalidEscrowTransitionError) return NextResponse.json({ message: error.message }, { status: 409 });
    if (error instanceof EscrowNotFoundError) return NextResponse.json({ message: error.message }, { status: 404 });
    console.error('Escrow release error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuthorization(handler, { platformRoles: ['USER'] });
