// Simple in-memory rate limiter

const rateLimitStore = new Map()
const authRateLimitStore = new Map()

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100')
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '900') * 1000 // Convert to ms
const AUTH_RATE_LIMIT_MAX = 5
const AUTH_RATE_LIMIT_WINDOW = 900 * 1000 // 15 minutes in ms

function cleanupExpiredEntries(store) {
  const now = Date.now()
  const keysToDelete = []
  
  store.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => store.delete(key))
}

export async function rateLimit(identifier) {
  cleanupExpiredEntries(rateLimitStore)
  
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)
  
  if (!entry) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    return true
  }
  
  if (now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    return true
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  entry.count++
  return true
}

export async function authRateLimit(identifier) {
  cleanupExpiredEntries(authRateLimitStore)
  
  const now = Date.now()
  const entry = authRateLimitStore.get(identifier)
  
  if (!entry) {
    authRateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + AUTH_RATE_LIMIT_WINDOW
    })
    return true
  }
  
  if (now > entry.resetTime) {
    authRateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + AUTH_RATE_LIMIT_WINDOW
    })
    return true
  }
  
  if (entry.count >= AUTH_RATE_LIMIT_MAX) {
    return false
  }
  
  entry.count++
  return true
}
