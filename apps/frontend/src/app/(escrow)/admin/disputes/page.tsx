'use client'

import { useMemo, useState, useEffect } from 'react'

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
          version: e.version,
          amountCents: parseInt(e.priceCents),
          status: e.status === 'DISPUTED' ? 'Open' : 'Resolved',
          buyer: e.buyer?.name || e.buyer?.email || 'Unknown Buyer',
          age: new Date(e.createdAt).toLocaleDateString(),
          reasonCode: (e.events.find((event: any) => event.type === 'Disputed')?.metadata?.reasonCode || 'Review Required').replaceAll('_', ' '),
          notes: e.events.find((event: any) => event.type === 'Disputed')?.metadata?.notes || 'No explanation was provided.',
          timeline: e.events.map((event: any) => ({ type: event.type, actor: event.actor?.name || event.actor?.email || 'System', timestamp: new Date(event.createdAt).toLocaleString() })),
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
        expectedVersion: selected.version,
        resolutionAction: outcome,
        reasonCode: 'PLATFORM_RULING',
        notes: notes.trim(),
        refundAmountCents: outcome === 'PARTIAL_REFUND' ? partialCents : undefined,
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

  return <main className="admin-page"><header className="admin-topbar"><strong><span className="brand-mark">C</span> Clearhold <small>Operations</small></strong><span>Admin workspace</span></header><div className="admin-shell"><aside className="dispute-list"><div className="admin-title"><div><p>DISPUTE QUEUE</p><h1>Disputes</h1></div><span>{filteredDisputes.length}</span></div><div className="filter-tabs">{['All', 'Open', 'Under Review', 'Resolved'].map((x) => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x}</button>)}</div><div className="dispute-rows">{filteredDisputes.map((d) => <button key={d.id} className={`dispute-row ${selected?.id === d.id ? 'selected' : ''}`} onClick={() => setSelected(d)}><div><strong>{money(d.amountCents)}</strong><span>{d.id} · {d.age}</span></div><em className={`admin-status ${d.status.toLowerCase().replace(' ', '-')}`}>{d.status}</em><p>{d.reasonCode}</p></button>)}</div></aside>{selected && <section className="dispute-detail"><div className="detail-top"><div><p className="admin-kicker">DISPUTE {selected.id}</p><h2>{selected.reasonCode}</h2><p className="detail-sub">{selected.buyer} · {money(selected.amountCents)} locked</p></div><em className={`admin-status ${selected.status.toLowerCase().replace(' ', '-')}`}>{selected.status}</em></div>{conflict && <div className="conflict-banner">{conflict}</div>}<div className="admin-grid"><div><section className="admin-card"><h3>Audit timeline</h3><div className="timeline">{selected.timeline.map((event: any, i: number) => <div className="timeline-event" key={`${event.type}-${i}`}><i /> <div><strong>{event.type}</strong><p>{event.actor} · {event.timestamp}</p></div></div>)}</div></section><section className="admin-card"><h3>Dispute submission</h3><blockquote><strong>{selected.reasonCode}</strong><p>“{selected.notes}”</p></blockquote></section></div><section className="admin-card resolution-card"><h3>Resolution</h3><p className="card-help">Choose the outcome for this dispute. This action is recorded in the audit trail.</p>{(['RELEASE', 'REFUND', 'PARTIAL_REFUND'] as const).map((x) => <label className="radio-option" key={x}><input type="radio" checked={outcome === x} onChange={() => setOutcome(x)} disabled={!!conflict} /><span>{x === 'RELEASE' ? 'Release Funds to Seller' : x === 'REFUND' ? 'Refund Buyer in Full' : 'Partial Refund'}</span></label>)}{outcome === 'PARTIAL_REFUND' && <label className="admin-field">Refund amount<input type="number" min="0" max={selected.amountCents / 100} value={partial} onChange={(e) => setPartial(e.target.value)} placeholder="0.00" /></label>}<label className="admin-field">Internal Resolution Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain the decision for the audit trail..." /></label><button className="execute-button" disabled={!valid || busy || !!conflict} onClick={() => setConfirm(true)}>{busy ? 'Executing…' : 'Execute Resolution'}</button>{confirm && <div className="admin-confirm"><div><h4>Confirm resolution</h4><p>You are about to {outcome === 'RELEASE' ? `release ${money(selected.amountCents)} to the seller` : `refund ${money(outcome === 'PARTIAL_REFUND' ? partialCents : selected.amountCents)} to ${selected.buyer}`}. This cannot be undone.</p></div><div><button onClick={() => setConfirm(false)}>Cancel</button><button className="danger-button" onClick={resolve}>Confirm & Execute</button></div></div>}</section></div></section>}</div></main>
}
