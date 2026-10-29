import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  commandJournalPrefix,
  commandLockId,
  requestFingerprint,
  requireIdempotencyKey,
} from './idempotency-policy'

describe('durable request idempotency policy', () => {
  it('requires bounded, transport-safe keys', () => {
    assert.equal(requireIdempotencyKey('12345678'), '12345678')
    assert.throws(() => requireIdempotencyKey(null), /8-128/)
    assert.throws(() => requireIdempotencyKey('short'), /8-128/)
    assert.throws(() => requireIdempotencyKey('a'.repeat(129)), /8-128/)
    assert.throws(() => requireIdempotencyKey('has spaces 123'), /8-128/)
  })

  it('uses a keyed fingerprint without storing credential plaintext', () => {
    const key = 'ab'.repeat(32)
    const fingerprint = requestFingerprint('{"credentialsPlaintext":"secret"}', key)
    assert.match(fingerprint, /^[0-9a-f]{64}$/)
    assert.notEqual(fingerprint, requestFingerprint('{"credentialsPlaintext":"other"}', key))
    assert.notEqual(fingerprint, requestFingerprint('{"credentialsPlaintext":"secret"}', 'cd'.repeat(32)))
    assert.throws(() => requestFingerprint('secret', ''), /IDEMPOTENCY_HASH_KEY/)
  })

  it('scopes financial journal keys by actor, method, path, and command key', () => {
    const base = { principalId: 'buyer-a', method: 'POST', path: '/api/escrow/create', key: 'same-key-123' }
    const prefix = commandJournalPrefix(base)
    assert.equal(prefix, commandJournalPrefix(base))
    assert.notEqual(prefix, commandJournalPrefix({ ...base, principalId: 'buyer-b' }))
    assert.notEqual(prefix, commandJournalPrefix({ ...base, path: '/api/escrow/other' }))
    assert.equal(commandLockId(base), commandLockId(base))
    assert.notEqual(commandLockId(base), commandLockId({ ...base, principalId: 'buyer-b' }))
  })

  it('tracks a unique, append-only PostgreSQL command record', () => {
    const migration = readFileSync(
      join(process.cwd(), 'prisma', 'migrations', '20261015050000_durable_request_idempotency', 'migration.sql'),
      'utf8',
    )
    assert.match(migration, /UNIQUE INDEX "idempotency_records_principal_method_path_key"/)
    assert.match(migration, /idempotency_records_append_only/)
  })
})
