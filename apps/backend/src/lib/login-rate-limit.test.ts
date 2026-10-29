import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLoginFailureLimiter } from './login-rate-limit'

describe('failed-login limiter', () => {
  it('does not consume capacity for successful sign-ins', () => {
    const limiter = createLoginFailureLimiter(2, 3)
    for (let attempt = 0; attempt < 20; attempt++) {
      assert.equal(limiter.allowed('shared-ip', 'buyer@example.com', 0), true)
    }
  })

  it('blocks repeated failures per account and clears them after the window', () => {
    const limiter = createLoginFailureLimiter(2, 10, 1000)
    limiter.recordFailure('ip-a', 'buyer@example.com', 0)
    limiter.recordFailure('ip-a', 'buyer@example.com', 1)
    assert.equal(limiter.allowed('ip-a', 'buyer@example.com', 2), false)
    assert.equal(limiter.allowed('ip-a', 'seller@example.com', 2), true)
    assert.equal(limiter.allowed('ip-a', 'buyer@example.com', 1000), true)
  })

  it('limits failures across accounts from one IP without clearing IP failures on success', () => {
    const limiter = createLoginFailureLimiter(2, 3)
    for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
      limiter.recordFailure('shared-ip', email, 0)
    }
    limiter.clearAccountFailures('a@example.com')
    assert.equal(limiter.allowed('shared-ip', 'a@example.com', 1), false)
    assert.equal(limiter.allowed('other-ip', 'a@example.com', 1), true)
  })
})
