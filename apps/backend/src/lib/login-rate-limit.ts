type Entry = { count: number; resetAt: number }

// Only failed password checks count. A wider IP limit avoids locking out
// several legitimate accounts that share one browser, network, or proxy.
export function createLoginFailureLimiter(accountLimit = 5, ipLimit = 30, windowMs = 15 * 60 * 1000) {
  const failures = new Map<string, Entry>()

  function current(key: string, now: number): Entry | undefined {
    const entry = failures.get(key)
    if (entry && now >= entry.resetAt) {
      failures.delete(key)
      return undefined
    }
    return entry
  }

  function increment(key: string, now: number) {
    const entry = current(key, now)
    if (entry) entry.count++
    else failures.set(key, { count: 1, resetAt: now + windowMs })
  }

  return {
    allowed(ip: string, email: string, now = Date.now()) {
      return (current(`ip:${ip}`, now)?.count ?? 0) < ipLimit &&
        (current(`account:${email}`, now)?.count ?? 0) < accountLimit
    },
    recordFailure(ip: string, email: string, now = Date.now()) {
      increment(`ip:${ip}`, now)
      increment(`account:${email}`, now)
    },
    clearAccountFailures(email: string) {
      failures.delete(`account:${email}`)
    },
  }
}

export const loginFailureLimiter = createLoginFailureLimiter()
