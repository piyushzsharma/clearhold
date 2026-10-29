'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSession } from 'next-auth/react'
import apiClient from '../../../../lib/api'
import { CredentialSubmit } from '../../../../components/v0/CredentialSubmit'
import { VerificationView } from '../../../../components/v0/VerificationView'

export default function EscrowDetailsPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  
  const [session, setSession] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [credentials, setCredentials] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const sess = await getSession()
        if (!sess?.user) {
          router.push('/api/auth/signin')
          return
        }
        setSession(sess)

        const data = await apiClient.getEscrow(id)
        if (mounted) setEscrow(data.escrow)
      } catch (err: any) {
        console.error("Failed to load escrow", err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id, router])

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }

  if (!escrow) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Escrow not found or access denied.</div>
  }

  const isSeller = session?.user?.id === escrow.sellerId
  const isBuyer = session?.user?.id === escrow.buyerId

  // --- Seller Handlers ---
  const handleSellerSubmit = async (creds: string) => {
    await apiClient.submitCredentials(id, { credentialsPlaintext: creds })
    // Reload escrow state after submission
    const data = await apiClient.getEscrow(id)
    setEscrow(data.escrow)
  }

  // --- Buyer Handlers ---
  const handleReveal = async () => {
    try {
      const data = await apiClient.getCredentials(id)
      setCredentials(data.credentials)
    } catch (err: any) {
      alert(err.message || "Failed to reveal credentials")
    }
  }

  const handleConfirmRelease = async () => {
    try {
      await apiClient.releaseEscrow(id)
      const data = await apiClient.getEscrow(id)
      setEscrow(data.escrow)
      alert("Funds released successfully!")
    } catch (err: any) {
      alert(err.message || "Failed to release funds")
    }
  }

  const handleOpenDispute = async (reason: string, notes: string) => {
    try {
      await apiClient.disputeEscrow(id, { reasonCode: reason, notes })
      const data = await apiClient.getEscrow(id)
      setEscrow(data.escrow)
      alert("Dispute opened. An admin will review it.")
    } catch (err: any) {
      alert(err.message || "Failed to open dispute")
    }
  }

  if (isSeller) {
    if (escrow.status !== 'AWAITING_CREDENTIALS') {
      return <main className="details-page"><div className="details-container"><a href="/escrow">← Back to escrows</a><h1>{escrow.title}</h1><p>Status: {escrow.status.replaceAll('_', ' ')}</p><p>Credentials can only be submitted while this trade is awaiting delivery.</p></div></main>
    }
    const sellerProps = {
      id: escrow.id,
      title: escrow.title,
      amountCents: parseInt(escrow.priceCents),
      buyerName: escrow.buyer?.name || 'Unknown Buyer',
      createdAt: escrow.createdAt
    }
    // TODO: implement chat fetching/sending
    return <CredentialSubmit escrow={sellerProps} onSubmit={handleSellerSubmit} />
  }

  if (isBuyer) {
    if (escrow.status !== 'VERIFICATION_WINDOW') {
      return <main className="details-page"><div className="details-container"><a href="/escrow">← Back to escrows</a><h1>{escrow.title}</h1><p>Status: {escrow.status.replaceAll('_', ' ')}</p><p>{escrow.status === 'AWAITING_CREDENTIALS' ? 'Waiting for the seller to submit credentials.' : 'This escrow is no longer in the verification window.'}</p></div></main>
    }
    const buyerProps = {
      id: escrow.id,
      title: escrow.title,
      amountCents: parseInt(escrow.priceCents),
      sellerName: escrow.seller?.name || 'Unknown Seller',
      verificationDeadline: escrow.verificationDeadline || new Date().toISOString()
    }
    return (
      <VerificationView 
        escrow={buyerProps}
        credentials={credentials}
        onReveal={handleReveal}
        onConfirmRelease={handleConfirmRelease}
        onOpenDispute={handleOpenDispute}
      />
    )
  }

  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Unauthorized</div>
}
