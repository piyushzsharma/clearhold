import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { reconcileExpiredEscrows } from '@/lib/reconcile-escrows'

export async function POST(request: Request) {
  const configured = process.env.SCHEDULER_SECRET
  if (!configured || configured.length < 32) return NextResponse.json({ message: 'Scheduler unavailable' }, { status: 503 })
  const supplied = request.headers.get('x-scheduler-secret') || ''
  const expected = Buffer.from(configured)
  const actual = Buffer.from(supplied)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await reconcileExpiredEscrows(prisma)
    return NextResponse.json(result, { status: result.failed ? 503 : 200 })
  } catch (error) {
    console.error('Reconciliation sweep failed', error)
    return NextResponse.json({ message: 'Reconciliation failed' }, { status: 503 })
  }
}
