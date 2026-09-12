import { inngest } from '@/lib/inngest.js';
import { prisma } from '@/lib/db.js';
import { refundEscrowFunds } from '@/lib/ledger.js';

export const escrowTimeoutRefund = inngest.createFunction(
  { id: 'escrow-timeout-refund', name: 'Escrow Timeout Refund' },
  { event: 'escrow/created' },
  async ({ event, step }) => {
    const { escrowId } = event.data;

    // Wait for exactly 48 hours for the seller to submit credentials
    await step.sleep('wait-for-credentials', '48h');

    // After 48 hours, check if it's still in AWAITING_CREDENTIALS state
    await step.run('attempt-timeout-refund', async () => {
      await prisma.$transaction(async (tx) => {
        // Lock row
        const escrowRows = await tx.$queryRaw`
          SELECT status, "buyerId", "priceCents" FROM escrow_transactions WHERE id = ${escrowId} FOR UPDATE
        `;
        
        if (!escrowRows || escrowRows.length === 0) return;
        const escrow = escrowRows[0];

        // If not in AWAITING_CREDENTIALS, they submitted credentials or it was cancelled
        if (escrow.status !== 'AWAITING_CREDENTIALS') {
          return { skipped: true, reason: `Status is ${escrow.status}` };
        }

        // Refund funds to buyer
        await refundEscrowFunds(tx, {
          buyerId: escrow.buyerId,
          escrowId,
          amountCents: escrow.priceCents,
          idempotencyKeyPrefix: `inngest_timeout_refund:${escrowId}`,
        });

        // Update status
        await tx.escrowTransaction.update({
          where: { id: escrowId },
          data: {
            status: 'CANCELLED',
          }
        });

        // Log event
        await tx.escrowEvent.create({
          data: {
            escrowId,
            type: 'TimeoutRefunded',
            actorId: 'SYSTEM',
          }
        });

        return { refunded: true };
      });
    });
  }
);
