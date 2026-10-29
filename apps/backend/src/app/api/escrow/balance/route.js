import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAuthorization } from '@/lib/authorization'

function decimalFromCents(cents) {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  return `${negative ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

async function handler(_request, _context, principal) {
  try {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { ownerId: principal.id, currency: 'USD' },
      select: { kind: true, balanceCents: true },
    })
    const available = accounts.find(account => account.kind === 'USER_AVAILABLE')
    const held = accounts.find(account => account.kind === 'USER_HELD')
    if (!available || !held) return NextResponse.json({ message: 'Escrow accounts not found' }, { status: 404 })
    const availableCents = available.balanceCents
    const heldCents = held.balanceCents

    return NextResponse.json({
      available: decimalFromCents(availableCents),
      held: decimalFromCents(heldCents),
      availableCents: availableCents.toString(),
      heldCents: heldCents.toString(),
    })
  } catch (error) {
    console.error('Escrow balance fetch error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withAuthorization(handler, { platformRoles: ['USER'] })

