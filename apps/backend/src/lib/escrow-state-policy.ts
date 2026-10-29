export const escrowStates = [
  'AWAITING_CREDENTIALS',
  'VERIFICATION_WINDOW',
  'DISPUTED',
  'RELEASED',
  'AUTO_RELEASED',
  'REFUNDED',
  'PARTIAL_REFUND',
] as const

export type EscrowState = typeof escrowStates[number]

export const escrowTransitions = [
  'SUBMIT_CREDENTIALS',
  'CONFIRM_RELEASE',
  'AUTO_RELEASE',
  'OPEN_DISPUTE',
  'TIMEOUT_REFUND',
  'ADMIN_RELEASE',
  'ADMIN_REFUND',
  'ADMIN_PARTIAL_REFUND',
] as const

export type EscrowTransition = typeof escrowTransitions[number]

const transitionTable: Record<EscrowTransition, Partial<Record<EscrowState, EscrowState>>> = {
  SUBMIT_CREDENTIALS: { AWAITING_CREDENTIALS: 'VERIFICATION_WINDOW' },
  CONFIRM_RELEASE: { VERIFICATION_WINDOW: 'RELEASED' },
  AUTO_RELEASE: { VERIFICATION_WINDOW: 'AUTO_RELEASED' },
  OPEN_DISPUTE: {
    AWAITING_CREDENTIALS: 'DISPUTED',
    VERIFICATION_WINDOW: 'DISPUTED',
  },
  TIMEOUT_REFUND: { AWAITING_CREDENTIALS: 'REFUNDED' },
  ADMIN_RELEASE: { DISPUTED: 'RELEASED' },
  ADMIN_REFUND: { DISPUTED: 'REFUNDED' },
  ADMIN_PARTIAL_REFUND: { DISPUTED: 'PARTIAL_REFUND' },
}

export const terminalEscrowStates = new Set<EscrowState>([
  'RELEASED',
  'AUTO_RELEASED',
  'REFUNDED',
  'PARTIAL_REFUND',
])

export class InvalidEscrowTransitionError extends Error {
  constructor(public readonly state: EscrowState, public readonly transition: EscrowTransition) {
    super(`Invalid transition: ${transition} cannot run from ${state}`)
    this.name = 'InvalidEscrowTransitionError'
  }
}

export class EscrowDeadlineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EscrowDeadlineError'
  }
}

export function nextEscrowState(state: EscrowState, transition: EscrowTransition): EscrowState {
  const next = transitionTable[transition][state]
  if (!next) throw new InvalidEscrowTransitionError(state, transition)
  return next
}

export function assertTransitionDeadline(input: {
  transition: EscrowTransition
  now: Date
  submissionDeadline: Date
  verificationDeadline: Date | null
}) {
  if (input.transition === 'SUBMIT_CREDENTIALS' && (
    !input.verificationDeadline || input.verificationDeadline <= input.now
  )) {
    throw new EscrowDeadlineError('Verification deadline must be in the future')
  }
  if (input.transition === 'TIMEOUT_REFUND' && input.now < input.submissionDeadline) {
    throw new EscrowDeadlineError('Credential submission deadline has not elapsed')
  }
  if (input.transition === 'AUTO_RELEASE') {
    if (!input.verificationDeadline || input.now < input.verificationDeadline) {
      throw new EscrowDeadlineError('Verification deadline has not elapsed')
    }
  }
}
