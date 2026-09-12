'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CreditCard, Shield, Users, TrendingUp, ArrowRight, Wallet, Zap, DollarSign, Send, X } from 'lucide-react'

export default function HomePage() {
  const [selectedCard, setSelectedCard] = useState(null)

  const creditCards = [
    {
      id: 1,
      title: 'Sign Up Free',
      gradient: 'from-blue-600 via-purple-600 to-blue-500',
      number: '0871 1157 0587 6187',
      action: 'signup',
      icon: <Users className="w-6 h-6" />,
      description: 'Create your account and start managing money instantly'
    },
    {
      id: 2,
      title: 'Instant Transfers',
      gradient: 'from-purple-600 via-pink-600 to-purple-500',
      number: '0087 1157 0587 6187',
      action: 'feature',
      icon: <Zap className="w-6 h-6" />,
      description: 'Send money to anyone, anywhere in seconds'
    },
    {
      id: 3,
      title: 'Secure Payments',
      gradient: 'from-slate-800 via-purple-900 to-slate-900',
      number: '0871 1157 0587 6187',
      action: 'feature',
      icon: <Shield className="w-6 h-6" />,
      description: 'Bank-level security for all your transactions'
    },
    {
      id: 4,
      title: 'Track Spending',
      gradient: 'from-blue-500 via-cyan-500 to-blue-400',
      number: '0871 1157 0587 6187',
      action: 'feature',
      icon: <TrendingUp className="w-6 h-6" />,
      description: 'Monitor your finances with real-time insights'
    },
    {
      id: 5,
      title: 'Easy Payments',
      gradient: 'from-slate-200 via-slate-100 to-white',
      number: '0871 1157 0587 6187',
      action: 'feature',
      icon: <DollarSign className="w-6 h-6" />,
      description: 'Pay bills and merchants with one click',
      textDark: true
    }
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Logo Header */}
      <div className="absolute top-8 left-8 z-20">
        <div className="flex items-center space-x-2">
          <Wallet className="w-8 h-8 text-slate-700" />
          <span className="text-2xl font-bold text-slate-800">PAYSTREAM</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-24 mt-16">
          <div className="space-y-8">
            <h1 className="text-6xl font-bold text-slate-800 leading-tight">
              Your Money,<br />
              Simplified.<br />
              Instantly.
            </h1>
            <p className="text-lg text-slate-600 max-w-md">
              Experience seamless digital payments with bank-level security and instant transfers.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedCard(creditCards[0])}
                className="glass-button px-8 py-3 rounded-full text-slate-700 font-medium hover:scale-105 transition-transform"
              >
                Sign Up Free
              </button>
              <Link href="/auth/signin">
                <button className="glass-input px-8 py-3 rounded-full text-slate-700 font-medium hover:scale-105 transition-transform">
                  Sign In
                </button>
              </Link>
            </div>
          </div>

          {/* Credit Cards Stack */}
          <div className="relative h-[500px] flex items-center justify-center perspective-1000">
            {creditCards.map((card, index) => {
              const isSelected = selectedCard?.id === card.id
              const baseTransform = isSelected 
                ? 'translateX(0px) translateY(-50px) translateZ(100px) rotate(0deg)'
                : `translateX(${index * 30 - 60}px) translateY(${index * 20 - 40}px) translateZ(0px) rotate(${index * 5 - 10}deg)`
              
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`absolute cursor-pointer transition-all duration-700 ease-out ${
                    isSelected ? 'z-50' : ''
                  }`}
                  style={{
                    transform: baseTransform,
                    zIndex: isSelected ? 50 : 10 - index,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className={`credit-card w-80 h-48 rounded-2xl bg-gradient-to-br ${card.gradient} p-6 relative overflow-hidden`}>
                    {/* Realistic Card Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60"></div>
                    <div className="absolute inset-0 bg-gradient-to-tl from-black/10 via-transparent to-transparent"></div>
                    
                    {/* Card Pattern with depth */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl -translate-y-20 translate-x-20"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-2xl translate-y-16 -translate-x-16"></div>
                      <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white rounded-full blur-xl"></div>
                    </div>

                    {/* Holographic effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>

                    {/* Card Content */}
                    <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div className={`${card.textDark ? 'text-slate-800' : 'text-white'} drop-shadow-lg`}>
                          {card.icon}
                        </div>
                        {/* Enhanced Chip */}
                        <div className={`${card.textDark ? 'text-slate-800' : 'text-white'} text-2xl font-bold`}>
                          <div className="relative">
                            <svg className="w-12 h-10 drop-shadow-md" viewBox="0 0 48 40" fill="none">
                              <rect x="6" y="10" width="16" height="20" rx="2" fill="currentColor" opacity="0.9" className="drop-shadow"/>
                              <rect x="18" y="10" width="16" height="20" rx="2" fill="currentColor" opacity="0.7"/>
                              <line x1="10" y1="15" x2="10" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
                              <line x1="14" y1="15" x2="14" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
                              <line x1="22" y1="15" x2="22" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
                              <line x1="26" y1="15" x2="26" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className={`${card.textDark ? 'text-slate-700' : 'text-white/90'} text-sm mb-2 tracking-[0.3em] font-mono drop-shadow`}>
                          {card.number}
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <div className={`${card.textDark ? 'text-slate-600' : 'text-white/60'} text-[10px] uppercase tracking-wider mb-1`}>
                              Card Holder
                            </div>
                            <div className={`${card.textDark ? 'text-slate-800' : 'text-white'} font-bold text-lg drop-shadow`}>
                              {card.title}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`${card.textDark ? 'text-slate-600' : 'text-white/60'} text-[10px] uppercase tracking-wider mb-1`}>
                              Valid Thru
                            </div>
                            <div className={`${card.textDark ? 'text-slate-700' : 'text-white'} text-xs font-bold font-mono`}>
                              12/28
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* VISA Logo with realistic styling */}
                    <div className={`absolute bottom-6 right-6 ${card.textDark ? 'text-slate-700' : 'text-white'} font-bold text-2xl italic drop-shadow-lg`}>
                      VISA
                    </div>

                    {/* Contactless Icon with glow */}
                    <div className={`absolute top-6 right-6 ${card.textDark ? 'text-slate-700' : 'text-white'} opacity-40`}>
                      <svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 12c0-2.21 1.79-4 4-4" strokeLinecap="round"/>
                        <path d="M10 12c0-1.1.9-2 2-2" strokeLinecap="round"/>
                        <path d="M12 12h.01" strokeLinecap="round"/>
                        <path d="M14 12c0 1.1-.9 2-2 2" strokeLinecap="round"/>
                      </svg>
                    </div>

                    {/* Card edge highlight */}
                    <div className="absolute inset-0 rounded-2xl border border-white/20"></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Card Popup Modal */}
        {selectedCard && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
            onClick={() => setSelectedCard(null)}
          >
            <div 
              className="relative animate-cardPopup"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Enlarged Credit Card */}
              <div className={`w-[600px] h-[360px] rounded-3xl bg-gradient-to-br ${selectedCard.gradient} p-8 shadow-2xl relative overflow-hidden`}>
                {/* Close Button */}
                <button
                  onClick={() => setSelectedCard(null)}
                  className="absolute top-6 right-6 z-20 glass-button p-2 rounded-full hover:scale-110 transition-transform"
                >
                  <X className={`w-6 h-6 ${selectedCard.textDark ? 'text-slate-800' : 'text-white'}`} />
                </button>

                {/* Card Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-60 h-60 bg-white rounded-full -translate-y-32 translate-x-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24"></div>
                  <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                </div>

                {/* Card Content */}
                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-8">
                    <div className={`${selectedCard.textDark ? 'text-slate-800' : 'text-white'}`}>
                      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                        {selectedCard.icon}
                      </div>
                      <h2 className="text-3xl font-bold mb-2">{selectedCard.title}</h2>
                      <p className={`${selectedCard.textDark ? 'text-slate-700' : 'text-white/80'} text-sm max-w-md`}>
                        {selectedCard.description}
                      </p>
                    </div>
                    <div className={`${selectedCard.textDark ? 'text-slate-800' : 'text-white'} text-2xl font-bold`}>
                      <svg className="w-16 h-12" viewBox="0 0 48 32" fill="none">
                        <rect x="4" y="8" width="16" height="16" rx="2" fill="currentColor" opacity="0.8"/>
                        <rect x="16" y="8" width="16" height="16" rx="2" fill="currentColor" opacity="0.6"/>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className={`${selectedCard.textDark ? 'text-slate-700' : 'text-white/80'} text-lg mb-4 tracking-widest font-mono`}>
                      {selectedCard.number}
                    </div>
                    <div className="flex gap-4">
                      {selectedCard.action === 'signup' ? (
                        <>
                          <Link href="/auth/signup" className="flex-1">
                            <button className={`w-full ${selectedCard.textDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'} px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform`}>
                              Sign Up Now
                            </button>
                          </Link>
                          <Link href="/auth/signin" className="flex-1">
                            <button className={`w-full ${selectedCard.textDark ? 'bg-slate-700 text-white' : 'bg-white/20 text-white backdrop-blur-sm'} px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform`}>
                              Sign In
                            </button>
                          </Link>
                        </>
                      ) : (
                        <Link href="/auth/signup" className="flex-1">
                          <button className={`w-full ${selectedCard.textDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'} px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform`}>
                            Get Started
                          </button>
                        </Link>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <div className={`${selectedCard.textDark ? 'text-slate-700' : 'text-white/60'} text-xs`}>
                        PAYSTREAM
                      </div>
                      <div className={`${selectedCard.textDark ? 'text-slate-700' : 'text-white'} text-sm font-bold`}>
                        VISA
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contactless Icon */}
                <div className={`absolute top-8 right-20 ${selectedCard.textDark ? 'text-slate-700' : 'text-white'} opacity-30`}>
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M8 12c0-2.21 1.79-4 4-4M10 12c0-1.1.9-2 2-2M14 12c0 1.1-.9 2-2 2"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          <Card variant="glass" className="p-8 text-center hover:scale-105 transition-transform">
            <div className="w-16 h-16 glass-button rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-slate-700" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-slate-800">Send & Receive</h3>
            <p className="text-slate-600">Transfer money instantly to friends and family</p>
          </Card>

          <Card variant="glass" className="p-8 text-center hover:scale-105 transition-transform">
            <div className="w-16 h-16 glass-button rounded-2xl flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-8 h-8 text-slate-700" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-slate-800">Track Spending</h3>
            <p className="text-slate-600">Monitor all your transactions in real-time</p>
          </Card>

          <Card variant="glass" className="p-8 text-center hover:scale-105 transition-transform">
            <div className="w-16 h-16 glass-button rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-slate-700" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-slate-800">Secure Payments</h3>
            <p className="text-slate-600">Bank-level security for all transactions</p>
          </Card>
        </div>

        {/* Testimonials Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-slate-800 mb-8">Testimonials</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card variant="glass" className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <p className="text-slate-700 mb-2">PAYSTREAM changed how I manage money</p>
                  <p className="text-sm text-slate-500">- Happy Customer</p>
                </div>
              </div>
            </Card>

            <Card variant="glass" className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <p className="text-slate-700 mb-2">PAYSTREAM changed how I manage money</p>
                  <p className="text-sm text-slate-500">- Satisfied User</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer Links */}
        <div className="flex justify-center space-x-12 text-slate-600">
          <Link href="/about" className="hover:text-slate-800 transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-slate-800 transition-colors">Privacy</Link>
        </div>
      </div>
    </div>
  )
}

function User(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
