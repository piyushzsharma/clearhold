'use client'

import { FormEvent, useMemo, useState, useEffect } from 'react'

export interface CreateEscrowFormProps {
  availableBalanceCents: number
  onSubmit: (data: { title: string; priceCents: number; sellerIdentifier: string }) => Promise<void>
}

const formatMoney = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

function parseCents(value: string) {
  const normalized = value.replace(/[^\d.]/g, '')
  const [dollars = '', cents = ''] = normalized.split('.')
  return Math.round(Number(`${dollars || '0'}.${cents.slice(0, 2).padEnd(2, '0')}`) * 100) || 0
}

export function CreateEscrowForm({ availableBalanceCents, onSubmit }: CreateEscrowFormProps) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [sellerIdentifier, setSellerIdentifier] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSeller, setIsCheckingSeller] = useState(false)
  const priceCents = useMemo(() => parseCents(price), [price])
  const remainingCents = availableBalanceCents - priceCents
  const isOverBalance = priceCents > availableBalanceCents
  const canSubmit = Boolean(title.trim() && sellerIdentifier.trim() && priceCents > 0 && !isOverBalance && !isSubmitting)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    try { await onSubmit({ title: title.trim(), priceCents, sellerIdentifier: sellerIdentifier.trim() }) } finally { setIsSubmitting(false) }
  }

  function handleSellerChange(value: string) {
    setSellerIdentifier(value)
    setIsCheckingSeller(Boolean(value.trim()))
    if (value.trim()) window.setTimeout(() => setIsCheckingSeller(false), 650)
  }

  return <main className="form-page"><header className="form-topbar"><a className="brand" href="/"><span className="brand-mark">C</span><span>clearhold</span></a><span className="form-account"><span className="avatar">AR</span> Alex Rivera</span></header><div className="form-container"><nav className="form-breadcrumb" aria-label="Breadcrumb"><a href="/">Workspace</a><span>/</span><span>Initiate escrow</span></nav><div className="form-heading"><div><p className="eyebrow">New transaction</p><h1>Initiate escrow</h1><p className="form-intro">Lock funds securely while your counterparty completes the work.</p></div><span className="secure-label"><span className="lock-icon">⌑</span> Funds protected</span></div><form className="escrow-form" onSubmit={handleSubmit}><section className="form-card"><div className="card-heading"><div><h2>Transaction details</h2><p>Tell us what you are securing funds for.</p></div><span className="step-label">1 of 1</span></div><div className="field-group"><label htmlFor="transaction-title">Transaction title</label><input id="transaction-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Brand identity package" /></div><div className="field-group"><label htmlFor="price">Price in USD</label><div className={`currency-input ${isOverBalance ? 'has-error' : ''}`}><span>$</span><input id="price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" aria-describedby={isOverBalance ? 'price-error' : undefined} /></div>{isOverBalance && <span id="price-error" className="field-error">This amount exceeds your available balance.</span>}</div><div className="field-group"><label htmlFor="seller">Seller&apos;s email or username</label><input id="seller" value={sellerIdentifier} onChange={(event) => handleSellerChange(event.target.value)} placeholder="e.g. seller@example.com" aria-describedby="seller-status" />{isCheckingSeller ? <span id="seller-status" className="field-hint checking"><span className="spinner small" /> Checking seller...</span> : sellerIdentifier ? <span id="seller-status" className="field-success">Seller identifier ready to verify.</span> : <span id="seller-status" className="field-hint">We&apos;ll notify the seller when funds are locked.</span>}</div></section><section className="summary-card" aria-live="polite"><div className="summary-heading"><div><h2>Balance summary</h2><p>Funds are reserved immediately when you start.</p></div><span className="balance-pill">Available now</span></div><div className="balance-equation"><div><span>Available balance</span><strong>{formatMoney(availableBalanceCents)}</strong></div><span className="minus" aria-hidden="true">−</span><div><span>Amount to lock</span><strong>{formatMoney(priceCents)}</strong></div><span className="equals" aria-hidden="true">=</span><div className={isOverBalance ? 'remaining-error' : ''}><span>Remaining after lock</span><strong>{formatMoney(remainingCents)}</strong></div></div>{isOverBalance && <div className="summary-error"><span className="error-icon">!</span><span>Enter an amount of {formatMoney(availableBalanceCents)} or less to continue.</span></div>}</section><details className="next-card" open><summary><span><strong>What happens next?</strong><small>A clear, protected process from lock to release.</small></span><span className="details-chevron" aria-hidden="true">⌄</span></summary><ol><li><span>1</span><div><strong>Funds are held</strong><p>Your balance is securely locked in escrow.</p></div></li><li><span>2</span><div><strong>Seller submits credentials</strong><p>The seller completes the agreed delivery.</p></div></li><li><span>3</span><div><strong>You have 24 hours to verify</strong><p>Funds auto-release if no action is taken.</p></div></li></ol></details><div className="form-actions"><span className="secure-note">Your funds remain protected until verification.</span><button className="submit-button" type="submit" disabled={!canSubmit}>{isSubmitting && <span className="spinner" />} {isSubmitting ? 'Starting escrow...' : 'Lock Funds & Start Escrow'}</button></div></form></div></main>
}

import { useRouter } from 'next/navigation'
import apiClient from '../../../../lib/api'

export default function InitiateEscrowPage() {
  const router = useRouter()
  const [balanceCents, setBalanceCents] = useState(0)

  useEffect(() => {
    let mounted = true
    apiClient.getBalance()
      .then(data => {
        if (mounted) setBalanceCents(Math.round(parseFloat(data.available || 0) * 100))
      })
      .catch(console.error)
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (data: { title: string; priceCents: number; sellerIdentifier: string }) => {
    try {
      const response = await apiClient.createEscrow(data)
      router.push(`/escrow/${response.escrowId}`)
    } catch (err: any) {
      alert(err.message || "Failed to create escrow")
    }
  }

  return <CreateEscrowForm availableBalanceCents={balanceCents} onSubmit={handleSubmit} />
}

