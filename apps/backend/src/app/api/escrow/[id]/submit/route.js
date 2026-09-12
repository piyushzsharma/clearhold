import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.js';
import { prisma } from '@/lib/db.js';
import { withIdempotency } from '@/lib/idempotency.js';
import { envelopeEncrypt } from '@/lib/crypto.js';
import { inngest } from '@/lib/inngest.js';
import { z } from 'zod';

const submitCredentialsSchema = z.object({
  credentialsPlaintext: z.string().min(1, 'Credentials cannot be empty'),
});

async function handler(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: escrowId } = params;
    const body = await request.json();
    const { credentialsPlaintext } = submitCredentialsSchema.parse(body);

    const sellerId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      // Lock the escrow row
      const escrowRows = await tx.$queryRaw`
        SELECT status FROM escrow_transactions WHERE id = ${escrowId} FOR UPDATE
      `;
      
      if (!escrowRows || escrowRows.length === 0) {
        throw new Error('Escrow not found');
      }
      
      const currentStatus = escrowRows[0].status;

      // Assert transition is valid
      if (currentStatus !== 'AWAITING_CREDENTIALS') {
        throw new Error(`Invalid transition: Cannot submit credentials from state ${currentStatus}`);
      }

      // Check authorization
      const escrowDetails = await tx.escrowTransaction.findUnique({
        where: { id: escrowId }
      });

      if (escrowDetails.sellerId !== sellerId) {
        throw new Error('Unauthorized: Only the seller can submit credentials');
      }

      // Perform envelope encryption
      const { encryptedCredentials, wrappedCredentialKey } = envelopeEncrypt(credentialsPlaintext);

      const verificationDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 hours

      // Update escrow
      const updatedEscrow = await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: {
          status: 'VERIFICATION_WINDOW',
          verificationDeadline,
          encryptedCredentials,
          wrappedCredentialKey,
        }
      });

      // Write audit log
      await tx.escrowEvent.create({
        data: {
          escrowId,
          type: 'CredentialsSubmitted',
          actorId: sellerId,
        }
      });

      return updatedEscrow;
    });

    // Trigger Inngest 24h auto-release job
    await inngest.send({
      name: 'escrow/credentials.submitted',
      data: { escrowId, sellerId },
    });

    return NextResponse.json({
      message: 'Credentials submitted successfully',
      status: result.status,
      verificationDeadline: result.verificationDeadline,
    });

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
    console.error('Credential submission error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withIdempotency(handler);
