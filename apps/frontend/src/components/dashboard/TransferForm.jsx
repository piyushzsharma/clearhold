'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Send } from 'lucide-react'
import toast from 'react-hot-toast'

const transferSchema = z.object({
  receiverEmail: z.string().email('Invalid email address'),
  amount: z.number().positive('Amount must be positive').max(10000, 'Amount too large'),
  description: z.string().optional(),
  type: z.enum(['P2P_TRANSFER', 'MERCHANT_PAYMENT']).default('P2P_TRANSFER'),
})

export function TransferForm({ onTransferComplete }) {
  const [loading, setLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      type: 'P2P_TRANSFER'
    }
  })

  const transferType = watch('type')

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Transfer completed successfully!')
        reset()
        onTransferComplete?.()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Transfer failed')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center text-slate-800">
          <Send className="h-5 w-5 mr-2" />
          Send Money
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Transfer Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center glass-button px-4 py-3 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  value="P2P_TRANSFER"
                  {...register('type')}
                  className="mr-2"
                />
                <span className="text-sm text-slate-700">Person to Person</span>
              </label>
              <label className="flex items-center glass-button px-4 py-3 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  value="MERCHANT_PAYMENT"
                  {...register('type')}
                  className="mr-2"
                />
                <span className="text-sm text-slate-700">Pay Merchant</span>
              </label>
            </div>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <Input
            label={transferType === 'MERCHANT_PAYMENT' ? 'Merchant Email' : 'Recipient Email'}
            type="email"
            placeholder="Enter email address"
            {...register('receiverEmail')}
            error={errors.receiverEmail?.message}
          />

          <Input
            label="Amount ($)"
            type="number"
            step="0.01"
            min="0.01"
            max="10000"
            placeholder="0.00"
            {...register('amount', { valueAsNumber: true })}
            error={errors.amount?.message}
          />

          <Input
            label="Description (Optional)"
            type="text"
            placeholder="What's this for?"
            {...register('description')}
            error={errors.description?.message}
          />

          <button
            type="submit"
            className="w-full glass-button px-6 py-3 rounded-xl text-slate-700 font-medium flex items-center justify-center disabled:opacity-50"
            disabled={loading}
          >
            <Send className="h-4 w-4 mr-2" />
            {loading ? 'Sending...' : 'Send Money'}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
