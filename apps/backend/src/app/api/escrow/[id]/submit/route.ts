import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeIdempotentCommand, idempotencyErrorResponse } from '@/lib/idempotency';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';
import { envelopeEncrypt } from '@/lib/crypto';
import { inngest } from '@/lib/inngest';
import { EscrowNotFoundError, lockEscrow, transitionEscrow } from '@/lib/escrow-state-machine';
import { InvalidEscrowTransitionError } from '@/lib/escrow-state-policy';
import { z } from 'zod';

const submitCredentialsSchema = z.object({
  credentialsPlaintext: z.string().min(1, 'Credentials cannot be empty').max(16_384, 'Credentials are too long'),
});

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }, principal: Principal) {
  try {
    const { id: escrowId } = await params;
    const rawBody = await request.clone().text();
    const body = await request.json();
    const { credentialsPlaintext } = submitCredentialsSchema.parse(body);

    const sellerId = principal.id;

    const { response } = await executeIdempotentCommand({
      db: prisma,
      request,
      rawBody,
      principalId: sellerId,
      run: async (tx) => {
      const escrow = await lockEscrow(tx, escrowId);
      if (escrow.sellerId !== sellerId) {
        throw new Error('Unauthorized: Only the seller can submit credentials');
      }

      // Perform envelope encryption
      const { encryptedCredentials, wrappedCredentialKey } = envelopeEncrypt(credentialsPlaintext, escrowId);

      const verificationDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 hours

      const updated = await transitionEscrow(tx, {
        escrow,
        transition: 'SUBMIT_CREDENTIALS',
        actor: { type: 'USER', id: sellerId },
        credentials: {
          verificationDeadline,
          encryptedCredentials,
          wrappedCredentialKey,
        },
      });
      return {
        status: 200,
        body: {
          message: 'Credentials submitted successfully',
          status: updated.status,
          verificationDeadline: updated.verificationDeadline?.toISOString(),
        },
      };
      },
    });

    if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV === '1') {
      try {
        await inngest.send({ name: 'escrow/credentials.submitted', data: { escrowId, sellerId } });
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
      if (error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
    }
    if (error instanceof InvalidEscrowTransitionError) return NextResponse.json({ message: error.message }, { status: 409 });
    if (error instanceof EscrowNotFoundError) return NextResponse.json({ message: error.message }, { status: 404 });
    console.error('Credential submission error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuthorization(handler, { platformRoles: ['USER'] });
