import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/db';
import { refundEscrowFunds } from '@/lib/ledger';
import { lockEscrow, transitionEscrow } from '@/lib/escrow-state-machine';

export const escrowTimeoutRefund = inngest.createFunction(
  {
    id: 'escrow-timeout-refund',
    name: 'Escrow Timeout Refund',
    triggers: { event: 'escrow/created' },
  },
  async ({ event, step }) => {
    const { escrowId } = event.data;

    // Wait for exactly 48 hours for the seller to submit credentials
    await step.sleep('wait-for-credentials', '48h');

    // After 48 hours, check if it's still in AWAITING_CREDENTIALS state
    await step.run('attempt-timeout-refund', async () => {
      await prisma.$transaction(async (tx) => {
        const escrow = await lockEscrow(tx, escrowId);

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

        await transitionEscrow(tx, {
          escrow,
          transition: 'TIMEOUT_REFUND',
          actor: { type: 'SYSTEM' },
          metadata: { source: 'inngest' },
        });

        return { refunded: true };
      });
    });
  }
);
