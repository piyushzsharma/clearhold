import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin@clearhold.local'
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD
if (!adminPassword) throw new Error('Set SMOKE_ADMIN_PASSWORD for the seeded local admin')

function browser() {
  const cookies = new Map()
  return async (path, options = {}) => {
    const headers = new Headers(options.headers)
    if (cookies.size) headers.set('cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '))
    const response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' })
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';')
      const at = pair.indexOf('=')
      if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1))
    }
    return response
  }
}

async function json(request, path, method = 'GET', body) {
  const response = await request(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`)
  return data
}

async function login(request, email, password) {
  const csrf = await json(request, '/api/auth/csrf')
  const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/escrow`, json: 'true' })
  await request('/api/auth/callback/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  })
  const session = await json(request, '/api/auth/session')
  assert.equal(session.user?.email, email)
}

const suffix = randomUUID().slice(0, 8)
const password = `Smoke-${randomUUID()}!`
const buyerEmail = `buyer-${suffix}@smoke.local`
const sellerEmail = `seller-${suffix}@smoke.local`
const anonymous = browser()
for (const [email, name] of [[buyerEmail, 'Smoke Buyer'], [sellerEmail, 'Smoke Seller']]) {
  await json(anonymous, '/api/auth/register', 'POST', { name, email, password, role: 'CLIENT' })
}

const buyer = browser()
const seller = browser()
const admin = browser()
await login(buyer, buyerEmail, password)
await login(seller, sellerEmail, password)
await login(admin, adminEmail, adminPassword)

async function trade(title) {
  const created = await json(buyer, '/api/escrow/create', 'POST', { title, priceCents: 1_000, sellerIdentifier: sellerEmail })
  const escrowId = created.escrowId
  const secret = `credential-${randomUUID()}`
  await json(seller, `/api/escrow/${escrowId}/submit`, 'POST', { credentialsPlaintext: secret })
  const revealed = await json(buyer, `/api/escrow/${escrowId}/credentials`)
  assert.equal(revealed.credentials, secret)
  return escrowId
}

const released = await trade(`Release ${suffix}`)
await json(buyer, `/api/escrow/${released}/confirm`, 'POST', {})
assert.equal((await json(buyer, `/api/escrow/${released}`)).escrow.status, 'RELEASED')

const disputed = await trade(`Dispute ${suffix}`)
await json(buyer, `/api/escrow/${disputed}/dispute`, 'POST', { reasonCode: 'CREDENTIALS_INVALID', notes: 'Smoke test dispute' })
const detail = (await json(admin, `/api/escrow/${disputed}`)).escrow
await json(admin, `/api/admin/escrow/${disputed}/resolve`, 'POST', {
  expectedVersion: detail.version, resolutionAction: 'REFUND', reasonCode: 'PLATFORM_RULING', notes: 'Smoke test resolution',
})
assert.equal((await json(buyer, `/api/escrow/${disputed}`)).escrow.status, 'REFUNDED')
console.log('HTTP smoke passed: register, login, create, submit, reveal, release, dispute, admin refund.')
