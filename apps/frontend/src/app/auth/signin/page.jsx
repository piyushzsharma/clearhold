'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Invalid credentials')
      } else {
        const session = await getSession()
        toast.success('Signed in successfully!')
        
        if (session?.user?.role === 'MERCHANT') {
          router.push('/merchant')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch (error) {
      toast.error('Google sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Credit Cards in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="credit-card w-64 h-40 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 absolute top-10 -left-20 rotate-12 opacity-20 blur-sm"></div>
        <div className="credit-card w-72 h-44 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 absolute bottom-20 -right-24 -rotate-12 opacity-15 blur-sm"></div>
        <div className="credit-card w-56 h-36 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 absolute top-1/3 -right-16 rotate-6 opacity-10 blur-md"></div>
        <div className="credit-card w-60 h-38 rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 absolute bottom-1/4 -left-16 -rotate-6 opacity-15 blur-sm"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div>
          <h2 className="mt-6 text-center text-4xl font-bold text-slate-800 drop-shadow-sm">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Or{' '}
            <Link href="/auth/signup" className="font-medium text-slate-800 hover:text-slate-900 underline">
              create a new account
            </Link>
          </p>
        </div>

        {/* Main Sign In Card styled as Credit Card */}
        <div className="credit-card rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-blue-500 p-8 relative overflow-hidden">
          {/* Card shine effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60"></div>
          <div className="absolute inset-0 bg-gradient-to-tl from-black/10 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
          
          {/* Decorative patterns */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl -translate-y-20 translate-x-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-2xl translate-y-16 -translate-x-16"></div>
          </div>

          {/* Card border */}
          <div className="absolute inset-0 rounded-2xl border border-white/20"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="text-white text-xl font-bold drop-shadow-lg">Welcome Back</div>
              <div className="text-white font-bold text-2xl italic drop-shadow-lg">VISA</div>
            </div>

            <Card variant="glass-strong" className="border-0">
          <CardHeader>
            <CardTitle className="text-slate-800">Welcome back</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                error={errors.password?.message}
              />

              <button
                type="submit"
                className="w-full glass-button px-6 py-3 rounded-xl text-slate-700 font-medium disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300/50" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 glass-input text-slate-600">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                className="w-full glass-button px-6 py-3 rounded-xl text-slate-700 font-medium flex items-center justify-center disabled:opacity-50"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </form>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
