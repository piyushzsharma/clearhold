import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const availableCode = userId => `user:${userId}:available:USD`
const heldCode = userId => `user:${userId}:held:USD`

async function ensureSeedAccounts(tx, userId) {
  await tx.ledgerAccount.createMany({
    data: [
      { code: availableCode(userId), ownerId: userId, kind: 'USER_AVAILABLE' },
      { code: heldCode(userId), ownerId: userId, kind: 'USER_HELD' },
    ],
    skipDuplicates: true,
  })
}

async function seedDemoFunds(tx, userId) {
  const idempotencyKey = `demo-initial-funding:${userId}`
  if (await tx.journalTransaction.findUnique({ where: { idempotencyKey } })) return

  const accounts = await tx.ledgerAccount.findMany({
    where: { code: { in: [availableCode(userId), 'system:issuance:USD'] } },
  })
  const ids = new Map(accounts.map(account => [account.code, account.id]))
  if (ids.size !== 2) throw new Error('Seed ledger accounts are missing; apply migrations first')
  const journal = await tx.journalTransaction.create({
    data: {
      idempotencyKey,
      kind: 'INITIAL_FUNDING',
      entries: {
        create: [
          { accountId: ids.get('system:issuance:USD'), entryType: 'DEBIT', amountCents: 100_000 },
          { accountId: ids.get(availableCode(userId)), entryType: 'CREDIT', amountCents: 100_000 },
        ],
      },
    },
  })
  await tx.journalTransaction.update({
    where: { id: journal.id },
    data: { status: 'POSTED', postedAt: new Date() },
  })
}

const demoUsers = [
  { name: 'Demo Buyer', email: 'buyer@clearhold.local', role: 'CLIENT', platformRole: 'USER', createFinancialAccounts: true },
  { name: 'Demo Seller', email: 'seller@clearhold.local', role: 'CLIENT', platformRole: 'USER', createFinancialAccounts: true },
  { name: 'Legacy Client', email: 'legacy-client@clearhold.local', role: 'CLIENT', platformRole: 'USER', createFinancialAccounts: true },
  { name: 'Legacy Merchant', email: 'legacy-merchant@clearhold.local', role: 'MERCHANT', platformRole: 'USER', createFinancialAccounts: true },
  { name: 'Demo Administrator', email: 'admin@clearhold.local', role: 'CLIENT', platformRole: 'ADMIN', createFinancialAccounts: false },
]

async function main() {
  const password = await bcrypt.hash('ClearHoldDemo123!', 12)

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: { name: demoUser.name, role: demoUser.role, platformRole: demoUser.platformRole },
      create: {
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        platformRole: demoUser.platformRole,
        password,
      },
    })

    if (demoUser.createFinancialAccounts) {
      await prisma.$transaction(async (tx) => ensureSeedAccounts(tx, user.id))

      await prisma.legacyWallet.upsert({
        where: { userId: user.id },
        update: demoUser.email === 'legacy-client@clearhold.local'
          ? { balanceCents: 100_000 }
          : {},
        create: {
          userId: user.id,
          balanceCents: demoUser.email === 'legacy-client@clearhold.local' ? 100_000 : 0,
        },
      })
    }

    if (demoUser.email === 'buyer@clearhold.local') {
      await prisma.$transaction(async (tx) => seedDemoFunds(tx, user.id))
    }
  }

  console.log('Seeded ClearHold accounts plus isolated PAYSTREAM demo wallets.')
  console.log('Demo password: ClearHoldDemo123!')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
