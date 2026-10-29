import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { withAuthorization } from '@/lib/authorization'

function decimalFromCents(cents) {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  return `${negative ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

async function handler(request, _context, principal) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (!(await rateLimit(clientIP))) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const wallet = await prisma.legacyWallet.findUnique({ where: { userId: principal.id } })
    if (!wallet) {
      return NextResponse.json({ message: 'Legacy wallet not found' }, { status: 404 })
    }

    return NextResponse.json({
      balance: decimalFromCents(wallet.balanceCents),
      balanceCents: wallet.balanceCents.toString(),
      updatedAt: wallet.updatedAt,
    })
  } catch (error) {
    console.error('Legacy balance fetch error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withAuthorization(handler, { platformRoles: ['USER'] })

