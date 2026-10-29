# ClearHold

ClearHold is an engineering project for a secure escrow platform for peer-to-peer digital-asset trades. The repository is being rebuilt around explicit state transitions, balanced financial journals, durable retries, strict authorization, and testable failure recovery.

The current product uses **simulated USD balances**. It does not integrate with a bank, card processor, blockchain, or custody provider, and it must not be represented as moving real customer funds.

## Current development status

The repository contains two products:

- The primary ClearHold escrow experience under `/escrow`.
- A legacy PAYSTREAM payment demo under `/legacy`.

They share neutral authentication only. PAYSTREAM now has namespaced UI/API routes and its own mutable demo balances; it cannot modify the ClearHold escrow ledger. See [Legacy payment boundary](docs/legacy-payment-boundary.md).

Identity, privilege boundaries, legacy isolation, the balanced append-only financial journal, the centralized escrow state machine, durable request idempotency, the credential vault, and a database-deadline recovery worker are implemented. All four PostgreSQL integration suites pass locally. A real HTTP smoke test has passed for registration, login, escrow creation, credential delivery, release, dispute, and admin refund. See [Project scope](docs/project-scope.md), [Financial journal](docs/financial-journal.md), [Escrow state machine](docs/escrow-state-machine.md), [Durable request idempotency](docs/durable-idempotency.md), [Credential vault](docs/credential-vault.md), and [Deadline recovery](docs/recovery.md).

The Docker Compose stack was built and launched on Docker Desktop on 21 October 2026. All eight migrations applied, the database/backend/frontend health checks passed, the worker completed a deadline sweep, and the buyer/seller/admin HTTP smoke test passed through `http://localhost:8080`. This verifies a **local simulated-money deployment**, not an internet-facing or real-money production launch. The CI workflow has not yet run on GitHub. See [Deployment](docs/deployment.md).

## Repository layout

```text
apps/frontend   Next.js user interface on port 3000
apps/backend    Next.js API, NextAuth, Prisma, and Inngest endpoint on port 3001
docs            Product scope and engineering decisions
```

The browser sends same-origin `/api` requests to the frontend. The frontend proxies those requests to the backend using `BACKEND_URL`.

## Local prerequisites

- Node.js 20.9 through 24
- npm 11
- PostgreSQL 14 or newer
- Redis and the Inngest Dev Server only if exploring the optional event integration; the deployment worker does not require them

## Local setup

1. Install the pinned dependency graph.

   ```bash
   npm ci
   ```

2. Copy `apps/backend/.env.example` to `apps/backend/.env` and `apps/frontend/.env.local.example` to `apps/frontend/.env.local`.

3. Generate strong local secrets. `MASTER_KEY` and `IDEMPOTENCY_HASH_KEY` each require a different 32-byte key encoded as exactly 64 hexadecimal characters.

4. Create the database and apply tracked migrations.

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Start the applications.

   ```bash
   npm run dev
   ```

The frontend runs at `http://localhost:3000`; the backend runs at `http://localhost:3001`.

### This Windows workspace's local database

This workspace has a separate PostgreSQL 17 cluster in ignored `.local-postgres/`, listening only on `127.0.0.1:55432`. Its generated password and the backend/frontend local environment files are ignored by Git. It does not use the installed PostgreSQL service's data directory. After a reboot, run this from the repository root before starting the apps:

```powershell
.\scripts\local-db.ps1 start
npm run db:migrate:deploy
```

Use `.\scripts\local-db.ps1 status` to check it and `.\scripts\local-db.ps1 stop` when finished. The helper expects PostgreSQL 17 in `C:\Program Files\PostgreSQL\17\bin`. To verify the database behavior from a fresh PowerShell session, load `DATABASE_URL` from `apps/backend/.env` and run the three integration commands below. Never commit the generated `.env` files or `.local-postgres/`.

The seed creates clearly labelled local-only accounts. All use the password `ClearHoldDemo123!`:

- `buyer@clearhold.local`
- `seller@clearhold.local`
- `legacy-client@clearhold.local`
- `legacy-merchant@clearhold.local`
- `admin@clearhold.local` — administrator principal without a trading wallet

The buyer receives simulated seed funds through a balanced journal entry against the system issuance account.

## Verification commands

```bash
npm run db:validate
npm run type-check
npm run lint
npm run build
```

`npm run verify` runs schema validation, linting, type checking, unit tests, and both application builds. A running migrated PostgreSQL database is required for the separate `test:db:ledger`, `test:db:state`, `test:db:idempotency`, and `test:db:reconciliation` integration commands.

```powershell
$env:DATABASE_URL = (Get-Content apps/backend/.env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1).Substring(13).Trim('"')
npm run test:db:ledger --workspace=backend
npm run test:db:state --workspace=backend
npm run test:db:idempotency --workspace=backend
npm run test:db:reconciliation --workspace=backend
```

The pinned lockfile currently has known dependency advisories. The October 2026 `npm audit --omit=dev` check reports five findings in the Prisma CLI configuration path and Next.js's bundled PostCSS version; npm proposes major framework/version-line changes for them. The full development tree reports fourteen findings. See [Deployment](docs/deployment.md) for the limited synthetic-data demo scope and remaining upgrade work.

## Engineering principles

- PostgreSQL is the source of truth for escrow state and financial records.
- Financial correctness is expressed as explicit, database-enforced invariants.
- Retried commands may execute more than once but must produce one durable business effect.
- Scheduled work is derived from persisted deadlines and reconciled after failures.
- Credential encryption uses authenticated encryption and a documented key lifecycle.
- Legacy demo behavior may share neutral identity code, but not escrow financial state or domain services.
- Claims in documentation and resumes must be traceable to code, tests, and measured evidence.

## Planned phase order

1. Reproducible baseline and explicit scope — complete
2. Identity and privilege boundaries — complete
3. Legacy payment isolation — complete
4. Balanced immutable financial journal — complete; PostgreSQL integration suite passed locally
5. Central escrow state machine — complete; PostgreSQL integration suite passed locally
6. Durable request idempotency — complete; PostgreSQL integration suite passed locally
7. Credential-vault hardening — complete in code; local cryptography tests passed
8. Core frontend/API flows — HTTP smoke test passed; browser UX still needs review
9. Durable scheduling and recovery — deadline worker and concurrent PostgreSQL test passed
10. Observability and operational recovery — basic health and worker logs; alerting/restore drill pending
11. Containers and CI — local Docker Desktop launch and product smoke passed; GitHub CI run pending
12. Evidence, benchmarks, and resume review

Each phase is reviewed through **Learn → Design → Implement → Test → Interview** before the next phase begins.
