import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { envelopeDecrypt } from '@/lib/crypto';
import { withAuthorization } from '@/lib/authorization';
import type { Principal } from '@/lib/authorization-policy';
import { EscrowNotFoundError, lockEscrow } from '@/lib/escrow-state-machine';

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }, principal: Principal) {
  try {
    const { id: escrowId } = await params;
    const buyerId = principal.id;

    // Lock the row so settlement cannot delete the wrapped key while access is audited.
    const credentials = await prisma.$transaction(async (tx) => {
      await lockEscrow(tx, escrowId);
      const escrow = await tx.escrowTransaction.findUnique({
        where: { id: escrowId }
      });

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      if (escrow.buyerId !== buyerId) {
        throw new Error('Unauthorized: Only the buyer can access these credentials');
      }

      if (escrow.status !== 'VERIFICATION_WINDOW') {
        throw new Error(`Invalid state: Credentials can only be accessed during the verification window. Current status: ${escrow.status}`);
      }

      if (!escrow.verificationDeadline || escrow.verificationDeadline <= new Date()) {
        throw new Error('Invalid state: Credential verification window has expired');
      }

      if (!escrow.encryptedCredentials || !escrow.wrappedCredentialKey) {
        throw new Error('Credentials are missing or have been cryptographically shredded');
      }

      // Decrypt credentials
      const plaintext = envelopeDecrypt(escrow.encryptedCredentials, escrow.wrappedCredentialKey, escrowId);

      // Write an audit log that the buyer viewed the credentials
      await tx.escrowEvent.create({
        data: {
          escrowId,
          type: 'CredentialAccessed',
          actorId: buyerId,
          metadata: { access: 'buyer-read' },
        }
      });

      return plaintext;
    });

    return NextResponse.json({ credentials }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    if (error instanceof EscrowNotFoundError) return NextResponse.json({ message: error.message }, { status: 404 });
    if (error instanceof Error) {
      if (error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      if (error.message.startsWith('Invalid state') || error.message.includes('shredded')) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      if (error.message === 'Escrow not found') {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
    }
    console.error('Credential access error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuthorization(handler, { platformRoles: ['USER'] });
