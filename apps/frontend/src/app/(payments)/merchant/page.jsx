'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Header } from '@/components/layout/Header'
import { WalletBalance } from '@/components/dashboard/WalletBalance'
import { TransactionHistory } from '@/components/dashboard/TransactionHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Store, TrendingUp, Users, DollarSign } from 'lucide-react'

export default function MerchantPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <ProtectedRoute requiredRole="MERCHANT">
      <div className="min-h-screen relative">
        <Header />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 relative z-10">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800">Merchant Dashboard</h1>
              <p className="text-slate-600">Manage your business payments and transactions</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <WalletBalance key={refreshKey} onRefresh={handleRefresh} />
              
              <Card variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-800">Today's Sales</CardTitle>
                  <DollarSign className="h-4 w-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">$0.00</div>
                  <p className="text-xs text-slate-600">
                    +0% from yesterday
                  </p>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-800">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-800">0</div>
                  <p className="text-xs text-slate-600">
                    Unique customers
                  </p>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-800">Business Status</CardTitle>
                  <Store className="h-4 w-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">Active</div>
                  <p className="text-xs text-slate-600">
                    Ready to accept payments
                  </p>
                  <div className="mt-2">
                    <span className="text-xs glass-button px-3 py-1 rounded-full text-emerald-700">
                      Verified Merchant
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Instructions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-800">
                    <Store className="h-5 w-5 mr-2" />
                    How to Receive Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 glass-button text-slate-700 rounded-full flex items-center justify-center text-sm font-medium">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800">Share Your Email</h4>
                        <p className="text-sm text-slate-600">Give customers your registered email address</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 glass-button text-slate-700 rounded-full flex items-center justify-center text-sm font-medium">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800">Customer Pays</h4>
                        <p className="text-sm text-slate-600">They select "Pay Merchant" and enter your email</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 glass-button text-slate-700 rounded-full flex items-center justify-center text-sm font-medium">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800">Instant Payment</h4>
                        <p className="text-sm text-slate-600">Money is transferred to your wallet immediately</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-800">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Business Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 glass-button rounded-xl">
                      <h4 className="font-medium text-slate-800">Display Your Email</h4>
                      <p className="text-sm text-slate-600">Make it easy for customers to find your payment email</p>
                    </div>
                    <div className="p-3 glass-button rounded-xl">
                      <h4 className="font-medium text-slate-800">Track Transactions</h4>
                      <p className="text-sm text-slate-600">Monitor all payments in your transaction history</p>
                    </div>
                    <div className="p-3 glass-button rounded-xl">
                      <h4 className="font-medium text-slate-800">Instant Settlements</h4>
                      <p className="text-sm text-slate-600">No waiting - funds are available immediately</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction History */}
            <TransactionHistory key={refreshKey} limit={10} onRefresh={handleRefresh} />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
