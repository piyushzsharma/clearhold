'use client'

import { FormEvent, useMemo, useState } from 'react'

export interface VerificationViewProps {
  escrow: { id: string; title: string; amountCents: number; sellerName: string; verificationDeadline: string }
  credentials: string | null
  onReveal: () => Promise<void>
  viewCount: number
  onConfirmRelease: () => Promise<void>
  onOpenDispute: (reasonCode: string, notes: string) => Promise<void>
}

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const date = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))

export function VerificationView({ escrow, credentials, onReveal, viewCount, onConfirmRelease, onOpenDispute }: VerificationViewProps) {
  const [revealed, setRevealed] = useState(false), [revealing, setRevealing] = useState(false), [confirmed, setConfirmed] = useState(false), [releasing, setReleasing] = useState(false), [disputeOpen, setDisputeOpen] = useState(false), [reason, setReason] = useState(''), [notes, setNotes] = useState(''), [disputing, setDisputing] = useState(false)
  const deadline = useMemo(() => new Date(escrow.verificationDeadline), [escrow.verificationDeadline])
  const hoursRemaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 3600000)), minutesRemaining = Math.max(0, Math.floor(((deadline.getTime() - Date.now()) % 3600000) / 60000))
  const canRelease = revealed && confirmed && !releasing
  async function reveal() { if (revealed) return; setRevealing(true); try { await onReveal(); setRevealed(true) } finally { setRevealing(false) } }
  async function release() { if (!canRelease) return; setReleasing(true); try { await onConfirmRelease() } finally { setReleasing(false) } }
  async function dispute(event: FormEvent) { event.preventDefault(); if (!reason || !notes.trim()) return; setDisputing(true); try { await onOpenDispute(reason, notes.trim()); setDisputeOpen(false) } finally { setDisputing(false) } }
  return <main className="details-page verification-page">
    <header className="form-topbar"><a className="brand" href="/"><span className="brand-mark">C</span><span>clearhold</span></a><span className="form-account"><span className="avatar">AR</span> Alex Rivera</span></header>
    <div className="details-container"><nav className="form-breadcrumb" aria-label="Breadcrumb"><a href="/">Workspace</a><span>/</span><span>Verification</span></nav>
      <div className="details-heading"><div><p className="eyebrow">Buyer workspace <span className="trade-id">#{escrow.id}</span></p><h1>{escrow.title}</h1><p className="form-intro">Review the submitted access and release funds when everything looks right.</p></div><span className="secure-label"><span className="lock-icon">⌑</span> Protected trade</span></div>
      <section className="verification-banner"><div><strong>Verification window is open</strong><p>Credentials are ready for you to review. Take your time and confirm access before releasing funds.</p></div><span className="verification-clock">⌁</span></section>
      <section className="verification-countdown"><div><strong>Time remaining to verify: {hoursRemaining}h {minutesRemaining}m</strong><p>If no action is taken, funds will auto-release to the seller when the timer ends.</p></div><div className="countdown-track"><span style={{ width: `${Math.min(100, Math.max(5, (hoursRemaining * 60 + minutesRemaining) / (24 * 60) * 100))}%` }} /></div></section>
      <section className="details-summary"><div className="details-section-heading"><div><h2>Transaction summary</h2><p>Funds remain locked while you verify the delivery.</p></div><span className="status-badge status-verification_window"><span className="status-dot" /> Verification window</span></div><dl className="summary-grid"><div><dt>Title</dt><dd>{escrow.title}</dd></div><div><dt>Amount locked</dt><dd className="locked-amount">{money(escrow.amountCents)}</dd></div><div><dt>Seller</dt><dd>{escrow.sellerName}</dd></div><div><dt>Created</dt><dd>{date(escrow.verificationDeadline)}</dd></div></dl></section>
      <section className="credential-card"><div className="details-section-heading"><div><h2>Submitted credentials</h2><p>Reveal only when you are ready to access the account.</p></div><span className="step-label">Encrypted</span></div>{!revealed ? <button className="reveal-button" onClick={reveal} disabled={revealing}>{revealing && <span className="spinner small" />}{revealing ? 'Decrypting securely...' : '⌑  Reveal Credentials'}</button> : <><div className="revealed-credentials"><code>{credentials || 'seller@example.com\nPassword: ••••••••••••'}</code><button className="copy-button" onClick={() => navigator.clipboard?.writeText(credentials || '')}>Copy</button></div><p className="credential-note">⌑ This access has been logged for dispute protection. Viewed {Math.max(1, viewCount)} times.</p></>}</section>
      <section className={`verification-confirm ${!revealed ? 'is-disabled' : ''}`}><label className="confirm-row"><input type="checkbox" checked={confirmed} disabled={!revealed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>Confirm you were able to successfully access the account</strong><small>This confirmation is required before funds can be released.</small></span></label></section>
      <div className="verification-actions"><button className="release-button" onClick={release} disabled={!canRelease}>{releasing && <span className="spinner" />}{releasing ? 'Releasing funds...' : 'Confirm & Release Funds'}</button><button className="dispute-button" onClick={() => setDisputeOpen(true)}>Something&apos;s Wrong — Open a Dispute</button></div>
    </div>
    {disputeOpen && <div className="modal-backdrop" role="presentation"><section className="dispute-modal" role="dialog" aria-modal="true" aria-labelledby="dispute-title"><div className="modal-heading"><div><h2 id="dispute-title">Open a dispute</h2><p>Tell us what went wrong so we can protect the trade.</p></div><button className="modal-close" onClick={() => setDisputeOpen(false)} aria-label="Close dispute dialog">×</button></div><form onSubmit={dispute}><label className="modal-field">Reason<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Select a reason</option><option value="credentials_invalid">Credentials Invalid</option><option value="account_recovered">Account Recovered by Seller</option><option value="item_not_as_described">Item Not as Described</option><option value="other">Other</option></select></label><label className="modal-field">Explanation<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the issue..." rows={5} required /></label><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setDisputeOpen(false)}>Cancel</button><button type="submit" className="dispute-submit" disabled={!reason || !notes.trim() || disputing}>{disputing && <span className="spinner" />}{disputing ? 'Submitting...' : 'Submit Dispute'}</button></div></form></section></div>}
  </main>
}


