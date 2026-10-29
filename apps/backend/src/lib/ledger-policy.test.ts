import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  assertBalancedEntries,
  calculatePlatformFee,
  partialRefundAllocation,
  releaseAllocation,
} from './ledger-policy'

describe('ledger posting policy', () => {
  it('uses integer basis-point fee arithmetic', () => {
    assert.equal(calculatePlatformFee(10_000n), 500n)
    assert.equal(calculatePlatformFee(101n), 5n)
    assert.deepEqual(releaseAllocation(101n), { sellerAmountCents: 96n, feeCents: 5n })
  })

  it('allocates every cent in a partial refund', () => {
    const allocation = partialRefundAllocation(10_000n, 4_000n)
    assert.deepEqual(allocation, {
      refundAmountCents: 4_000n,
      sellerAmountCents: 5_700n,
      feeCents: 300n,
    })
    assert.equal(
      allocation.refundAmountCents + allocation.sellerAmountCents + allocation.feeCents,
      10_000n,
    )
  })

  it('rejects invalid partial refunds and unbalanced postings', () => {
    assert.throws(() => partialRefundAllocation(100n, 100n), /less than total/)
    assert.throws(() => assertBalancedEntries([
      { accountCode: 'a', entryType: 'DEBIT', amountCents: 100n },
      { accountCode: 'b', entryType: 'CREDIT', amountCents: 99n },
    ]), /Unbalanced journal/)
  })

  it('keeps database constraints that enforce the journal boundary', () => {
    const migration = readFileSync(
      join(process.cwd(), 'prisma', 'migrations', '20261015030000_balanced_immutable_journal', 'migration.sql'),
      'utf8',
    )
    assert.match(migration, /ledger_entries_positive_amount_check/)
    assert.match(migration, /journal_transactions_controlled_transition/)
    assert.match(migration, /ledger_entries_append_only/)
    assert.match(migration, /journal_transactions_must_post/)
    assert.match(migration, /ledger_accounts_user_balance_check/)
  })
})

