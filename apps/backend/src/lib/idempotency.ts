import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import {
  IdempotencyConflictError,
  IdempotencyInputError,
  commandJournalPrefix,
  commandLockId,
  requestFingerprint,
  requireIdempotencyKey,
} from './idempotency-policy'

type DbTransaction = Prisma.TransactionClient
type CommandBody = Record<string, unknown>
type CommandResult = { status: number; body: CommandBody }

export { IdempotencyConflictError, IdempotencyInputError }

export class IdempotencyRetryableError extends Error {
  readonly status = 503
  constructor() {
    super('Command is busy; retry with the same Idempotency-Key')
  }
}

export function idempotencyErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof IdempotencyInputError || error instanceof IdempotencyConflictError || error instanceof IdempotencyRetryableError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status, headers: error instanceof IdempotencyRetryableError ? { 'Retry-After': '1' } : undefined },
    )
  }
  return null
}

export async function executeIdempotentCommand(input: {
  db: PrismaClient
  request: Request
  rawBody?: string
  principalId: string
  run: (tx: DbTransaction, journalPrefix: string) => Promise<CommandResult>
}): Promise<{ response: NextResponse; replayed: boolean }> {
  const key = requireIdempotencyKey(input.request.headers.get('idempotency-key'))
  const method = input.request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    throw new IdempotencyInputError('Idempotency applies only to mutating requests')
  }
  const requestUrl = new URL(input.request.url)
  const path = requestUrl.pathname + requestUrl.search
  const principalId = input.principalId
  const requestHash = requestFingerprint(
    input.rawBody ?? await input.request.clone().text(),
    process.env.IDEMPOTENCY_HASH_KEY,
  )
  const scope = { principalId, method, path, key }
  const journalPrefix = commandJournalPrefix(scope)
  const lockId = commandLockId(scope)

  let result: { status: number; body: Prisma.JsonValue | Prisma.InputJsonValue; replayed: boolean }
  try {
    result = await input.db.$transaction(async tx => {
      // A transaction-scoped advisory lock serializes callers with this scope.
      // No pending record can survive a crash. The unique index is the final guard.
      await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
        SELECT 1 AS locked FROM pg_advisory_xact_lock(${lockId})
      `)
      const existing = await tx.idempotencyRecord.findUnique({
        where: { principalId_method_path_key: { principalId, method, path, key } },
      })
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new IdempotencyConflictError('Idempotency-Key was already used with a different request body')
        }
        return { status: existing.responseStatus, body: existing.responseBody, replayed: true }
      }

      const response = await input.run(tx, journalPrefix)
      if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
        throw new Error('Only successful command results can be committed')
      }
      const body = JSON.parse(JSON.stringify(response.body)) as Prisma.InputJsonValue
      await tx.idempotencyRecord.create({
        data: { id: randomUUID(), principalId, method, path, key, requestHash, responseStatus: response.status, responseBody: body },
      })
      return { status: response.status, body, replayed: false }
    }, { maxWait: 10_000, timeout: 30_000 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2028', 'P2034'].includes(error.code)) {
      throw new IdempotencyRetryableError()
    }
    throw error
  }

  return {
    response: NextResponse.json(result.body, { status: result.status }),
    replayed: result.replayed,
  }
}
