import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'production') {
      const master = process.env.MASTER_KEY || ''
      const hash = process.env.IDEMPOTENCY_HASH_KEY || ''
      if (!/^[a-fA-F0-9]{64}$/.test(master) || !/^[a-fA-F0-9]{64}$/.test(hash) ||
          master === hash || (process.env.NEXTAUTH_SECRET || '').length < 32 ||
          (process.env.SCHEDULER_SECRET || '').length < 32 || !process.env.NEXTAUTH_URL) {
        return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
    }
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
