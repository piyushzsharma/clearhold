'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Header } from '@/components/layout/Header'
import { WalletBalance } from '@/components/dashboard/WalletBalance'
import { TransferForm } from '@/components/dashboard/TransferForm'
import { TransactionHistory } from '@/components/dashboard/TransactionHistory'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function TransferPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="min-h-screen relative">
        <Header />
        
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 relative z-10">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <Link href="/dashboard">
                <button className="glass-button px-4 py-2 rounded-xl text-slate-700 flex items-center mb-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </button>
              </Link>
              <h1 className="text-3xl font-bold text-slate-800">Send Money</h1>
              <p className="text-slate-600">Transfer money to friends or pay merchants</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <TransferForm onTransferComplete={handleRefresh} />
              </div>
              
              <div className="space-y-6">
                <WalletBalance key={refreshKey} onRefresh={handleRefresh} />
                <TransactionHistory key={refreshKey} limit={5} onRefresh={handleRefresh} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
