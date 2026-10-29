import { Prisma, type JournalKind } from '@prisma/client'
import {
  assertBalancedEntries,
  partialRefundAllocation,
  releaseAllocation,
  type PostingEntry,
} from './ledger-policy'

type DbTransaction = Prisma.TransactionClient
type LockedAccount = { id: string; code: string; balanceCents: bigint }

export const ledgerAccountCodes = {
  available: (userId: string) => `user:${userId}:available:USD`,
  held: (userId: string) => `user:${userId}:held:USD`,
  platformFee: 'platform:fee:USD',
  issuance: 'system:issuance:USD',
} as const

export async function ensureUserLedgerAccounts(tx: DbTransaction, userId: string) {
  await tx.ledgerAccount.createMany({
    data: [
      { code: ledgerAccountCodes.available(userId), ownerId: userId, kind: 'USER_AVAILABLE', currency: 'USD' },
      { code: ledgerAccountCodes.held(userId), ownerId: userId, kind: 'USER_HELD', currency: 'USD' },
    ],
    skipDuplicates: true,
  })
}

async function lockAccounts(tx: DbTransaction, codes: string[]): Promise<Map<string, LockedAccount>> {
  const orderedCodes = [...new Set(codes)].sort()
  const rows = await tx.$queryRaw<LockedAccount[]>(Prisma.sql`
    SELECT "id", "code", "balanceCents"
    FROM "ledger_accounts"
    WHERE "code" IN (${Prisma.join(orderedCodes)})
    ORDER BY "code"
    FOR UPDATE
  `)
  if (rows.length !== orderedCodes.length) {
    const found = new Set(rows.map(row => row.code))
    throw new Error(`Ledger account not found: ${orderedCodes.find(code => !found.has(code))}`)
  }
  return new Map(rows.map(row => [row.code, row]))
}

async function postJournal(
  tx: DbTransaction,
  input: {
    idempotencyKey: string
    kind: JournalKind
    escrowId?: string
    entries: PostingEntry[]
  },
) {
  assertBalancedEntries(input.entries)

  const existing = await tx.journalTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existing) {
    if (existing.status !== 'POSTED' || existing.kind !== input.kind || existing.escrowId !== (input.escrowId ?? null)) {
      throw new Error('Idempotency key conflicts with a different journal transaction')
    }
    return existing
  }

  const accounts = await tx.ledgerAccount.findMany({
    where: { code: { in: [...new Set(input.entries.map(entry => entry.accountCode))] } },
    select: { id: true, code: true },
  })
  const accountIds = new Map(accounts.map(account => [account.code, account.id]))
  if (accountIds.size !== new Set(input.entries.map(entry => entry.accountCode)).size) {
    throw new Error('Journal references a missing ledger account')
  }

  const journal = await tx.journalTransaction.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      escrowId: input.escrowId,
      entries: {
        create: input.entries.map(entry => ({
          accountId: accountIds.get(entry.accountCode)!,
          entryType: entry.entryType,
          amountCents: entry.amountCents,
        })),
      },
    },
  })

  return tx.journalTransaction.update({
    where: { id: journal.id },
    data: { status: 'POSTED', postedAt: new Date() },
  })
}

async function findPostedJournal(
  tx: DbTransaction,
  idempotencyKey: string,
  kind: JournalKind,
  escrowId?: string,
) {
  const existing = await tx.journalTransaction.findUnique({ where: { idempotencyKey } })
  if (!existing) return null
  if (existing.status !== 'POSTED' || existing.kind !== kind || existing.escrowId !== (escrowId ?? null)) {
    throw new Error('Idempotency key conflicts with a different journal transaction')
  }
  return existing
}

function requirePositive(amountCents: bigint) {
  if (amountCents <= 0n) throw new Error('Amount must be positive')
}

export async function issueDemoFunds(
  tx: DbTransaction,
  { userId, amountCents, idempotencyKey }: { userId: string; amountCents: bigint; idempotencyKey: string },
) {
  requirePositive(amountCents)
  await ensureUserLedgerAccounts(tx, userId)
  const existing = await findPostedJournal(tx, idempotencyKey, 'INITIAL_FUNDING')
  if (existing) return existing
  const available = ledgerAccountCodes.available(userId)
  await lockAccounts(tx, [available, ledgerAccountCodes.issuance])
  return postJournal(tx, {
    idempotencyKey,
    kind: 'INITIAL_FUNDING',
    entries: [
      { accountCode: ledgerAccountCodes.issuance, entryType: 'DEBIT', amountCents },
      { accountCode: available, entryType: 'CREDIT', amountCents },
    ],
  })
}

export async function reserveEscrowFunds(
  tx: DbTransaction,
  { buyerId, escrowId, amountCents, idempotencyKeyPrefix }: { buyerId: string; escrowId: string; amountCents: bigint; idempotencyKeyPrefix: string },
) {
  requirePositive(amountCents)
  const journalKey = `${idempotencyKeyPrefix}:reserve`
  const existing = await findPostedJournal(tx, journalKey, 'ESCROW_RESERVE', escrowId)
  if (existing) return existing
  const available = ledgerAccountCodes.available(buyerId)
  const held = ledgerAccountCodes.held(buyerId)
  const accounts = await lockAccounts(tx, [available, held])
  if (accounts.get(available)!.balanceCents < amountCents) throw new Error('Insufficient available balance')

  return postJournal(tx, {
    idempotencyKey: journalKey,
    kind: 'ESCROW_RESERVE',
    escrowId,
    entries: [
      { accountCode: available, entryType: 'DEBIT', amountCents },
      { accountCode: held, entryType: 'CREDIT', amountCents },
    ],
  })
}

export async function releaseEscrowFunds(
  tx: DbTransaction,
  { buyerId, sellerId, escrowId, amountCents, idempotencyKeyPrefix }: { buyerId: string; sellerId: string; escrowId: string; amountCents: bigint; idempotencyKeyPrefix: string },
) {
  requirePositive(amountCents)
  const journalKey = `${idempotencyKeyPrefix}:release`
  const existing = await findPostedJournal(tx, journalKey, 'ESCROW_RELEASE', escrowId)
  if (existing) return existing
  const buyerHeld = ledgerAccountCodes.held(buyerId)
  const sellerAvailable = ledgerAccountCodes.available(sellerId)
  const accounts = await lockAccounts(tx, [buyerHeld, sellerAvailable, ledgerAccountCodes.platformFee])
  if (accounts.get(buyerHeld)!.balanceCents < amountCents) throw new Error('Insufficient held balance')
  const { sellerAmountCents, feeCents } = releaseAllocation(amountCents)

  return postJournal(tx, {
    idempotencyKey: journalKey,
    kind: 'ESCROW_RELEASE',
    escrowId,
    entries: [
      { accountCode: buyerHeld, entryType: 'DEBIT', amountCents },
      { accountCode: sellerAvailable, entryType: 'CREDIT', amountCents: sellerAmountCents },
      ...(feeCents > 0n ? [{ accountCode: ledgerAccountCodes.platformFee, entryType: 'CREDIT' as const, amountCents: feeCents }] : []),
    ],
  })
}

export async function refundEscrowFunds(
  tx: DbTransaction,
  { buyerId, escrowId, amountCents, idempotencyKeyPrefix }: { buyerId: string; escrowId: string; amountCents: bigint; idempotencyKeyPrefix: string },
) {
  requirePositive(amountCents)
  const journalKey = `${idempotencyKeyPrefix}:refund`
  const existing = await findPostedJournal(tx, journalKey, 'ESCROW_REFUND', escrowId)
  if (existing) return existing
  const available = ledgerAccountCodes.available(buyerId)
  const held = ledgerAccountCodes.held(buyerId)
  const accounts = await lockAccounts(tx, [available, held])
  if (accounts.get(held)!.balanceCents < amountCents) throw new Error('Insufficient held balance')

  return postJournal(tx, {
    idempotencyKey: journalKey,
    kind: 'ESCROW_REFUND',
    escrowId,
    entries: [
      { accountCode: held, entryType: 'DEBIT', amountCents },
      { accountCode: available, entryType: 'CREDIT', amountCents },
    ],
  })
}

export async function partialRefundEscrowFunds(
  tx: DbTransaction,
  input: { buyerId: string; sellerId: string; escrowId: string; totalAmountCents: bigint; refundAmountCents: bigint; idempotencyKeyPrefix: string },
) {
  const allocation = partialRefundAllocation(input.totalAmountCents, input.refundAmountCents)
  const journalKey = `${input.idempotencyKeyPrefix}:partial-refund`
  const existing = await findPostedJournal(tx, journalKey, 'ESCROW_PARTIAL_REFUND', input.escrowId)
  if (existing) return existing
  const buyerHeld = ledgerAccountCodes.held(input.buyerId)
  const buyerAvailable = ledgerAccountCodes.available(input.buyerId)
  const sellerAvailable = ledgerAccountCodes.available(input.sellerId)
  const accounts = await lockAccounts(tx, [buyerHeld, buyerAvailable, sellerAvailable, ledgerAccountCodes.platformFee])
  if (accounts.get(buyerHeld)!.balanceCents < input.totalAmountCents) throw new Error('Insufficient held balance')

  return postJournal(tx, {
    idempotencyKey: journalKey,
    kind: 'ESCROW_PARTIAL_REFUND',
    escrowId: input.escrowId,
    entries: [
      { accountCode: buyerHeld, entryType: 'DEBIT', amountCents: input.totalAmountCents },
      { accountCode: buyerAvailable, entryType: 'CREDIT', amountCents: allocation.refundAmountCents },
      { accountCode: sellerAvailable, entryType: 'CREDIT', amountCents: allocation.sellerAmountCents },
      ...(allocation.feeCents > 0n ? [{ accountCode: ledgerAccountCodes.platformFee, entryType: 'CREDIT' as const, amountCents: allocation.feeCents }] : []),
    ],
  })
}

