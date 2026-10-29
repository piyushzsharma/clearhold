# Durable request idempotency

Phase 6 replaces the Redis processing marker and response cache with a PostgreSQL command record. The escrow and legacy transfer write routes require an `Idempotency-Key` of 8–128 letters, digits, underscores, or hyphens. The frontend creates a UUID for each mutation and reuses it for one automatic retry after a network failure. A caller making a later manual retry must reuse the original key and byte-for-byte request body.

The record is scoped by authenticated principal, HTTP method, URL path plus query, and key. It stores an HMAC-SHA-256 fingerprint of the request body and the successful HTTP status and JSON response. The separate `IDEMPOTENCY_HASH_KEY` prevents someone with database read access from testing guesses against low-entropy credential submissions. The body itself is never stored in this record. Rotating this key requires a planned compatibility window or retiring old records; an unplanned rotation will make old retries conflict.

Each command takes a PostgreSQL transaction-scoped advisory lock on its scope. After the lock, it checks for an existing record. A matching body replays the stored response; a changed body returns HTTP 409. If absent, the command performs its business work, writes the complete result, and commits all of it in one transaction. The unique index is a second guard against duplicate records. A crash or thrown error before commit rolls back both the business effect and record. A crash after commit leaves a replayable result. Lock timeout or a transient transaction conflict returns HTTP 503 with `Retry-After: 1`; the client should reuse its original key.

| Failure point | Database result | Retry behavior |
| --- | --- | --- |
| Before commit, including during ledger posting | No business effect or command result remains | Same key can execute again |
| After commit, before HTTP response arrives | Business effect and response are both durable | Same key replays the committed response |
| Two requests arrive concurrently with the same key | One waits on the transaction lock | Same body replays; different body conflicts |
| Inngest dispatch fails after commit | Command is durable, scheduled event may be missing | Replay can attempt dispatch again, but recovery is not guaranteed without Phase 9 |

The idempotency record is append-only and has no automatic expiry because forgetting a financial command key could allow an old request to be treated as new. A future retention policy must preserve the deduplication guarantee for its declared retry window. The journal prefix is derived from the same actor/method/URL/key scope, preventing collisions between users who happen to choose the same key.

Unit tests cover key validation, HMAC fingerprints, scope separation, and the migration guard. `npm run test:db:idempotency --workspace=backend` passed against migrated local PostgreSQL 17, exercising concurrent duplicate requests, changed payload rejection, and rollback.

The command response and financial effect are atomic. Inngest dispatch is still best effort after commit, so scheduled jobs can be lost if dispatch fails and no retry arrives. Phase 9 will add an outbox and reconciliation. Redis remains in the project for rate limiting, not for financial request deduplication.

For interviews, distinguish **at-most-one committed effect per command key** from “exactly once execution.” The server may execute a callback more than once across failures, but only a committed transaction is visible. The advisory lock is the serialization point for a key; PostgreSQL's transaction commit is the durability boundary. Be ready to explain why the response is stored in the same transaction, why a unique index is still needed, why raw request bytes are fingerprinted, and what happens when the HMAC key changes.
