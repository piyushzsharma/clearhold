const API_BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

class ApiClient {
  baseURL: string;

  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL
  }

  async request(endpoint: string, options: any = {}) {
    const url = `${this.baseURL}${endpoint}`
    const { headers: suppliedHeaders = {}, ...requestOptions } = options
    const headers = new Headers(suppliedHeaders)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (requestOptions.method && !['GET', 'HEAD'].includes(requestOptions.method.toUpperCase()) && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', crypto.randomUUID())
    }
    const config = {
      ...requestOptions,
      headers,
    }

    let response: Response
    try {
      response = await fetch(url, config)
    } catch (networkError) {
      if (!headers.has('Idempotency-Key')) throw networkError
      // Reuse the exact same request and key after an ambiguous network failure.
      response = await fetch(url, config)
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.message || error.error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth endpoints
  async register(data: any) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Escrow financial endpoints
  async getBalance() {
    return this.request('/api/escrow/balance')
  }

  // Escrow endpoints
  async getEscrows(params?: { cursor?: string; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.cursor) searchParams.set('cursor', params.cursor)
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    
    const query = searchParams.toString()
    return this.request(`/api/escrow${query ? `?${query}` : ''}`)
  }

  async getEscrow(id: string) {
    return this.request(`/api/escrow/${id}`)
  }

  async createEscrow(data: any) {
    return this.request('/api/escrow/create', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async submitCredentials(id: string, data: any) {
    return this.request(`/api/escrow/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  
  async getCredentials(id: string) {
    return this.request(`/api/escrow/${id}/credentials`)
  }

  async releaseEscrow(id: string) {
    return this.request(`/api/escrow/${id}/confirm`, {
      method: 'POST',
    })
  }

  async disputeEscrow(id: string, data: { reasonCode: string; notes: string }) {
    return this.request(`/api/escrow/${id}/dispute`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Admin Escrow endpoints
  async getAdminEscrows(params?: { cursor?: string; limit?: number; status?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.cursor) searchParams.set('cursor', params.cursor)
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.status) searchParams.set('status', params.status)
    
    const query = searchParams.toString()
    return this.request(`/api/admin/escrow${query ? `?${query}` : ''}`)
  }

  async resolveDispute(id: string, data: { expectedVersion: number; resolutionAction: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND'; reasonCode: 'PLATFORM_RULING'; notes: string; refundAmountCents?: number }) {
    return this.request(`/api/admin/escrow/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const apiClient = new ApiClient()
export default apiClient
