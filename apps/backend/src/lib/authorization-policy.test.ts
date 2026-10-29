import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AuthenticationError,
  AuthorizationError,
  authorizeIdentity,
  type Principal,
} from './authorization-policy'

const userPrincipal: Principal = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  role: 'CLIENT',
  platformRole: 'USER',
}

const adminPrincipal: Principal = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Administrator',
  role: 'CLIENT',
  platformRole: 'ADMIN',
}

describe('authorizeIdentity', () => {
  it('rejects requests without an authenticated session', async () => {
    let loaderCalled = false
    const loader = async () => {
      loaderCalled = true
      return null
    }

    await assert.rejects(authorizeIdentity(null, loader), AuthenticationError)
    assert.equal(loaderCalled, false)
  })

  it('rejects a valid token when the database user no longer exists', async () => {
    const loader = async () => null

    await assert.rejects(
      authorizeIdentity({ user: { id: 'deleted-user' } }, loader),
      AuthenticationError,
    )
  })

  it('uses the database privilege instead of a stale elevated JWT claim', async () => {
    const staleElevatedSession = {
      user: { id: userPrincipal.id, platformRole: 'ADMIN' },
    }

    await assert.rejects(
      authorizeIdentity(
        staleElevatedSession,
        async () => userPrincipal,
        { platformRoles: ['ADMIN'] },
      ),
      AuthorizationError,
    )
  })

  it('honors a database promotion even when the JWT claim is stale', async () => {
    const staleUserSession = {
      user: { id: adminPrincipal.id, platformRole: 'USER' },
    }

    const result = await authorizeIdentity(
        staleUserSession,
        async () => adminPrincipal,
        { platformRoles: ['ADMIN'] },
      )

    assert.deepEqual(result, adminPrincipal)
  })

  it('can enforce the legacy account category independently', async () => {
    await assert.rejects(
      authorizeIdentity(
        { user: { id: userPrincipal.id } },
        async () => userPrincipal,
        { platformRoles: ['USER'], legacyRoles: ['MERCHANT'] },
      ),
      AuthorizationError,
    )
  })
})
