const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:3001'
const secret = process.env.SCHEDULER_SECRET
if (!secret || secret.length < 32) throw new Error('SCHEDULER_SECRET must contain at least 32 characters')

async function sweep() {
  try {
    const response = await fetch(`${url}/api/internal/reconcile`, {
      method: 'POST',
      headers: { 'x-scheduler-secret': secret },
      signal: AbortSignal.timeout(45_000),
    })
    const body = await response.json()
    console.log(JSON.stringify({ event: 'escrow_reconciliation', status: response.status, ...body }))
  } catch (error) {
    console.error('Escrow reconciliation request failed', error)
  }
}

await sweep()
setInterval(sweep, 60_000)
