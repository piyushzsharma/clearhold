import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function readTree(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .map(entry => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? readTree(path) : readFileSync(path, 'utf8')
    })
    .join('\n')
}

describe('legacy payment boundary', () => {
  it('does not depend on the ClearHold ledger', () => {
    const legacyRoutes = readTree(join(process.cwd(), 'src', 'app', 'api', 'legacy'))
    assert.doesNotMatch(legacyRoutes, /ledgerEntry|ledger_entries|EscrowTransaction|escrowTransaction/)
  })

  it('uses a dedicated legacy balance store', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
    assert.match(schema, /model LegacyWallet/)
    assert.doesNotMatch(schema, /transactionId\s+String/)
  })
})

