import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { authRateLimit } from '@/lib/rate-limit'
import { publicRegistrationSchema } from '@/lib/registration'
import { ensureUserLedgerAccounts, issueDemoFunds } from '@/lib/ledger'

export async function POST(request) {
  try {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    
    // Rate limiting
    const isAllowed = await authRateLimit(`register:ip:${clientIP}`)
    if (!isAllowed) {
      return NextResponse.json(
        { message: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, password, role } = publicRegistrationSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user and wallet in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          platformRole: 'USER',
        },
      })

      await ensureUserLedgerAccounts(tx, newUser.id)

      await tx.legacyWallet.create({
        data: {
          userId: newUser.id,
          balanceCents: role === 'CLIENT' ? 100000 : 0,
        },
      })

      if (role === 'CLIENT') {
        await issueDemoFunds(tx, {
          userId: newUser.id,
          amountCents: 100_000n,
          idempotencyKey: `initial-funding:${newUser.id}`,
        })
      }

      return newUser
    })

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid input', errors: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 },
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
