import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'
import { envelopeDecrypt, envelopeEncrypt } from './crypto'

const previousKey = process.env.MASTER_KEY
before(() => { process.env.MASTER_KEY = randomBytes(32).toString('hex') })
after(() => {
  if (previousKey === undefined) delete process.env.MASTER_KEY
  else process.env.MASTER_KEY = previousKey
})

test('round trip uses different DEKs and nonces for the same credential', () => {
  const first = envelopeEncrypt('secret password', 'escrow-a')
  const second = envelopeEncrypt('secret password', 'escrow-a')
  assert.notEqual(first.encryptedCredentials, second.encryptedCredentials)
  assert.notEqual(first.wrappedCredentialKey, second.wrappedCredentialKey)
  assert.equal(envelopeDecrypt(first.encryptedCredentials, first.wrappedCredentialKey, 'escrow-a'), 'secret password')
})

test('escrow binding rejects copying an envelope to another escrow', () => {
  const value = envelopeEncrypt('secret', 'escrow-a')
  assert.throws(() => envelopeDecrypt(value.encryptedCredentials, value.wrappedCredentialKey, 'escrow-b'))
  const other = envelopeEncrypt('different', 'escrow-a')
  assert.throws(() => envelopeDecrypt(value.encryptedCredentials, other.wrappedCredentialKey, 'escrow-a'))
})

test('tampering, malformed envelopes, and a missing wrapped key fail closed', () => {
  const value = envelopeEncrypt('secret', 'escrow-a')
  const part = JSON.parse(value.encryptedCredentials)
  part.authTag = '0'.repeat(32)
  assert.throws(() => envelopeDecrypt(JSON.stringify(part), value.wrappedCredentialKey, 'escrow-a'))
  assert.throws(() => envelopeDecrypt('{', value.wrappedCredentialKey, 'escrow-a'))
  assert.throws(() => envelopeDecrypt(JSON.stringify({ ...JSON.parse(value.encryptedCredentials), version: 1 }), value.wrappedCredentialKey, 'escrow-a'))
  assert.throws(() => envelopeDecrypt(value.encryptedCredentials, null, 'escrow-a'))
})

test('missing or malformed master key never creates an ephemeral substitute', () => {
  const original = process.env.MASTER_KEY
  for (const key of [undefined, 'abc', 'z'.repeat(64)]) {
    if (key === undefined) delete process.env.MASTER_KEY
    else process.env.MASTER_KEY = key
    assert.throws(() => envelopeEncrypt('secret', 'escrow-a'), /MASTER_KEY/)
  }
  process.env.MASTER_KEY = original
})

test('wrong master key cannot decrypt an existing envelope', () => {
  const value = envelopeEncrypt('secret', 'escrow-a')
  const original = process.env.MASTER_KEY
  process.env.MASTER_KEY = randomBytes(32).toString('hex')
  assert.throws(() => envelopeDecrypt(value.encryptedCredentials, value.wrappedCredentialKey, 'escrow-a'))
  process.env.MASTER_KEY = original
})
