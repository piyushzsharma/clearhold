import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request) {
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

    const userId = session.user.id;

    // We must ensure the user has a wallet record. If not, they have 0 balance.
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    })

    if (!wallet) {
      return NextResponse.json({ message: 'Wallet not found' }, { status: 404 })
    }

    // Sum AVAILABLE balance
    const availableResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amountCents" ELSE -"amountCents" END), 0)::numeric AS balance
      FROM ledger_entries
      WHERE "accountId" = ${userId} AND "balanceBucket" = 'AVAILABLE'
    `;
    const availableBalance = availableResult[0].balance.toString();

    // Sum HELD balance
    const heldResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amountCents" ELSE -"amountCents" END), 0)::numeric AS balance
      FROM ledger_entries
      WHERE "accountId" = ${userId} AND "balanceBucket" = 'HELD'
    `;
    const heldBalance = heldResult[0].balance.toString();
    
    const totalBalance = (BigInt(availableBalance) + BigInt(heldBalance)).toString();

    return NextResponse.json({
      availableBalance,
      heldBalance,
      totalBalance,
      updatedAt: wallet.updatedAt,
    })
  } catch (error) {
    console.error('Balance fetch error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
