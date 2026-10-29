import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { lockEscrow, transitionEscrow } from '../src/lib/escrow-state-machine'
import { envelopeDecrypt, envelopeEncrypt } from '../src/lib/crypto'

const prisma = new PrismaClient()
after(async () => prisma.$disconnect())

test('PostgreSQL rejects bypasses and serializes competing terminal transitions', async () => {
  const run = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const [buyer, seller] = await Promise.all([
    prisma.user.create({ data: { email: `state-buyer-${run}@test.local` } }),
    prisma.user.create({ data: { email: `state-seller-${run}@test.local` } }),
  ])
  const initial = await prisma.escrowTransaction.create({
    data: {
      title: 'State race',
      priceCents: 1_000n,
      buyerId: buyer.id,
      sellerId: seller.id,
      submissionDeadline: new Date(Date.now() + 172_800_000),
    },
  })
  assert.ok(Math.abs(Date.now() - initial.createdAt.getTime()) < 60_000)
  process.env.MASTER_KEY = randomBytes(32).toString('hex')
  const encrypted = envelopeEncrypt('delivery secret', initial.id)
  const escrow = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Kolkata'`
    return transitionEscrow(tx, {
      escrow: await lockEscrow(tx, initial.id),
      transition: 'SUBMIT_CREDENTIALS',
      actor: { type: 'USER', id: seller.id },
      credentials: {
        verificationDeadline: new Date(Date.now() + 2_000),
        ...encrypted,
      },
    })
  })
  assert.equal(envelopeDecrypt(escrow.encryptedCredentials!, escrow.wrappedCredentialKey, escrow.id), 'delivery secret')
  await new Promise(resolve => setTimeout(resolve, 2_100))

  await assert.rejects(prisma.escrowTransaction.update({
    where: { id: escrow.id },
    data: { status: 'REFUNDED', version: { increment: 1 }, wrappedCredentialKey: null },
  }), /invalid escrow transition/)

  const attempts = await Promise.allSettled([
    prisma.$transaction(async tx => transitionEscrow(tx, {
      escrow: await lockEscrow(tx, escrow.id),
      transition: 'CONFIRM_RELEASE',
      actor: { type: 'USER', id: buyer.id },
    })),
    prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Kolkata'`
      return transitionEscrow(tx, {
        escrow: await lockEscrow(tx, escrow.id),
        transition: 'AUTO_RELEASE',
        actor: { type: 'SYSTEM' },
      })
    }),
  ])

  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
  const final = await prisma.escrowTransaction.findUniqueOrThrow({ where: { id: escrow.id } })
  assert.ok(final.status === 'RELEASED' || final.status === 'AUTO_RELEASED')
  assert.equal(final.version, 2)
  assert.equal(final.wrappedCredentialKey, null)
  assert.throws(() => envelopeDecrypt(final.encryptedCredentials!, final.wrappedCredentialKey, final.id))
  assert.equal(await prisma.escrowEvent.count({ where: { escrowId: escrow.id } }), 2)
})
