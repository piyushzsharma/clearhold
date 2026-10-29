import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { withAuthorization } from '@/lib/authorization'
import { executeIdempotentCommand, idempotencyErrorResponse } from '@/lib/idempotency'
import { z } from 'zod'

const transferSchema = z.object({
  receiverEmail: z.string().email('Invalid receiver email').transform(value => value.trim().toLowerCase()),
  amount: z.number().positive('Amount must be positive').max(10000, 'Amount too large'),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['P2P_TRANSFER', 'MERCHANT_PAYMENT']).default('P2P_TRANSFER'),
})

async function rateLimited(request) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  return !(await rateLimit(clientIP))
}

async function listTransfers(request, _context, principal) {
  if (await rateLimited(request)) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10))
    const where = { OR: [{ senderId: principal.id }, { receiverId: principal.id }] }
    const [transfers, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          sender: { select: { name: true, email: true } },
          receiver: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions: transfers.map(transfer => ({
        id: transfer.id,
        amount: transfer.amount.toString(),
        type: transfer.type,
        status: transfer.status,
        description: transfer.description,
        sender: transfer.sender,
        receiver: transfer.receiver,
        createdAt: transfer.createdAt,
        isIncoming: transfer.receiverId === principal.id,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Legacy transfer history error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

async function createTransfer(request, _context, principal) {
  if (await rateLimited(request)) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const rawBody = await request.clone().text()
    const { receiverEmail, amount, description, type } = transferSchema.parse(await request.json())
    const amountCents = BigInt(Math.round(amount * 100))
    const { response } = await executeIdempotentCommand({
      db: prisma,
      request,
      rawBody,
      principalId: principal.id,
      run: async tx => {
      const receiver = await tx.user.findFirst({
        where: { email: { equals: receiverEmail, mode: 'insensitive' }, platformRole: 'USER' },
      })
      if (!receiver) throw new Error('Receiver not found')
      if (receiver.id === principal.id) throw new Error('Cannot transfer to yourself')
      if (type === 'MERCHANT_PAYMENT' && receiver.role !== 'MERCHANT') {
        throw new Error('Receiver must be a merchant for merchant payments')
      }
      const debit = await tx.legacyWallet.updateMany({
        where: { userId: principal.id, balanceCents: { gte: amountCents } },
        data: { balanceCents: { decrement: amountCents } },
      })
      if (debit.count !== 1) throw new Error('Insufficient legacy demo balance')

      await tx.legacyWallet.upsert({
        where: { userId: receiver.id },
        create: { userId: receiver.id, balanceCents: amountCents },
        update: { balanceCents: { increment: amountCents } },
      })

      const transfer = await tx.transaction.create({
        data: { senderId: principal.id, receiverId: receiver.id, amount, type, status: 'COMPLETED', description },
        include: {
          sender: { select: { name: true, email: true } },
          receiver: { select: { name: true, email: true } },
        },
      })
      return {
        status: 200,
        body: {
          message: 'Legacy demo transfer completed',
          transaction: { ...transfer, amount: transfer.amount.toString() },
        },
      }
      },
    })

    return response
  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error)
    if (idempotencyError) return idempotencyError
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 })
    }
    if (error instanceof Error) {
      if (error.message === 'Receiver not found') return NextResponse.json({ message: error.message }, { status: 404 })
      if (['Insufficient legacy demo balance', 'Cannot transfer to yourself', 'Receiver must be a merchant for merchant payments'].includes(error.message)) {
        return NextResponse.json({ message: error.message }, { status: 400 })
      }
    }
    console.error('Legacy transfer error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withAuthorization(listTransfers, { platformRoles: ['USER'] })
export const POST = withAuthorization(
  createTransfer,
  { platformRoles: ['USER'], legacyRoles: ['CLIENT'] },
)

