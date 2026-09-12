'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from 'next-auth/react'
import apiClient from '../../../../lib/api'
import { CredentialSubmit } from '../../../../components/v0/CredentialSubmit'
import { VerificationView } from '../../../../components/v0/VerificationView'

export default function EscrowDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params
  
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
    await apiClient.submitCredentials(id, { encryptedCredentials: creds })
    // Reload escrow state after submission
    const data = await apiClient.getEscrow(id)
    setEscrow(data.escrow)
  }

  // --- Buyer Handlers ---
  const handleReveal = async () => {
    try {
      const data = await apiClient.getCredentials(id)
      setCredentials(data.encryptedCredentials)
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
      await apiClient.disputeEscrow(id, { reason })
      const data = await apiClient.getEscrow(id)
      setEscrow(data.escrow)
      alert("Dispute opened. An admin will review it.")
    } catch (err: any) {
      alert(err.message || "Failed to open dispute")
    }
  }

  if (isSeller) {
    const sellerProps = {
      id: escrow.id,
      title: escrow.title,
      amountCents: parseInt(escrow.priceCents),
      buyerName: escrow.buyer?.name || 'Unknown Buyer',
      createdAt: escrow.createdAt
    }
    // TODO: implement chat fetching/sending
    return <CredentialSubmit escrow={sellerProps} onSubmit={handleSellerSubmit} messages={[]} onSendMessage={() => {}} />
  }

  if (isBuyer) {
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
        viewCount={1}
        onConfirmRelease={handleConfirmRelease}
        onOpenDispute={handleOpenDispute}
      />
    )
  }

  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Unauthorized</div>
}
