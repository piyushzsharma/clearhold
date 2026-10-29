import { Prisma, PrismaClient } from '@prisma/client'
import { lockEscrow, transitionEscrow } from './escrow-state-machine'
import { refundEscrowFunds, releaseEscrowFunds } from './ledger'

type DueEscrow = { id: string }

export async function reconcileExpiredEscrows(db: PrismaClient, limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid reconciliation limit')
  // Database time, not worker time, is the authority for persisted deadlines.
  const due = await db.$queryRaw<DueEscrow[]>(Prisma.sql`
    SELECT id FROM escrow_transactions
    WHERE (status = 'AWAITING_CREDENTIALS' AND "submissionDeadline" <= (clock_timestamp() AT TIME ZONE 'UTC'))
       OR (status = 'VERIFICATION_WINDOW' AND "verificationDeadline" <= (clock_timestamp() AT TIME ZONE 'UTC'))
    ORDER BY id LIMIT ${limit}
  `)
  const result = { scanned: due.length, settled: 0, skipped: 0, failed: 0 }
  for (const { id } of due) {
    try {
      const settled = await db.$transaction(async tx => {
        const escrow = await lockEscrow(tx, id)
        const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`
        if (escrow.status === 'AWAITING_CREDENTIALS' && now >= escrow.submissionDeadline) {
          await refundEscrowFunds(tx, {
            buyerId: escrow.buyerId,
            escrowId: id,
            amountCents: escrow.priceCents,
            idempotencyKeyPrefix: `reconcile:timeout-refund:${id}`,
          })
          await transitionEscrow(tx, { escrow, transition: 'TIMEOUT_REFUND', actor: { type: 'SYSTEM' }, now, metadata: { source: 'reconciler' } })
          return true
        }
        if (escrow.status === 'VERIFICATION_WINDOW' && escrow.verificationDeadline && now >= escrow.verificationDeadline) {
          await releaseEscrowFunds(tx, {
            buyerId: escrow.buyerId,
            sellerId: escrow.sellerId,
            escrowId: id,
            amountCents: escrow.priceCents,
            idempotencyKeyPrefix: `reconcile:auto-release:${id}`,
          })
          await transitionEscrow(tx, { escrow, transition: 'AUTO_RELEASE', actor: { type: 'SYSTEM' }, now, metadata: { source: 'reconciler' } })
          return true
        }
        return false
      })
      if (settled) result.settled++
      else result.skipped++
    } catch (error) {
      result.failed++
      console.error('Escrow reconciliation failed', { escrowId: id, error })
    }
  }
  return result
}
