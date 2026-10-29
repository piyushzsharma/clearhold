import type { PlatformRole, Role } from '@prisma/client'

export interface Principal {
  id: string
  email: string
  name: string | null
  role: Role
  platformRole: PlatformRole
}

export interface AuthorizationPolicy {
  platformRoles?: readonly PlatformRole[]
  legacyRoles?: readonly Role[]
}

interface SessionIdentity {
  user?: {
    id?: string | null
  } | null
}

export class AuthenticationError extends Error {
  readonly status = 401
  readonly code = 'AUTHENTICATION_REQUIRED'

  constructor() {
    super('Authentication required')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  readonly status = 403
  readonly code = 'FORBIDDEN'

  constructor() {
    super('You do not have permission to perform this action')
    this.name = 'AuthorizationError'
  }
}

export type PrincipalLoader = (userId: string) => Promise<Principal | null>

export async function authorizeIdentity(
  session: SessionIdentity | null,
  loadPrincipal: PrincipalLoader,
  policy: AuthorizationPolicy = {},
): Promise<Principal> {
  const userId = session?.user?.id

  if (!userId) {
    throw new AuthenticationError()
  }

  const principal = await loadPrincipal(userId)

  if (!principal) {
    throw new AuthenticationError()
  }

  if (
    policy.platformRoles &&
    !policy.platformRoles.includes(principal.platformRole)
  ) {
    throw new AuthorizationError()
  }

  if (policy.legacyRoles && !policy.legacyRoles.includes(principal.role)) {
    throw new AuthorizationError()
  }

  return principal
}

export function isAccessControlError(
  error: unknown,
): error is AuthenticationError | AuthorizationError {
  return error instanceof AuthenticationError || error instanceof AuthorizationError
}
