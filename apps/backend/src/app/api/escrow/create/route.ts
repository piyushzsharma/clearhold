import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeIdempotentCommand, idempotencyErrorResponse } from '@/lib/idempotency';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';
import { reserveEscrowFunds } from '@/lib/ledger';
import { createEscrow } from '@/lib/escrow-state-machine';
import { inngest } from '@/lib/inngest';
import { z } from 'zod';

const createEscrowSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  priceCents: z.number().int().positive('Price must be positive'),
  sellerIdentifier: z.string().min(1, 'Seller identifier is required'),
});

async function handler(request: Request, _context: unknown, principal: Principal) {
  try {
    const rawBody = await request.clone().text();
    const body = await request.json();
    const { title, priceCents, sellerIdentifier } = createEscrowSchema.parse(body);
    const buyerId = principal.id;

    const { response } = await executeIdempotentCommand({
      db: prisma,
      request,
      rawBody,
      principalId: buyerId,
      run: async (tx, journalPrefix) => {
      const seller = await tx.user.findFirst({
        where: { email: { equals: sellerIdentifier.trim(), mode: 'insensitive' } },
      });
      if (!seller || seller.platformRole !== 'USER') throw new Error('Seller not found');
      const sellerId = seller.id;
      if (buyerId === sellerId) throw new Error('Cannot create escrow with yourself');
      const newEscrow = await createEscrow(tx, {
        title,
        priceCents: BigInt(priceCents),
        buyerId,
        sellerId,
        submissionDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });

      // 2. Reserve funds (debit available, credit held). Throws error if insufficient funds.
      await reserveEscrowFunds(tx, {
        buyerId,
        escrowId: newEscrow.id,
        amountCents: BigInt(priceCents),
        idempotencyKeyPrefix: journalPrefix,
      });

      return {
        status: 201,
        body: { message: 'Escrow created successfully', escrowId: newEscrow.id, status: newEscrow.status },
      };
      },
    });

    // Phase 9 will replace this best-effort dispatch with an outbox.
    if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV === '1') {
      try {
        const payload = await response.clone().json();
        await inngest.send({ name: 'escrow/created', data: { escrowId: payload.escrowId } });
      } catch (dispatchError) {
        console.error('Optional escrow event dispatch failed:', dispatchError);
      }
    }
    return response;

  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error);
    if (idempotencyError) return idempotencyError;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === 'Seller not found') return NextResponse.json({ message: error.message }, { status: 404 });
      if (error.message === 'Cannot create escrow with yourself') return NextResponse.json({ message: error.message }, { status: 400 });
      if (error.message === 'Insufficient available balance' || error.message.startsWith('Ledger account not found')) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
    }
    console.error('Escrow creation error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuthorization(handler, { platformRoles: ['USER'] });
