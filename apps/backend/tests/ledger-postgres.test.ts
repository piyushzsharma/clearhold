import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { ensureUserLedgerAccounts, issueDemoFunds, reserveEscrowFunds } from '../src/lib/ledger'

const prisma = new PrismaClient()
after(async () => prisma.$disconnect())

test('PostgreSQL enforces journal balance, immutability, and concurrent solvency', async () => {
  const run = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const [buyer, sellerA, sellerB] = await Promise.all([
    prisma.user.create({ data: { email: `ledger-buyer-${run}@test.local`, platformRole: 'USER' } }),
    prisma.user.create({ data: { email: `ledger-seller-a-${run}@test.local`, platformRole: 'USER' } }),
    prisma.user.create({ data: { email: `ledger-seller-b-${run}@test.local`, platformRole: 'USER' } }),
  ])

  await prisma.$transaction(async tx => {
    await ensureUserLedgerAccounts(tx, buyer.id)
    await ensureUserLedgerAccounts(tx, sellerA.id)
    await ensureUserLedgerAccounts(tx, sellerB.id)
    await issueDemoFunds(tx, { userId: buyer.id, amountCents: 10_000n, idempotencyKey: `test-funding:${run}` })
  })

  const [escrowA, escrowB] = await Promise.all([
    prisma.escrowTransaction.create({ data: { title: 'Concurrent A', priceCents: 8_000n, buyerId: buyer.id, sellerId: sellerA.id, submissionDeadline: new Date(Date.now() + 172_800_000) } }),
    prisma.escrowTransaction.create({ data: { title: 'Concurrent B', priceCents: 8_000n, buyerId: buyer.id, sellerId: sellerB.id, submissionDeadline: new Date(Date.now() + 172_800_000) } }),
  ])

  const attempts = await Promise.allSettled([
    prisma.$transaction(tx => reserveEscrowFunds(tx, { buyerId: buyer.id, escrowId: escrowA.id, amountCents: 8_000n, idempotencyKeyPrefix: `test-reserve-a:${run}` })),
    prisma.$transaction(tx => reserveEscrowFunds(tx, { buyerId: buyer.id, escrowId: escrowB.id, amountCents: 8_000n, idempotencyKeyPrefix: `test-reserve-b:${run}` })),
  ])
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)

  const accounts = await prisma.ledgerAccount.findMany({ where: { ownerId: buyer.id } })
  assert.equal(accounts.find(account => account.kind === 'USER_AVAILABLE')?.balanceCents, 2_000n)
  assert.equal(accounts.find(account => account.kind === 'USER_HELD')?.balanceCents, 8_000n)

  const unbalancedKey = `test-unbalanced:${run}`
  await assert.rejects(prisma.$transaction(async tx => {
    const account = accounts.find(item => item.kind === 'USER_AVAILABLE')!
    const journal = await tx.journalTransaction.create({
      data: {
        idempotencyKey: unbalancedKey,
        kind: 'MIGRATION',
        entries: { create: { accountId: account.id, entryType: 'CREDIT', amountCents: 1n } },
      },
    })
    await tx.journalTransaction.update({ where: { id: journal.id }, data: { status: 'POSTED', postedAt: new Date() } })
  }))
  assert.equal(await prisma.journalTransaction.findUnique({ where: { idempotencyKey: unbalancedKey } }), null)

  const entry = await prisma.ledgerEntry.findFirstOrThrow({
    where: { journalTransaction: { idempotencyKey: `test-funding:${run}` } },
  })
  await assert.rejects(prisma.$executeRaw`UPDATE "ledger_entries" SET "amountCents" = 1 WHERE "id" = ${entry.id}`)
})

