export type PostingEntry = {
  accountCode: string
  entryType: 'DEBIT' | 'CREDIT'
  amountCents: bigint
}

export const PLATFORM_FEE_BASIS_POINTS = 500n
const BASIS_POINT_DENOMINATOR = 10_000n

export function calculatePlatformFee(amountCents: bigint): bigint {
  if (amountCents <= 0n) throw new Error('Amount must be positive')
  return amountCents * PLATFORM_FEE_BASIS_POINTS / BASIS_POINT_DENOMINATOR
}

export function releaseAllocation(amountCents: bigint) {
  const feeCents = calculatePlatformFee(amountCents)
  return { feeCents, sellerAmountCents: amountCents - feeCents }
}

export function partialRefundAllocation(totalAmountCents: bigint, refundAmountCents: bigint) {
  if (refundAmountCents <= 0n || refundAmountCents >= totalAmountCents) {
    throw new Error('Partial refund must be positive and less than total amount')
  }
  const sellerGrossCents = totalAmountCents - refundAmountCents
  const feeCents = calculatePlatformFee(sellerGrossCents)
  return {
    refundAmountCents,
    sellerAmountCents: sellerGrossCents - feeCents,
    feeCents,
  }
}

export function assertBalancedEntries(entries: PostingEntry[]): void {
  if (entries.length < 2) throw new Error('A journal transaction requires at least two entries')
  if (entries.some(entry => entry.amountCents <= 0n)) throw new Error('Journal amounts must be positive')

  const debits = entries
    .filter(entry => entry.entryType === 'DEBIT')
    .reduce((sum, entry) => sum + entry.amountCents, 0n)
  const credits = entries
    .filter(entry => entry.entryType === 'CREDIT')
    .reduce((sum, entry) => sum + entry.amountCents, 0n)

  if (debits !== credits) throw new Error(`Unbalanced journal: debits=${debits}, credits=${credits}`)
}

