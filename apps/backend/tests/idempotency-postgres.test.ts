import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { executeIdempotentCommand, IdempotencyConflictError } from '../src/lib/idempotency'

const prisma = new PrismaClient()
after(async () => prisma.$disconnect())

test('concurrent duplicates, changed payloads, and rollback use one durable command result', async () => {
  process.env.IDEMPOTENCY_HASH_KEY = 'ab'.repeat(32)
  const run = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const user = await prisma.user.create({ data: { email: `idempotency-${run}@test.local` } })
  await prisma.legacyWallet.create({ data: { userId: user.id, balanceCents: 0n } })

  const execute = (key: string, amount: number, shouldFail = false) => {
    const request = new Request('http://localhost/api/test/credit', {
      method: 'POST',
      headers: { 'Idempotency-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    return executeIdempotentCommand({
      db: prisma,
      request,
      principalId: user.id,
      run: async tx => {
        const wallet = await tx.legacyWallet.update({
          where: { userId: user.id },
          data: { balanceCents: { increment: BigInt(amount) } },
        })
        if (shouldFail) throw new Error('simulated crash before commit')
        return { status: 200, body: { balanceCents: wallet.balanceCents.toString() } }
      },
    })
  }

  const [first, duplicate] = await Promise.all([
    execute(`concurrent-${run}`, 100),
    execute(`concurrent-${run}`, 100),
  ])
  assert.deepEqual(await first.response.json(), await duplicate.response.json())
  assert.equal([first.replayed, duplicate.replayed].filter(Boolean).length, 1)
  assert.equal((await prisma.legacyWallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceCents, 100n)

  await assert.rejects(execute(`concurrent-${run}`, 200), IdempotencyConflictError)
  await assert.rejects(execute(`rollback-${run}`, 25, true), /simulated crash/)
  assert.equal(await prisma.idempotencyRecord.count({ where: { principalId: user.id } }), 1)
  assert.equal((await prisma.legacyWallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceCents, 100n)

  const retried = await execute(`rollback-${run}`, 25)
  assert.equal(retried.replayed, false)
  assert.deepEqual(await retried.response.json(), { balanceCents: '125' })
  assert.equal(await prisma.idempotencyRecord.count({ where: { principalId: user.id } }), 2)
  const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { principalId: user.id } })
  await assert.rejects(prisma.idempotencyRecord.update({
    where: { id: record.id },
    data: { responseStatus: 201 },
  }), /append only/)
})
