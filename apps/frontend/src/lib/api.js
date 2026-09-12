const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth endpoints
  async register(data) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Wallet endpoints
  async getBalance() {
    return this.request('/api/wallet/balance')
  }

  async transfer(data) {
    return this.request('/api/wallet/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Transaction endpoints
  async getTransactions(params) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    
    const query = searchParams.toString()
    return this.request(`/api/transactions${query ? `?${query}` : ''}`)
  }

  // User endpoints
  async getUsers(params) {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.role) searchParams.set('role', params.role)
    
    const query = searchParams.toString()
    return this.request(`/api/users${query ? `?${query}` : ''}`)
  }
}

export const apiClient = new ApiClient()
export default apiClient
