import { createHash, createHmac } from 'node:crypto'

export class IdempotencyInputError extends Error {
  readonly status = 400
}

export class IdempotencyConflictError extends Error {
  readonly status = 409
}

export function requireIdempotencyKey(value: string | null): string {
  if (!value || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new IdempotencyInputError('Idempotency-Key must be 8-128 letters, digits, underscores, or hyphens')
  }
  return value
}

export function requestDigest(body: string): string {
  return createHash('sha256').update(body).digest('hex')
}

export function requestFingerprint(body: string, secretHex: string | undefined): string {
  if (!secretHex || !/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error('IDEMPOTENCY_HASH_KEY must be 32 random bytes encoded as 64 hex characters')
  }
  return createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update('clearhold:idempotency:v1\0')
    .update(body)
    .digest('hex')
}

type CommandScope = {
  principalId: string
  method: string
  path: string
  key: string
}

function serializeScope(input: CommandScope): string {
  return JSON.stringify([input.principalId, input.method, input.path, input.key])
}

export function commandJournalPrefix(input: CommandScope): string {
  return `command:${requestDigest(serializeScope(input))}`
}

export function commandLockId(input: CommandScope): bigint {
  return createHash('sha256').update(serializeScope(input)).digest().readBigInt64BE(0)
}
