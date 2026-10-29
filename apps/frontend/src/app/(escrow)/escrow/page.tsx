'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'

interface EscrowRow {
  id: string
  title: string
  counterpartyName: string
  role: 'BUYER' | 'SELLER'
  amountCents: number
  status:
    | 'AWAITING_CREDENTIALS'
    | 'VERIFICATION_WINDOW'
    | 'DISPUTED'
    | 'RELEASED'
    | 'AUTO_RELEASED'
    | 'REFUNDED'
    | 'PARTIAL_REFUND'
  verificationDeadline: string | null
}

interface EscrowDashboardProps {
  escrows: EscrowRow[]
  walletBalance: { availableCents: number; heldCents: number }
  isLoading: boolean
  userName: string
}

const statusLabels: Record<EscrowRow['status'], string> = {
  AWAITING_CREDENTIALS: 'Awaiting credentials', VERIFICATION_WINDOW: 'Verification window', DISPUTED: 'Disputed', RELEASED: 'Released', AUTO_RELEASED: 'Auto-released', REFUNDED: 'Refunded', PARTIAL_REFUND: 'Partial refund',
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function timeRemaining(deadline: string | null) {
  if (!deadline) return '—'
  const difference = new Date(deadline).getTime() - Date.now()
  if (difference <= 0) return 'Due now'
  const hours = Math.floor(difference / 3600000)
  const days = Math.floor(hours / 24)
  return days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h left`
}

function StatusBadge({ status }: { status: EscrowRow['status'] }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><span className="status-dot" />{statusLabels[status]}</span>
}

function TableSkeleton() {
  return <div className="skeleton-list" aria-label="Loading escrows" aria-busy="true">{[1, 2, 3, 4].map((row) => <div className="skeleton-row" key={row}><span /><span /><span /><span /><span /></div>)}</div>
}

import { useRouter } from 'next/navigation'

function EscrowDashboard({ escrows, walletBalance, isLoading, userName }: EscrowDashboardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const totalCents = walletBalance.availableCents + walletBalance.heldCents

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Clearhold home"><span className="brand-mark">C</span><span>clearhold</span></a>
        <nav className="topnav" aria-label="Primary navigation"><a className="active" href="#escrows">Escrows</a><a href="#activity">Activity</a></nav>
        <div className="top-actions"><button className="new-escrow" type="button" onClick={() => router.push('/escrow/create')}>New escrow <span aria-hidden="true">+</span></button><details className="profile-menu" open={menuOpen} onToggle={(event) => setMenuOpen((event.target as HTMLDetailsElement).open)}><summary aria-label="Open account menu"><span className="avatar">{userName.slice(0, 2).toUpperCase()}</span><span className="profile-name">{userName}</span><span className="chevron">⌄</span></summary><div className="menu-popover"><a href="#settings">Settings</a><a href="/legacy">PAYSTREAM legacy demo</a><button type="button" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>Log out</button></div></details></div>
      </header>

      <main id="top" className="content">
        <div className="page-heading"><div><p className="eyebrow">Workspace / Overview</p><h1>Welcome, {userName}</h1><p className="subheading">Keep track of your active transactions and available funds.</p></div><span className="secure-label"><span className="lock-icon">⌑</span> Funds protected</span></div>

        <section className="wallet-card" aria-labelledby="wallet-heading"><div className="section-kicker" id="wallet-heading">Wallet summary <span>Updated just now</span></div><div className="wallet-grid"><div className="balance primary-balance"><span>Available balance</span><strong>{money(walletBalance.availableCents)}</strong></div><div className="balance held-balance"><span>Held in escrow <button className="info-tip" type="button" title="Funds reserved for active trades, not yet released." aria-label="Funds reserved for active trades, not yet released.">i</button></span><strong>{money(walletBalance.heldCents)}</strong></div><div className="balance total-balance"><span>Total</span><strong>{money(totalCents)}</strong></div></div></section>

        <section id="escrows" className="escrow-section" aria-labelledby="active-heading"><div className="section-header"><div><h2 id="active-heading">Active escrows</h2><p>Transactions currently in progress</p></div><button className="filter-button" type="button"><span aria-hidden="true">☷</span> Filter <span className="filter-count">{escrows.length}</span></button></div><div className="table-card">{isLoading ? <TableSkeleton /> : escrows.length === 0 ? <div className="empty-state"><div className="empty-icon" aria-hidden="true">⌁</div><h3>No active escrows yet</h3><p>Create an escrow to securely hold funds while you and your counterparty complete a trade.</p><button className="new-escrow" type="button" onClick={() => router.push('/escrow/create')}>Create your first escrow <span aria-hidden="true">+</span></button></div> : <div className="table-wrap"><table><thead><tr><th>Title</th><th>Counterparty</th><th>Amount</th><th>Status</th><th>Time remaining</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{escrows.map((escrow) => <tr key={escrow.id}><td><span className="trade-title">{escrow.title}</span><span className="trade-id">#{escrow.id.replace('esc-', 'CH-')}</span></td><td><span className="counterparty">{escrow.counterpartyName}</span><span className="role">{escrow.role === 'BUYER' ? 'Buyer' : 'Seller'}</span></td><td className="amount">{money(escrow.amountCents)}</td><td><StatusBadge status={escrow.status} /></td><td className="remaining">{escrow.status === 'VERIFICATION_WINDOW' ? timeRemaining(escrow.verificationDeadline) : '—'}</td><td className="action-cell"><button className="view-button" type="button" onClick={() => router.push(`/escrow/${escrow.id}`)}>View <span aria-hidden="true">→</span></button></td></tr>)}</tbody></table></div>}</div></section>
        <footer className="footer"><span>ClearHold demo</span><span>Simulated balances only; no real funds or insurance.</span></footer>
      </main>
    </div>
  )
}

export default function Page() {
  const { data: session } = useSession()
  const [escrows, setEscrows] = useState<EscrowRow[]>([])
  const [walletBalance, setWalletBalance] = useState({ availableCents: 0, heldCents: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const { apiClient } = await import('../../../lib/api')
        const [escrowsData, balanceData] = await Promise.all([
          apiClient.getEscrows(),
          apiClient.getBalance().catch(() => ({ available: 0, held: 0 }))
        ])
        
        if (!mounted) return

        // Map backend escrow format to UI format
        const mappedEscrows = escrowsData.escrows.map((e: any) => ({
          id: e.id,
          title: e.title,
          counterpartyName: e.buyerId === session?.user?.id ? (e.seller?.name || 'Seller') : (e.buyer?.name || 'Buyer'),
          role: e.buyerId === session?.user?.id ? 'BUYER' : 'SELLER',
          amountCents: parseInt(e.priceCents),
          status: e.status,
          verificationDeadline: e.verificationDeadline
        }))

        setEscrows(mappedEscrows)
        setWalletBalance({
          availableCents: Math.round(parseFloat(balanceData.available || 0) * 100),
          heldCents: Math.round(parseFloat(balanceData.held || 0) * 100)
        })
      } catch (err) {
        console.error("Failed to load dashboard data", err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadData()
    return () => { mounted = false }
  }, [session?.user?.id])

  return <EscrowDashboard escrows={escrows} walletBalance={walletBalance} isLoading={isLoading} userName={session?.user?.name || session?.user?.email || 'Trader'} />
}
