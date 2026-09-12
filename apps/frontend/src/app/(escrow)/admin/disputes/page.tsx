'use client'

import { useMemo, useState, useEffect } from 'react'

export interface DisputeDetailProps {
  dispute: { id: string; amountCents: number; reasonCode: string; notes: string; timeline: { type: string; actor: string; timestamp: string }[]; messages: { senderName: string; body: string; timestamp: string }[] }
  onResolve: (outcome: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND', partialAmountCents: number | null, notes: string) => Promise<{ success: boolean; conflictError?: string }>
}

type Dispute = DisputeDetailProps['dispute'] & { status: 'Open' | 'Under Review' | 'Resolved'; age: string; buyer: string }
const seeded: Dispute[] = [
  { id: 'ESC-1048', amountCents: 18900, reasonCode: 'Credentials Invalid', notes: 'The credentials do not work and the seller has not responded to the chat.', status: 'Open', age: '18m ago', buyer: 'Maya Chen', timeline: [{ type: 'Escrow Created', actor: 'Maya Chen', timestamp: 'Today, 10:04 AM' }, { type: 'Funds Locked', actor: 'System', timestamp: 'Today, 10:04 AM' }, { type: 'Credentials Submitted', actor: 'northstar_dev', timestamp: 'Today, 10:22 AM' }, { type: 'Dispute Opened', actor: 'Maya Chen', timestamp: 'Today, 10:31 AM' }], messages: [{ senderName: 'Maya Chen', body: 'The login is not working for me.', timestamp: '10:30 AM' }, { senderName: 'northstar_dev', body: 'I will take another look.', timestamp: '10:31 AM' }] },
  { id: 'ESC-1041', amountCents: 7500, reasonCode: 'Item Not as Described', notes: 'Buyer says the delivered account is missing the advertised feature.', status: 'Under Review', age: '2h ago', buyer: 'Jon Bell', timeline: [{ type: 'Escrow Created', actor: 'Jon Bell', timestamp: 'Today, 8:18 AM' }, { type: 'Funds Locked', actor: 'System', timestamp: 'Today, 8:18 AM' }, { type: 'Dispute Opened', actor: 'Jon Bell', timestamp: 'Today, 8:46 AM' }], messages: [{ senderName: 'Jon Bell', body: 'This is missing the reporting feature listed in the offer.', timestamp: '8:45 AM' }] },
  { id: 'ESC-1034', amountCents: 4200, reasonCode: 'Account Recovered by Seller', notes: 'Seller recovered access after delivery and is requesting review.', status: 'Resolved', age: 'Yesterday', buyer: 'Ravi Patel', timeline: [{ type: 'Escrow Created', actor: 'Ravi Patel', timestamp: 'Yesterday, 2:10 PM' }, { type: 'Dispute Opened', actor: 'Ravi Patel', timestamp: 'Yesterday, 3:02 PM' }, { type: 'Refund Issued', actor: 'Alex Morgan', timestamp: 'Yesterday, 4:18 PM' }], messages: [{ senderName: 'Ravi Patel', body: 'Please review the recovery event.', timestamp: '3:02 PM' }] },
]
const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

import apiClient from '../../../../lib/api'
export default function AdminDisputesPage() {
  const [filter, setFilter] = useState('All')
  const [disputes, setDisputes] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [outcome, setOutcome] = useState<'RELEASE' | 'REFUND' | 'PARTIAL_REFUND'>('REFUND')
  const [partial, setPartial] = useState('')
  const [notes, setNotes] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { escrows } = await apiClient.getAdminEscrows()
        const mapped = escrows.map((e: any) => ({
          id: e.id,
          amountCents: parseInt(e.priceCents),
          status: e.status === 'DISPUTED' ? 'Open' : e.status === 'FROZEN' ? 'Under Review' : 'Resolved',
          buyer: e.buyer?.name || e.buyer?.email || 'Unknown Buyer',
          age: new Date(e.createdAt).toLocaleDateString(),
          reasonCode: 'Review Required',
          notes: 'See audit log for details.',
          timeline: [],
          messages: []
        }))
        setDisputes(mapped)
        if (mapped.length > 0) setSelected(mapped[0])
      } catch (err) {
        console.error(err)
      }
    }
    load()
  }, [])

  const filteredDisputes = useMemo(() => filter === 'All' ? disputes : disputes.filter((d) => d.status === filter), [filter, disputes])
  const partialCents = Math.round(Number(partial) * 100)
  const valid = notes.trim().length > 0 && (outcome !== 'PARTIAL_REFUND' || partialCents > 0 && partialCents <= (selected?.amountCents || 0))
  
  async function resolve() { 
    if (!selected) return
    setBusy(true)
    try {
      await apiClient.resolveDispute(selected.id, {
        resolution: outcome,
        amountCents: outcome === 'PARTIAL_REFUND' ? partialCents : undefined,
      })
      // Remove from list or reload
      setConfirm(false)
      window.location.reload() // lazy reload for now
    } catch (err: any) {
      setConflict(err.message || 'Failed to resolve dispute.')
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  if (!selected && disputes.length === 0) {
    return <main className="admin-page"><header className="admin-topbar"><strong><span className="brand-mark">C</span> Clearhold <small>Operations</small></strong></header><div className="admin-shell">No disputes found.</div></main>
  }

  return <main className="admin-page"><header className="admin-topbar"><strong><span className="brand-mark">C</span> Clearhold <small>Operations</small></strong><span>Admin workspace</span></header><div className="admin-shell"><aside className="dispute-list"><div className="admin-title"><div><p>DISPUTE QUEUE</p><h1>Disputes</h1></div><span>{filteredDisputes.length}</span></div><div className="filter-tabs">{['All', 'Open', 'Under Review', 'Resolved'].map((x) => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x}</button>)}</div><div className="dispute-rows">{filteredDisputes.map((d) => <button key={d.id} className={`dispute-row ${selected?.id === d.id ? 'selected' : ''}`} onClick={() => setSelected(d)}><div><strong>{money(d.amountCents)}</strong><span>{d.id} · {d.age}</span></div><em className={`admin-status ${d.status.toLowerCase().replace(' ', '-')}`}>{d.status}</em><p>{d.reasonCode}</p></button>)}</div></aside>{selected && <section className="dispute-detail"><div className="detail-top"><div><p className="admin-kicker">DISPUTE {selected.id}</p><h2>{selected.reasonCode}</h2><p className="detail-sub">{selected.buyer} · {money(selected.amountCents)} locked</p></div><em className={`admin-status ${selected.status.toLowerCase().replace(' ', '-')}`}>{selected.status}</em></div>{conflict && <div className="conflict-banner">{conflict}</div>}<div className="admin-grid"><div><section className="admin-card"><h3>Audit timeline</h3><div className="timeline">{selected.timeline.map((event: any, i: number) => <div className="timeline-event" key={`${event.type}-${i}`}><i /> <div><strong>{event.type}</strong><p>{event.actor} · {event.timestamp}</p></div></div>)}</div></section><section className="admin-card"><h3>Dispute submission</h3><blockquote><strong>{selected.reasonCode}</strong><p>“{selected.notes}”</p></blockquote></section><section className="admin-card"><h3>Transaction chat <small>Read only</small></h3><div className="admin-chat">{selected.messages.map((m: any, i: number) => <div className="admin-message" key={i}><strong>{m.senderName}</strong><time>{m.timestamp}</time><p>{m.body}</p></div>)}</div></section></div><section className="admin-card resolution-card"><h3>Resolution</h3><p className="card-help">Choose the outcome for this dispute. This action is recorded in the audit trail.</p>{(['RELEASE', 'REFUND', 'PARTIAL_REFUND'] as const).map((x) => <label className="radio-option" key={x}><input type="radio" checked={outcome === x} onChange={() => setOutcome(x)} disabled={!!conflict} /><span>{x === 'RELEASE' ? 'Release Funds to Seller' : x === 'REFUND' ? 'Refund Buyer in Full' : 'Partial Refund'}</span></label>)}{outcome === 'PARTIAL_REFUND' && <label className="admin-field">Refund amount<input type="number" min="0" max={selected.amountCents / 100} value={partial} onChange={(e) => setPartial(e.target.value)} placeholder="0.00" /></label>}<label className="admin-field">Internal Resolution Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain the decision for the audit trail..." /></label><button className="execute-button" disabled={!valid || busy || !!conflict} onClick={() => setConfirm(true)}>{busy ? 'Executing…' : 'Execute Resolution'}</button>{confirm && <div className="admin-confirm"><div><h4>Confirm resolution</h4><p>You are about to {outcome === 'RELEASE' ? `release ${money(selected.amountCents)} to the seller` : `refund ${money(outcome === 'PARTIAL_REFUND' ? partialCents : selected.amountCents)} to ${selected.buyer}`}. This cannot be undone.</p></div><div><button onClick={() => setConfirm(false)}>Cancel</button><button className="danger-button" onClick={resolve}>Confirm & Execute</button></div></div>}</section></div></section>}</div></main>
}
