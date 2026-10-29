import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertTransitionDeadline,
  escrowStates,
  escrowTransitions,
  InvalidEscrowTransitionError,
  nextEscrowState,
  terminalEscrowStates,
} from './escrow-state-policy'

const allowed = new Map([
  ['AWAITING_CREDENTIALS:SUBMIT_CREDENTIALS', 'VERIFICATION_WINDOW'],
  ['AWAITING_CREDENTIALS:OPEN_DISPUTE', 'DISPUTED'],
  ['AWAITING_CREDENTIALS:TIMEOUT_REFUND', 'REFUNDED'],
  ['VERIFICATION_WINDOW:CONFIRM_RELEASE', 'RELEASED'],
  ['VERIFICATION_WINDOW:AUTO_RELEASE', 'AUTO_RELEASED'],
  ['VERIFICATION_WINDOW:OPEN_DISPUTE', 'DISPUTED'],
  ['DISPUTED:ADMIN_RELEASE', 'RELEASED'],
  ['DISPUTED:ADMIN_REFUND', 'REFUNDED'],
  ['DISPUTED:ADMIN_PARTIAL_REFUND', 'PARTIAL_REFUND'],
])

describe('escrow state policy', () => {
  it('accepts exactly the declared transition graph', () => {
    for (const state of escrowStates) {
      for (const transition of escrowTransitions) {
        const expected = allowed.get(`${state}:${transition}`)
        if (expected) assert.equal(nextEscrowState(state, transition), expected)
        else assert.throws(() => nextEscrowState(state, transition), InvalidEscrowTransitionError)
      }
    }
  })

  it('makes every settlement outcome terminal', () => {
    assert.deepEqual([...terminalEscrowStates].sort(), ['AUTO_RELEASED', 'PARTIAL_REFUND', 'REFUNDED', 'RELEASED'])
  })

  it('requires persisted deadlines before system timeout transitions', () => {
    const now = new Date('2026-10-15T12:00:00Z')
    const future = new Date('2026-10-15T12:01:00Z')
    const past = new Date('2026-10-15T11:59:00Z')
    assert.throws(() => assertTransitionDeadline({ transition: 'TIMEOUT_REFUND', now, submissionDeadline: future, verificationDeadline: null }), /has not elapsed/)
    assert.throws(() => assertTransitionDeadline({ transition: 'AUTO_RELEASE', now, submissionDeadline: past, verificationDeadline: future }), /has not elapsed/)
    assert.throws(() => assertTransitionDeadline({ transition: 'SUBMIT_CREDENTIALS', now, submissionDeadline: future, verificationDeadline: past }), /must be in the future/)
    assert.doesNotThrow(() => assertTransitionDeadline({ transition: 'TIMEOUT_REFUND', now, submissionDeadline: past, verificationDeadline: null }))
    assert.doesNotThrow(() => assertTransitionDeadline({ transition: 'AUTO_RELEASE', now, submissionDeadline: past, verificationDeadline: past }))
    assert.doesNotThrow(() => assertTransitionDeadline({ transition: 'SUBMIT_CREDENTIALS', now, submissionDeadline: future, verificationDeadline: future }))
  })

  it('keeps a database guard aligned with the application state machine', () => {
    const migration = readFileSync(
      join(process.cwd(), 'prisma', 'migrations', '20261015040000_central_escrow_state_machine', 'migration.sql'),
      'utf8',
    )
    assert.match(migration, /escrow_state_machine_guard/)
    assert.match(migration, /invalid escrow transition/)
    assert.match(migration, /must increment version exactly once/)
    assert.match(migration, /terminal escrow must not retain a wrapped credential key/)
  })
})
