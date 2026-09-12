import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { envelopeDecrypt } from '@/lib/crypto';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: escrowId } = params;
    const buyerId = session.user.id;

    // Use a transaction to ensure we only log the access if we actually serve the credentials
    const credentials = await prisma.$transaction(async (tx) => {
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

      if (!escrow.encryptedCredentials || !escrow.wrappedCredentialKey) {
        throw new Error('Credentials are missing or have been cryptographically shredded');
      }

      // Decrypt credentials
      const plaintext = envelopeDecrypt(escrow.encryptedCredentials, escrow.wrappedCredentialKey);

      // Write an audit log that the buyer viewed the credentials
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      
      await tx.escrowEvent.create({
        data: {
          escrowId,
          type: 'CredentialAccessed',
          actorId: buyerId,
          metadata: { ip },
        }
      });

      return plaintext;
    });

    return NextResponse.json({ credentials: credentials });

  } catch (error) {
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
