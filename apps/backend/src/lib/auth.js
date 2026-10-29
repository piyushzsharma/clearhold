import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './db.js'
import bcrypt from 'bcryptjs'
import { loginFailureLimiter } from './login-rate-limit'
import { ensureUserLedgerAccounts } from './ledger'

const DUMMY_PASSWORD_HASH = '$2a$12$7QMqDP8b0yVx3PSPEKRSL..wr0ST.hdkMKGIxMshwnSkfWjx.EjTm'

function requestIp(request) {
  const forwarded = typeof request?.headers?.get === 'function'
    ? request.headers.get('x-forwarded-for')
    : request?.headers?.['x-forwarded-for']

  return String(forwarded || 'unknown').split(',')[0].trim()
}

const providers = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials, request) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const email = credentials.email.trim().toLowerCase()
      const ip = requestIp(request)
      if (!loginFailureLimiter.allowed(ip, email)) {
        return null
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      })
      const passwordHash = user?.password || DUMMY_PASSWORD_HASH
      const isPasswordValid = await bcrypt.compare(credentials.password, passwordHash)

      if (!user?.password || !isPasswordValid) {
        loginFailureLimiter.recordFailure(ip, email)
        return null
      }

      loginFailureLimiter.clearAccountFailures(email)

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        platformRole: user.platformRole,
      }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }))
}

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.platformRole = user.platformRole
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        if (token.role && typeof token.role === 'string') {
          session.user.role = token.role;
        }
        if (token.platformRole && typeof token.platformRole === 'string') {
          session.user.platformRole = token.platformRole;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    newUser: '/auth/signup',
  },
  events: {
    async createUser({ user }) {
      await prisma.$transaction(async tx => {
        await ensureUserLedgerAccounts(tx, user.id)
        await tx.legacyWallet.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        })
      })
    },
  },
}
