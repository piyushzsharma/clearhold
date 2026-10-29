# Escrow state machine

Phase 5 makes escrow lifecycle changes a domain operation instead of allowing routes and workers to assign status strings independently.

## Persisted states and commands

| Current state | Command | Next state | Initiator |
| --- | --- | --- | --- |
| `AWAITING_CREDENTIALS` | `SUBMIT_CREDENTIALS` | `VERIFICATION_WINDOW` | Seller |
| `AWAITING_CREDENTIALS` | `OPEN_DISPUTE` | `DISPUTED` | Buyer or seller |
| `AWAITING_CREDENTIALS` | `TIMEOUT_REFUND` | `REFUNDED` | System, after submission deadline |
| `VERIFICATION_WINDOW` | `CONFIRM_RELEASE` | `RELEASED` | Buyer |
| `VERIFICATION_WINDOW` | `AUTO_RELEASE` | `AUTO_RELEASED` | System, after verification deadline |
| `VERIFICATION_WINDOW` | `OPEN_DISPUTE` | `DISPUTED` | Buyer or seller |
| `DISPUTED` | `ADMIN_RELEASE` | `RELEASED` | Administrator |
| `DISPUTED` | `ADMIN_REFUND` | `REFUNDED` | Administrator |
| `DISPUTED` | `ADMIN_PARTIAL_REFUND` | `PARTIAL_REFUND` | Administrator |

`RELEASED`, `AUTO_RELEASED`, `REFUNDED`, and `PARTIAL_REFUND` are terminal. The old `CREATED` and `FROZEN` enum values had no complete workflow and are removed by migration. Creation is one atomic command that persists an `AWAITING_CREDENTIALS` escrow together with its reserved funds.

## Enforcement layers

`escrow-state-policy.ts` is the pure transition graph and deadline policy. `escrow-state-machine.ts` locks the escrow row, applies that policy, increments the version, removes the wrapped credential key for terminal outcomes, and writes a standardized event. Ledger posting and transition execution share the caller's database transaction, so either both commit or both roll back.

The migration adds a PostgreSQL trigger that rejects invalid edges, version changes without a status change, status changes without one version increment, incomplete verification state, and terminal rows retaining a wrapped key. This protects the invariant from SQL scripts or future code that bypasses the TypeScript service.

`submissionDeadline` and `verificationDeadline` are persisted facts. Workers may run late or retry, but cannot execute timeout commands before those clocks expire. Row locks serialize competing settlement, dispute, and timeout attempts; after waiting, the loser observes the committed state and its transition is rejected or skipped.

Prisma writes these `timestamp without time zone` deadlines as UTC values. The database trigger and pg_cron comparison therefore use a UTC wall clock explicitly. The `createdAt` default is also UTC for new escrow rows. Historical rows written under a non-UTC database session may need a one-time timestamp review before use in production.

## Evidence and limits

The unit suite exhaustively checks every state/command pair and deadline boundaries. `npm run test:db:state --workspace=backend` passed against migrated local PostgreSQL 17, checking the database trigger, non-UTC session handling, and a concurrent terminal-transition race.

Phase 6 adds a durable PostgreSQL request-idempotency record to the same transaction as each API command. Durable event delivery remains Phase 9 work: a transaction can still commit before `inngest.send` succeeds.
