import type { DefaultSession } from 'next-auth'
import type { PlatformRole, Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      platformRole: PlatformRole
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    platformRole: PlatformRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role
    platformRole?: PlatformRole
  }
}
