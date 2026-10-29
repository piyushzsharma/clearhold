# ClearHold financial journal

## Accounting model

ClearHold records simulated USD movements as journal transactions containing two or more immutable entries. Each posted transaction must have equal debit and credit totals.

User balances are liability-style accounts: credits increase `USER_AVAILABLE` or `USER_HELD`; debits decrease them. `SYSTEM_ISSUANCE` offsets demo funding, and `PLATFORM_FEE` receives the configured 5% fee. Amounts are integer cents and fees use integer basis-point arithmetic, so floating-point rounding cannot lose cents.

The main postings are:

| Operation | Debits | Credits |
| --- | --- | --- |
| Demo funding | System issuance | Buyer available |
| Reserve | Buyer available | Buyer held |
| Release | Buyer held | Seller available + platform fee |
| Refund | Buyer held | Buyer available |
| Partial refund | Buyer held | Buyer available + seller available + platform fee |

## Database invariants

PostgreSQL enforces these properties in the Phase 4 migration:

- entry amounts are positive;
- a posting contains at least two entries, one currency, and equal debit/credit totals;
- only `PENDING → POSTED` is allowed, and no pending journal may commit;
- entries and posted journal transactions cannot be updated or deleted;
- entries cannot be appended after posting;
- user account projections cannot become negative;
- account identities cannot be changed or deleted;
- journal idempotency keys are unique.

Posting and the related escrow state/event execute in the caller's PostgreSQL transaction. A failed invariant rolls the whole transaction back. Account projections update inside the posting trigger in sorted account order, which serializes competing balance changes and avoids negative balances.

## Migration

Old rows were not reliable journal batches. The migration preserves each historical user balance by pairing each old row with an explicit system offset in a balanced `MIGRATION` transaction. Recognized initial-funding rows use the issuance account. Historical records are preserved without claiming that the original implementation was balanced.

## Guarantees and limits

PostgreSQL supplies atomic commit/rollback, constraints, locking, isolation, and durability according to its deployment configuration. Application code must still choose correct accounts, amounts, transition rules, and idempotency keys. Database durability also depends on settings such as synchronous commit, storage reliability, backups, and replication.

Therefore, **“100% ACID compliance always” remains indefensible**. A defensible description is that financial postings are atomic, database-balanced, append-only, and protected against concurrent negative balances. The migration and concurrency suite passed against local PostgreSQL 17; deployment durability and recovery still need operational validation.

Run the database suite after applying migrations to a disposable PostgreSQL database:

```bash
npm run test:db:ledger --workspace=backend
```

It races two reservations against one balance, attempts an unbalanced post, verifies rollback, and attempts to mutate an existing entry.

## Interview topics

- Double-entry bookkeeping detects incomplete money movement because total debits must equal total credits.
- A journal is the immutable source of financial history; `balanceCents` is a transactionally maintained projection for fast reads.
- Row updates serialize contending account postings. A database check rejects a projection below zero.
- The journal transaction and escrow transition share one database transaction, so neither can commit alone.
- Database triggers defend invariants against every application code path, while application validation gives clearer errors earlier.

