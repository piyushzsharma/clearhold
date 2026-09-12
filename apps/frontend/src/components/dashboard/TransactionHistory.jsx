'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { History, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export function TransactionHistory({ limit = 5, showHeader = true, onRefresh }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions?limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions)
      } else {
        toast.error('Failed to fetch transactions')
      }
    } catch (error) {
      toast.error('Error fetching transactions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTransactions()
    onRefresh?.()
  }

  useEffect(() => {
    fetchTransactions()
  }, [limit])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTransactionIcon = (transaction) => {
    return transaction.isIncoming ? (
      <ArrowDownLeft className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-red-600" />
    )
  }

  const getTransactionAmount = (transaction) => {
    const prefix = transaction.isIncoming ? '+' : '-'
    const color = transaction.isIncoming ? 'text-green-600' : 'text-red-600'
    return (
      <span className={`font-medium ${color}`}>
        {prefix}${parseFloat(transaction.amount).toFixed(2)}
      </span>
    )
  }

  if (loading) {
    return (
      <Card variant="glass">
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center text-slate-800">
              <History className="h-5 w-5 mr-2" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-8 h-8 glass-input rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 glass-input rounded w-3/4 mb-1"></div>
                  <div className="h-3 glass-input rounded w-1/2"></div>
                </div>
                <div className="h-4 glass-input rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="glass">
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center text-slate-800">
            <History className="h-5 w-5 mr-2" />
            Recent Transactions
          </CardTitle>
          <button
            className="glass-button p-2 rounded-lg"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 text-slate-700 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </CardHeader>
      )}
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <History className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p>No transactions yet</p>
            <p className="text-sm">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center space-x-3 p-3 glass-button rounded-xl hover:scale-[1.02] transition-transform">
                <div className="flex-shrink-0">
                  {getTransactionIcon(transaction)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {transaction.isIncoming 
                        ? `From ${transaction.sender.name}` 
                        : `To ${transaction.receiver.name}`
                      }
                    </p>
                    {getTransactionAmount(transaction)}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-600 truncate">
                      {transaction.description || 'No description'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">
                      {transaction.type.replace('_', ' ').toLowerCase()}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      transaction.status === 'COMPLETED' 
                        ? 'bg-emerald-100/50 text-emerald-700' 
                        : transaction.status === 'PENDING'
                        ? 'bg-amber-100/50 text-amber-700'
                        : 'bg-rose-100/50 text-rose-700'
                    }`}>
                      {transaction.status.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
