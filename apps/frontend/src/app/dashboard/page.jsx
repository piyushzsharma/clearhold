'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Header } from '@/components/layout/Header'
import { WalletBalance } from '@/components/dashboard/WalletBalance'
import { TransferForm } from '@/components/dashboard/TransferForm'
import { TransactionHistory } from '@/components/dashboard/TransactionHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TrendingUp, Users, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="min-h-screen relative">
        <Header />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 relative z-10">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
              <p className="text-slate-600">Manage your wallet and transactions</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <WalletBalance key={refreshKey} onRefresh={handleRefresh} />
              
              <Card variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-800">Quick Actions</CardTitle>
                  <Users className="h-4 w-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Link href="/dashboard/transfer">
                      <button className="glass-button w-full justify-start px-4 py-2 rounded-xl text-slate-700 flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Send Money
                      </button>
                    </Link>
                    <Link href="/dashboard/history">
                      <button className="glass-button w-full justify-start px-4 py-2 rounded-xl text-slate-700 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        View History
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-800">Account Info</CardTitle>
                  <TrendingUp className="h-4 w-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">Active</div>
                  <p className="text-xs text-slate-600">
                    Personal Account
                  </p>
                  <div className="mt-2">
                    <span className="text-xs glass-button px-3 py-1 rounded-full text-emerald-700">
                      Verified
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <TransferForm onTransferComplete={handleRefresh} />
              </div>
              
              <div>
                <TransactionHistory key={refreshKey} limit={8} onRefresh={handleRefresh} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
