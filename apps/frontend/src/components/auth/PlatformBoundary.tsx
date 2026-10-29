'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export function PlatformBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const requiresAdmin = pathname.startsWith('/admin')
  const hasAccess = requiresAdmin
    ? session?.user?.platformRole === 'ADMIN'
    : session?.user?.platformRole === 'USER'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin')
      return
    }

    if (status === 'authenticated' && !hasAccess) {
      router.replace(
        session.user.platformRole === 'ADMIN' ? '/admin/disputes' : '/escrow',
      )
    }
  }, [hasAccess, router, session, status])

  if (status === 'loading' || !session || !hasAccess) {
    return (
      <main className="auth-loading" aria-live="polite">
        Checking access…
      </main>
    )
  }

  return <>{children}</>
}
