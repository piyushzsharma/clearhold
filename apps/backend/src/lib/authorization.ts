import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  authorizeIdentity,
  isAccessControlError,
  type AuthorizationPolicy,
  type Principal,
} from '@/lib/authorization-policy'

export async function requirePrincipal(
  policy: AuthorizationPolicy = {},
): Promise<Principal> {
  const session = await getServerSession(authOptions)

  return authorizeIdentity(
    session,
    (userId) => prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        platformRole: true,
      },
    }),
    policy,
  )
}

export function withAuthorization(
  handler: (request: Request, ...args: any[]) => Promise<Response>,
  policy: AuthorizationPolicy = {},
) {
  return async (request: Request, ...args: any[]) => {
    try {
      const principal = await requirePrincipal(policy)
      return await handler(request, ...args, principal)
    } catch (error) {
      if (isAccessControlError(error)) {
        return NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.status },
        )
      }

      throw error
    }
  }
}
