import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/db';
import { releaseEscrowFunds } from '@/lib/ledger';

export const escrowAutoRelease = inngest.createFunction(
  { id: 'escrow-auto-release', name: 'Escrow Auto-Release' },
  { event: 'escrow/credentials.submitted' },
  async ({ event, step }) => {
    const { escrowId, sellerId } = event.data;

    // Wait for exactly 24 hours
    // During this time, Inngest gracefully handles server restarts and deployments.
    await step.sleep('wait-for-verification', '24h');

    // After 24 hours, attempt to release the funds if it hasn't been disputed or already released.
    await step.run('attempt-auto-release', async () => {
      await prisma.$transaction(async (tx) => {
        // Lock row
        const escrowRows = await tx.$queryRaw`
          SELECT status, "buyerId", "sellerId", "priceCents" FROM escrow_transactions WHERE id = ${escrowId} FOR UPDATE
        `;
        
        if (!escrowRows || escrowRows.length === 0) return;
        const escrow = escrowRows[0];

        // If not in VERIFICATION_WINDOW, it means it was disputed or already released/resolved.
        if (escrow.status !== 'VERIFICATION_WINDOW') {
          return { skipped: true, reason: `Status is ${escrow.status}` };
        }

        // Release funds
        await releaseEscrowFunds(tx, {
          buyerId: escrow.buyerId,
          sellerId: escrow.sellerId,
          escrowId,
          amountCents: escrow.priceCents,
          idempotencyKeyPrefix: `inngest_auto_release:${escrowId}`,
        });

        // Update status and shred DEK
        await tx.escrowTransaction.update({
          where: { id: escrowId },
          data: {
            status: 'AUTO_RELEASED',
            wrappedCredentialKey: null,
          }
        });

        // Log event
        await tx.escrowEvent.create({
          data: {
            escrowId,
            type: 'AutoReleased',
            actorId: 'SYSTEM',
          }
        });

        return { released: true };
      });
    });
  }
);
