import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.js'
import { prisma } from '@/lib/db.js'
import { rateLimit } from '@/lib/rate-limit.js'
import { withIdempotency } from '@/lib/idempotency.js'
import { z } from 'zod'

const transferSchema = z.object({
  receiverEmail: z.string().email('Invalid receiver email'),
  amount: z.number().positive('Amount must be positive').max(10000, 'Amount too large'),
  description: z.string().optional(),
  type: z.enum(['P2P_TRANSFER', 'MERCHANT_PAYMENT']).default('P2P_TRANSFER'),
})

async function handler(request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const isAllowed = await rateLimit(clientIP)
    
    if (!isAllowed) {
      return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json()
    const { receiverEmail, amount, description, type } = transferSchema.parse(body)
    const idempotencyKey = request.headers.get('idempotency-key') || `transfer_${Date.now()}_${Math.random()}`;

    // Find receiver
    const receiver = await prisma.user.findUnique({
      where: { email: receiverEmail },
    })

    if (!receiver) {
      return NextResponse.json({ message: 'Receiver not found' }, { status: 404 })
    }

    if (receiver.id === session.user.id) {
      return NextResponse.json({ message: 'Cannot transfer to yourself' }, { status: 400 })
    }

    // Validate merchant payment
    if (type === 'MERCHANT_PAYMENT' && receiver.role !== 'MERCHANT') {
      return NextResponse.json({ message: 'Receiver must be a merchant for merchant payments' }, { status: 400 })
    }

    // Amount in cents for ledger math
    const amountCents = BigInt(amount * 100);

    // Process transfer in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock both wallets
      await tx.$queryRaw`
        SELECT * FROM wallets WHERE "userId" IN (${session.user.id}, ${receiver.id}) FOR UPDATE
      `;

      // 2. Dynamically calculate sender's AVAILABLE balance
      const balanceResult = await tx.$queryRaw`
        SELECT COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amountCents" ELSE -"amountCents" END), 0)::numeric AS balance
        FROM ledger_entries
        WHERE "accountId" = ${session.user.id} AND "balanceBucket" = 'AVAILABLE'
      `;
      const availableBalance = BigInt(balanceResult[0].balance);

      if (availableBalance < amountCents) {
        throw new Error('Insufficient balance');
      }

      // 3. Create the legacy Transaction receipt
      const transaction = await tx.transaction.create({
        data: {
          senderId: session.user.id,
          receiverId: receiver.id,
          amount: amount, // Keeping Decimal support for legacy compatibility
          type,
          status: 'COMPLETED',
          description,
        },
        include: {
          sender: { select: { name: true, email: true } },
          receiver: { select: { name: true, email: true } },
        },
      });

      // 4. Create the DEBIT (AVAILABLE) entry for sender
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: session.user.id,
          entryType: 'DEBIT',
          amountCents,
          balanceBucket: 'AVAILABLE',
          reason: 'P2P_TRANSFER_DEBIT',
          idempotencyKey: `${idempotencyKey}:debit`,
        },
      });

      // 5. Create the CREDIT (AVAILABLE) entry for receiver
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: receiver.id,
          entryType: 'CREDIT',
          amountCents,
          balanceBucket: 'AVAILABLE',
          reason: 'P2P_TRANSFER_CREDIT',
          idempotencyKey: `${idempotencyKey}:credit`,
        },
      });

      return transaction;
    });

    return NextResponse.json({
      message: 'Transfer completed successfully',
      transaction: {
        id: result.id,
        amount: result.amount.toString(),
        type: result.type,
        status: result.status,
        description: result.description,
        sender: result.sender,
        receiver: result.receiver,
        createdAt: result.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 })
    }

    if (error instanceof Error) {
      if (error.message === 'Insufficient balance') {
        return NextResponse.json({ message: 'Insufficient balance' }, { status: 400 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ message: error.message }, { status: 404 })
      }
    }

    console.error('Transfer error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export const POST = withIdempotency(handler);
