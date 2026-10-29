import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/db';
import { releaseEscrowFunds } from '@/lib/ledger';
import { lockEscrow, transitionEscrow } from '@/lib/escrow-state-machine';

export const escrowAutoRelease = inngest.createFunction(
  {
    id: 'escrow-auto-release',
    name: 'Escrow Auto-Release',
    triggers: { event: 'escrow/credentials.submitted' },
  },
  async ({ event, step }) => {
    const { escrowId } = event.data;

    // Wait for exactly 24 hours
    // During this time, Inngest gracefully handles server restarts and deployments.
    await step.sleep('wait-for-verification', '24h');

    // After 24 hours, attempt to release the funds if it hasn't been disputed or already released.
    await step.run('attempt-auto-release', async () => {
      await prisma.$transaction(async (tx) => {
        const escrow = await lockEscrow(tx, escrowId);

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

        await transitionEscrow(tx, {
          escrow,
          transition: 'AUTO_RELEASE',
          actor: { type: 'SYSTEM' },
          metadata: { source: 'inngest' },
        });

        return { released: true };
      });
    });
  }
);
