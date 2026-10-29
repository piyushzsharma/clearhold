import { Prisma } from '@prisma/client'
import {
  assertTransitionDeadline,
  nextEscrowState,
  type EscrowState,
  type EscrowTransition,
} from './escrow-state-policy'

type DbTransaction = Prisma.TransactionClient

export type LockedEscrow = {
  id: string
  status: EscrowState
  version: number
  buyerId: string
  sellerId: string
  priceCents: bigint
  submissionDeadline: Date
  verificationDeadline: Date | null
}

export class EscrowNotFoundError extends Error {
  constructor() {
    super('Escrow not found')
    this.name = 'EscrowNotFoundError'
  }
}

export class EscrowVersionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`Concurrency conflict: expected version ${expected}, found ${actual}`)
    this.name = 'EscrowVersionConflictError'
  }
}

const eventTypes: Record<EscrowTransition, string> = {
  SUBMIT_CREDENTIALS: 'CredentialsSubmitted',
  CONFIRM_RELEASE: 'Released',
  AUTO_RELEASE: 'AutoReleased',
  OPEN_DISPUTE: 'Disputed',
  TIMEOUT_REFUND: 'TimeoutRefunded',
  ADMIN_RELEASE: 'AdminReleased',
  ADMIN_REFUND: 'AdminRefunded',
  ADMIN_PARTIAL_REFUND: 'AdminPartiallyRefunded',
}

export async function lockEscrow(tx: DbTransaction, escrowId: string): Promise<LockedEscrow> {
  const rows = await tx.$queryRaw<LockedEscrow[]>(Prisma.sql`
    SELECT id, status, version, "buyerId", "sellerId", "priceCents",
           "submissionDeadline", "verificationDeadline"
    FROM "escrow_transactions"
    WHERE id = ${escrowId}
    FOR UPDATE
  `)
  if (rows.length === 0) throw new EscrowNotFoundError()
  return rows[0]
}

export function assertEscrowVersion(escrow: LockedEscrow, expectedVersion: number) {
  if (escrow.version !== expectedVersion) {
    throw new EscrowVersionConflictError(expectedVersion, escrow.version)
  }
}

export async function createEscrow(tx: DbTransaction, input: {
  title: string
  priceCents: bigint
  buyerId: string
  sellerId: string
  submissionDeadline: Date
}) {
  const escrow = await tx.escrowTransaction.create({
    data: { ...input, status: 'AWAITING_CREDENTIALS' },
  })
  await tx.escrowEvent.create({
    data: {
      escrowId: escrow.id,
      type: 'EscrowCreated',
      actorId: input.buyerId,
      metadata: { toStatus: 'AWAITING_CREDENTIALS', priceCents: Number(input.priceCents), sellerId: input.sellerId },
    },
  })
  return escrow
}

export async function transitionEscrow(tx: DbTransaction, input: {
  escrow: LockedEscrow
  transition: EscrowTransition
  actor: { type: 'USER'; id: string } | { type: 'SYSTEM' }
  now?: Date
  metadata?: Prisma.InputJsonObject
  credentials?: {
    encryptedCredentials: string
    wrappedCredentialKey: string
    verificationDeadline: Date
  }
}) {
  const now = input.now ?? new Date()
  const nextStatus = nextEscrowState(input.escrow.status, input.transition)
  if (input.transition === 'SUBMIT_CREDENTIALS' && !input.credentials) {
    throw new Error('SUBMIT_CREDENTIALS requires encrypted credentials and a verification deadline')
  }
  assertTransitionDeadline({
    transition: input.transition,
    now,
    submissionDeadline: input.escrow.submissionDeadline,
    verificationDeadline: input.credentials?.verificationDeadline ?? input.escrow.verificationDeadline,
  })

  const terminal = ['RELEASED', 'AUTO_RELEASED', 'REFUNDED', 'PARTIAL_REFUND'].includes(nextStatus)
  const updated = await tx.escrowTransaction.update({
    where: { id: input.escrow.id },
    data: {
      status: nextStatus,
      version: { increment: 1 },
      ...(input.credentials ?? {}),
      ...(terminal ? { wrappedCredentialKey: null } : {}),
    },
  })

  await tx.escrowEvent.create({
    data: {
      escrowId: input.escrow.id,
      type: eventTypes[input.transition],
      actorType: input.actor.type,
      actorId: input.actor.type === 'USER' ? input.actor.id : null,
      metadata: {
        transition: input.transition,
        fromStatus: input.escrow.status,
        toStatus: nextStatus,
        fromVersion: input.escrow.version,
        toVersion: input.escrow.version + 1,
        ...(input.metadata ?? {}),
      },
    },
  })
  return updated
}
