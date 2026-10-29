# Deadline recovery

The single-server deployment runs `scripts/reconcile-worker.mjs` every minute. The worker calls a secret-protected backend endpoint, which asks PostgreSQL for escrows whose persisted submission or verification deadline has passed. PostgreSQL's clock determines eligibility. Each escrow is locked, rechecked, financially settled, transitioned, and audited inside one database transaction.

If the worker crashes before commit, PostgreSQL rolls the attempt back and the next sweep can retry. If it crashes after commit, the escrow is terminal and the next sweep skips it. Concurrent workers serialize on the escrow row; the ledger also has unique journal keys and database constraints. The local PostgreSQL test runs competing sweeps and checks that only one refund posts.

The worker logs counts of scanned, settled, skipped, and failed escrows. A failed escrow stays eligible and is retried on the next sweep. Operators should alert on repeated failures, worker restarts, or overdue active rows. The endpoint requires a separate `SCHEDULER_SECRET` and is not a user API.

The older Inngest functions can still run when configured. They are optional accelerators; correctness and recovery no longer depend on successful event delivery. The repository's `pg_cron_setup.sql` is not installed by migrations or Compose. Therefore the original resume wording claiming an Inngest-plus-pg_cron crash-resilient deployment is not supported by the deployed architecture.
