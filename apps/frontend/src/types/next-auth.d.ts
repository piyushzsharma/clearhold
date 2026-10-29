import type { DefaultSession } from 'next-auth'

type LegacyRole = 'CLIENT' | 'MERCHANT'
type PlatformRole = 'USER' | 'ADMIN'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: LegacyRole
      platformRole: PlatformRole
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: LegacyRole
    platformRole?: PlatformRole
  }
}
