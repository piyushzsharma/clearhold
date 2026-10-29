import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 16) {
  throw new Error('Set ADMIN_EMAIL to a valid email and ADMIN_PASSWORD to at least 16 characters')
}

const db = new PrismaClient()
try {
  const passwordHash = await bcrypt.hash(password, 12)
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(781733991)`
    if (await tx.user.count({ where: { platformRole: 'ADMIN' } })) {
      throw new Error('An administrator already exists; bootstrap is disabled')
    }
    if (await tx.user.findUnique({ where: { email } })) {
      throw new Error('That email already belongs to an account')
    }
    await tx.user.create({ data: { email, password: passwordHash, platformRole: 'ADMIN', role: 'CLIENT', name: 'Administrator' } })
  })
  console.log(`Administrator created: ${email}`)
} finally {
  await db.$disconnect()
}
