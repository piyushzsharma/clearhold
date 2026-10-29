import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { ensureUserLedgerAccounts, issueDemoFunds, reserveEscrowFunds } from '../src/lib/ledger'
import { createEscrow } from '../src/lib/escrow-state-machine'
import { reconcileExpiredEscrows } from '../src/lib/reconcile-escrows'

const db = new PrismaClient()
after(async () => db.$disconnect())

test('overdue escrow is refunded once across concurrent recovery sweeps', async () => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const [buyer, seller] = await Promise.all([
    db.user.create({ data: { email: `recovery-buyer-${unique}@test.local` } }),
    db.user.create({ data: { email: `recovery-seller-${unique}@test.local` } }),
  ])
  const escrow = await db.$transaction(async tx => {
    await ensureUserLedgerAccounts(tx, buyer.id)
    await ensureUserLedgerAccounts(tx, seller.id)
    await issueDemoFunds(tx, { userId: buyer.id, amountCents: 10_000n, idempotencyKey: `recovery-funding:${unique}` })
    const created = await createEscrow(tx, {
      title: 'Recovery test', priceCents: 2_000n, buyerId: buyer.id, sellerId: seller.id,
      submissionDeadline: new Date(Date.now() + 1_500),
    })
    await reserveEscrowFunds(tx, { buyerId: buyer.id, escrowId: created.id, amountCents: 2_000n, idempotencyKeyPrefix: `recovery-reserve:${unique}` })
    return created
  })

  await new Promise(resolve => setTimeout(resolve, 1_600))
  const results = await Promise.all([reconcileExpiredEscrows(db), reconcileExpiredEscrows(db)])
  assert.equal(results.reduce((sum, result) => sum + result.settled, 0), 1)
  assert.equal(results.reduce((sum, result) => sum + result.failed, 0), 0)
  assert.equal((await db.escrowTransaction.findUniqueOrThrow({ where: { id: escrow.id } })).status, 'REFUNDED')
  assert.equal(await db.journalTransaction.count({ where: { escrowId: escrow.id, kind: 'ESCROW_REFUND' } }), 1)
  assert.equal((await reconcileExpiredEscrows(db)).settled, 0)
})
