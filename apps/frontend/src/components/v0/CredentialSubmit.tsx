'use client'

import { FormEvent, useState } from 'react'

export interface CredentialSubmitProps {
  escrow: { id: string; title: string; amountCents: number; buyerName: string; createdAt: string }
  onSubmit: (credentials: string) => Promise<void>
}

const formatMoney = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const formatDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

export function CredentialSubmit({ escrow, onSubmit }: CredentialSubmitProps) {
  const [credentials, setCredentials] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canSubmit = Boolean(credentials.trim() && confirmed && !isSubmitting)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    try { await onSubmit(credentials.trim()); setCredentials(''); setConfirmed(false) } finally { setIsSubmitting(false) }
  }

  return (
    <main className="details-page">
      <header className="form-topbar">
        <a className="brand" href="/"><span className="brand-mark">C</span><span>clearhold</span></a>
        <span className="form-account">Seller workspace</span>
      </header>
      <div className="details-container">
        <nav className="form-breadcrumb" aria-label="Breadcrumb"><a href="/">Workspace</a><span>/</span><span>Escrow details</span></nav>
        <div className="details-heading">
          <div><p className="eyebrow">Seller workspace <span className="trade-id">#{escrow.id}</span></p><h1>{escrow.title}</h1><p className="form-intro">Review the trade details and complete your secure submission.</p></div>
          <span className="secure-label"><span className="lock-icon">⌑</span> Protected trade</span>
        </div>

        <section className="awaiting-banner" aria-label="Awaiting your action">
          <span className="awaiting-icon">!</span>
          <div><strong>Awaiting Your Action</strong><p>The buyer has locked funds for this trade. Submit the account credentials to proceed.</p></div>
        </section>

        <section className="details-summary" aria-labelledby="summary-title">
          <div className="details-section-heading"><div><h2 id="summary-title">Transaction summary</h2><p>Funds are held securely until the verification window closes.</p></div><span className="status-badge status-awaiting_credentials"><span className="status-dot" /> Funds locked</span></div>
          <dl className="summary-grid">
            <div><dt>Title</dt><dd>{escrow.title}</dd></div>
            <div><dt>Amount locked</dt><dd className="locked-amount">{formatMoney(escrow.amountCents)}</dd></div>
            <div><dt>Buyer</dt><dd>{escrow.buyerName}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(escrow.createdAt)}</dd></div>
          </dl>
        </section>

        <form className="credential-card" onSubmit={handleSubmit}>
          <div className="details-section-heading"><div><h2>Submit account credentials</h2><p>Provide the information the buyer needs to verify the trade.</p></div><span className="step-label">Required</span></div>
          <label className="credential-label" htmlFor="credentials"><span className="credential-label-title"><span className="credential-lock" aria-hidden="true">⌑</span> Secure credentials</span><span className="sr-only">Credentials are encrypted before storage</span></label>
          <textarea id="credentials" value={credentials} onChange={(event) => setCredentials(event.target.value)} placeholder="Enter the account email, username, password, or other access details..." rows={7} aria-describedby="credential-note" />
          <p className="credential-note" id="credential-note"><span className="note-lock" aria-hidden="true">⌑</span> Encrypted with AES-256-GCM before storage. Only the authorized buyer can request access during the 24-hour verification window.</p>
          <label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm these credentials are accurate and complete</span></label>
          <div className="credential-actions"><span className="secure-note">Your submission is encrypted in transit.</span><button className="submit-button" type="submit" disabled={!canSubmit}>{isSubmitting && <span className="spinner" aria-hidden="true" />}{isSubmitting ? 'Encrypting & submitting...' : 'Encrypt & Submit Credentials'}</button></div>
        </form>


      </div>
    </main>
  )
}
