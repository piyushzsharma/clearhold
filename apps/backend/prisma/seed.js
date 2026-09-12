import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 12)

  const client1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john@example.com',
      password: hashedPassword,
      role: 'CLIENT',
    },
  })

  const client2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      password: hashedPassword,
      role: 'CLIENT',
    },
  })

  const merchant1 = await prisma.user.upsert({
    where: { email: 'store@example.com' },
    update: {},
    create: {
      name: 'Tech Store',
      email: 'store@example.com',
      password: hashedPassword,
      role: 'MERCHANT',
    },
  })

  const merchant2 = await prisma.user.upsert({
    where: { email: 'cafe@example.com' },
    update: {},
    create: {
      name: 'Coffee Cafe',
      email: 'cafe@example.com',
      password: hashedPassword,
      role: 'MERCHANT',
    },
  })

  // Create wallets
  await prisma.wallet.upsert({
    where: { userId: client1.id },
    update: {},
    create: {
      userId: client1.id,
      balance: 1500.00,
    },
  })

  await prisma.wallet.upsert({
    where: { userId: client2.id },
    update: {},
    create: {
      userId: client2.id,
      balance: 2000.00,
    },
  })

  await prisma.wallet.upsert({
    where: { userId: merchant1.id },
    update: {},
    create: {
      userId: merchant1.id,
      balance: 5000.00,
    },
  })

  await prisma.wallet.upsert({
    where: { userId: merchant2.id },
    update: {},
    create: {
      userId: merchant2.id,
      balance: 3000.00,
    },
  })

  // Create sample transactions
  await prisma.transaction.createMany({
    data: [
      {
        senderId: client1.id,
        receiverId: client2.id,
        amount: 50.00,
        type: 'P2P_TRANSFER',
        status: 'COMPLETED',
        description: 'Lunch money',
      },
      {
        senderId: client2.id,
        receiverId: merchant1.id,
        amount: 299.99,
        type: 'MERCHANT_PAYMENT',
        status: 'COMPLETED',
        description: 'Laptop purchase',
      },
      {
        senderId: client1.id,
        receiverId: merchant2.id,
        amount: 15.50,
        type: 'MERCHANT_PAYMENT',
        status: 'COMPLETED',
        description: 'Coffee and pastry',
      },
    ],
  })

  console.log('✅ Seed completed successfully!')
  console.log('📧 Sample accounts:')
  console.log('   john@example.com (CLIENT) - password: password123')
  console.log('   jane@example.com (CLIENT) - password: password123')
  console.log('   store@example.com (MERCHANT) - password: password123')
  console.log('   cafe@example.com (MERCHANT) - password: password123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
