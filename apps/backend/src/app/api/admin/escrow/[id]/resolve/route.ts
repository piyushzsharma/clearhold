import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeIdempotentCommand, idempotencyErrorResponse } from '@/lib/idempotency';
import { withAuthorization } from '@/lib/authorization';
import { AuthorizationError, type Principal } from '@/lib/authorization-policy';
import { releaseEscrowFunds, refundEscrowFunds, partialRefundEscrowFunds } from '@/lib/ledger';
import {
  assertEscrowVersion,
  EscrowNotFoundError,
  EscrowVersionConflictError,
  lockEscrow,
  transitionEscrow,
} from '@/lib/escrow-state-machine';
import { InvalidEscrowTransitionError } from '@/lib/escrow-state-policy';
import { z } from 'zod';

const resolveSchema = z.object({
  expectedVersion: z.number().int().min(0, 'Expected version is required'),
  resolutionAction: z.enum(['RELEASE', 'REFUND', 'PARTIAL_REFUND']),
  reasonCode: z.enum(['BUYER_SCAM', 'SELLER_SCAM', 'MUTUAL_AGREEMENT', 'PLATFORM_RULING', 'OTHER']),
  notes: z.string().min(1, 'Notes are required for dispute resolution'),
  refundAmountCents: z.number().int().positive().optional(), // Required only for PARTIAL_REFUND
});

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }, principal: Principal) {
  try {
    const { id: escrowId } = await params;
    const adminId = principal.id;

    const rawBody = await request.clone().text();
    const body = await request.json();
    const { expectedVersion, resolutionAction, reasonCode, notes, refundAmountCents } = resolveSchema.parse(body);

    if (resolutionAction === 'PARTIAL_REFUND' && !refundAmountCents) {
      return NextResponse.json({ message: 'refundAmountCents is required for PARTIAL_REFUND' }, { status: 400 });
    }

    const { response } = await executeIdempotentCommand({
      db: prisma,
      request,
      rawBody,
      principalId: adminId,
      run: async (tx, journalPrefix) => {
      // Keep authorization valid for the entire privileged transaction. A concurrent
      // demotion must wait for this row lock, or be observed before settlement begins.
      const adminRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users
        WHERE id = ${adminId} AND "platformRole" = 'ADMIN'
        FOR SHARE
      `;

      if (adminRows.length === 0) {
        throw new AuthorizationError();
      }

      const escrow = await lockEscrow(tx, escrowId);
      assertEscrowVersion(escrow, expectedVersion);
      let transition: 'ADMIN_RELEASE' | 'ADMIN_REFUND' | 'ADMIN_PARTIAL_REFUND';

      // 3. Process Ledger Changes
      if (resolutionAction === 'RELEASE') {
        await releaseEscrowFunds(tx, {
          buyerId: escrow.buyerId,
          sellerId: escrow.sellerId,
          escrowId,
          amountCents: escrow.priceCents,
          idempotencyKeyPrefix: journalPrefix,
        });
        transition = 'ADMIN_RELEASE';
      } else if (resolutionAction === 'REFUND') {
        await refundEscrowFunds(tx, {
          buyerId: escrow.buyerId,
          escrowId,
          amountCents: escrow.priceCents,
          idempotencyKeyPrefix: journalPrefix,
        });
        transition = 'ADMIN_REFUND';
      } else if (resolutionAction === 'PARTIAL_REFUND') {
        await partialRefundEscrowFunds(tx, {
          buyerId: escrow.buyerId,
          sellerId: escrow.sellerId,
          escrowId,
          totalAmountCents: escrow.priceCents,
          refundAmountCents: BigInt(refundAmountCents),
          idempotencyKeyPrefix: journalPrefix,
        });
        transition = 'ADMIN_PARTIAL_REFUND';
      }

      const updated = await transitionEscrow(tx, {
        escrow,
        transition,
        actor: { type: 'USER', id: adminId },
        metadata: {
          reasonCode,
          notes,
          expectedVersion,
          ...(refundAmountCents ? { refundAmountCents } : {}),
        },
      });
      return {
        status: 200,
        body: { message: 'Dispute resolved successfully', status: updated.status, newVersion: updated.version },
      };
      },
    });

    return response;

  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error);
    if (idempotencyError) return idempotencyError;
    if (error instanceof AuthorizationError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message.includes('Partial refund must be less')) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
    }
    if (error instanceof EscrowVersionConflictError || error instanceof InvalidEscrowTransitionError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof EscrowNotFoundError) return NextResponse.json({ message: error.message }, { status: 404 });
    console.error('Admin resolution error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuthorization(handler, { platformRoles: ['ADMIN'] });
