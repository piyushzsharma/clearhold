import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeIdempotentCommand, idempotencyErrorResponse } from '@/lib/idempotency';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';
import { z } from 'zod';
import { EscrowNotFoundError, lockEscrow, transitionEscrow } from '@/lib/escrow-state-machine';
import { InvalidEscrowTransitionError } from '@/lib/escrow-state-policy';

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

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }, principal: Principal) {
  try {
    const { id: escrowId } = await params;
    const userId = principal.id;
    const rawBody = await request.clone().text();
    const body = await request.json();
    const { reasonCode, notes } = disputeSchema.parse(body);

    const { response } = await executeIdempotentCommand({
      db: prisma,
      request,
      rawBody,
      principalId: userId,
      run: async (tx) => {
      const escrow = await lockEscrow(tx, escrowId);

      if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
        throw new Error('Unauthorized: Only participants can open a dispute');
      }

      const updated = await transitionEscrow(tx, {
        escrow,
        transition: 'OPEN_DISPUTE',
        actor: { type: 'USER', id: userId },
        metadata: { reasonCode, ...(notes ? { notes } : {}) },
      });
      return { status: 200, body: { message: 'Dispute opened successfully', status: updated.status } };
      },
    });

    return response;

  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error);
    if (idempotencyError) return idempotencyError;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
    }
    if (error instanceof InvalidEscrowTransitionError) return NextResponse.json({ message: error.message }, { status: 409 });
    if (error instanceof EscrowNotFoundError) return NextResponse.json({ message: error.message }, { status: 404 });
    console.error('Escrow dispute error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuthorization(handler, { platformRoles: ['USER'] });
