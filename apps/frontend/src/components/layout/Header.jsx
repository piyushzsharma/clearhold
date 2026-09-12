'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { LogOut, User, Wallet } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <header className="glass-card border-0 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href={session?.user?.role === 'MERCHANT' ? '/merchant' : '/dashboard'} className="flex items-center space-x-2">
              <Wallet className="h-8 w-8 text-slate-700" />
              <span className="text-xl font-bold text-slate-800">PAYSTREAM</span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-2">
            {session?.user?.role === 'MERCHANT' ? (
              <Link href="/merchant" className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium">
                Merchant Dashboard
              </Link>
            ) : (
              <>
                <Link href="/dashboard" className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/dashboard/transfer" className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium">
                  Transfer
                </Link>
                <Link href="/dashboard/history" className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium">
                  History
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {session?.user ? (
              <>
                <div className="flex items-center space-x-2 glass-button px-4 py-2 rounded-xl">
                  <User className="h-5 w-5 text-slate-600" />
                  <span className="text-sm text-slate-700 font-medium">{session.user.name}</span>
                  <span className="text-xs glass-input px-2 py-1 rounded-full text-slate-700">
                    {session.user.role}
                  </span>
                </div>
                <button className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium flex items-center" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Link href="/auth/signin">
                  <button className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium">Sign In</button>
                </Link>
                <Link href="/auth/signup">
                  <button className="glass-button px-4 py-2 rounded-xl text-slate-700 text-sm font-medium">Sign Up</button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
