import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publicRegistrationSchema } from './registration'

describe('publicRegistrationSchema', () => {
  it('normalizes email addresses and accepts legacy account categories', () => {
    const result = publicRegistrationSchema.parse({
      name: 'Demo User',
      email: '  USER@Example.COM ',
      password: 'correct horse battery staple',
      role: 'CLIENT',
    })

    assert.equal(result.email, 'user@example.com')
    assert.equal(result.role, 'CLIENT')
  })

  it('rejects attempts to assign platform privilege during registration', () => {
    const result = publicRegistrationSchema.safeParse({
      name: 'Mallory',
      email: 'mallory@example.com',
      password: 'correct horse battery staple',
      role: 'CLIENT',
      platformRole: 'ADMIN',
    })

    assert.equal(result.success, false)
  })

  it('rejects short passwords', () => {
    const result = publicRegistrationSchema.safeParse({
      name: 'Demo User',
      email: 'user@example.com',
      password: 'short-pass',
      role: 'CLIENT',
    })

    assert.equal(result.success, false)
  })
})
