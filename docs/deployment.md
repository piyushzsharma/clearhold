# Deploying the simulated-money MVP

This is a single-server Docker Compose deployment. It runs a private PostgreSQL database, a migration job, the backend, the frontend, a deadline-reconciliation worker, and Caddy as the public HTTPS proxy. It does not move real money or custody digital assets. Inngest and pg_cron are optional experiments; the Compose deployment relies on the database deadline worker for recovery.

Use synthetic accounts and synthetic credentials for a public portfolio demo. As of the local October 2026 audit, `npm audit --omit=dev` reports five dependency findings (four high, one moderate) under Prisma's configuration package and Next.js's PostCSS dependency. The known exploit paths involve recursive objects passed to a config merge or attacker-controlled CSS source maps; the application does not intentionally accept either input, but that is an exposure assessment, not a security proof. A reviewed Prisma/Next upgrade remains necessary before inviting sensitive user data. The login limiter counts failed password checks only (five per account or thirty per IP within fifteen minutes), but it is process-local; a multi-instance public deployment needs a shared limiter and a reviewed proxy/IP trust policy. Backups/restore drills and alerting are operator work.

## First launch on this Windows PC (Docker Desktop)

Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) with its Linux-container/WSL 2 backend, start Docker Desktop, and wait until `docker version` succeeds in a new PowerShell window. On 21 October 2026, this stack was built and launched on Docker Desktop: all eight migrations applied, the services became healthy, and the HTTP escrow smoke test passed through Caddy.

From this Codex worktree root (`C:\Users\17spa\.codex\worktrees\ebac\ClearHold`) in PowerShell, generate a private local configuration once. This workspace already has `.env.deploy`; do **not** regenerate it:

```powershell
.\scripts\setup-docker-local.ps1
docker compose --env-file .env.deploy config --quiet
docker compose --env-file .env.deploy up --build -d
docker compose --env-file .env.deploy ps
```

The generated configuration binds Caddy to `127.0.0.1:8080`, serves plain HTTP only on this PC, and keeps PostgreSQL private to the Compose network. Open `http://localhost:8080/escrow`. Do not replace `.env.deploy` after data exists: the same database password and encryption key are needed on every restart. Docker's named PostgreSQL volume is separate from the existing `.local-postgres` developer database.

For a local-only walkthrough, create the demo accounts and run the end-to-end smoke test:

```powershell
docker compose --env-file .env.deploy run --rm backend npm run db:seed
$env:SMOKE_BASE_URL = 'http://localhost:8080'
$env:SMOKE_ADMIN_PASSWORD = 'ClearHoldDemo123!'
node scripts/smoke-local.mjs
Remove-Item Env:SMOKE_ADMIN_PASSWORD
```

The smoke test registers two fresh clients, creates two escrows, submits and reveals synthetic credentials, releases one, and resolves a dispute on the other. It writes demo data to the local Docker database; reruns create new transactions. This test passed on 21 October 2026. If startup fails, inspect `docker compose --env-file .env.deploy ps` and `docker compose --env-file .env.deploy logs --tail=100 db migrate backend frontend worker proxy`. To stop containers while retaining data, use `docker compose --env-file .env.deploy down` (without `-v`).

The demo seed creates accounts with a publicly documented password. Keep this configuration bound to localhost; use the administrator bootstrap below instead of the seed for any internet-facing host.

## Before first public launch

Use a Linux host with Docker Engine and Docker Compose, a domain whose DNS points to that host, and inbound ports 80 and 443. Copy `.env.deploy.example` to `.env.deploy`. Replace every placeholder with an independent random secret. `MASTER_KEY` and `IDEMPOTENCY_HASH_KEY` must each be exactly 64 hex characters, and `POSTGRES_PASSWORD` should be random hex so it needs no URL encoding. Set `PUBLIC_URL` to the public `https://` URL, `SITE_ADDRESS` to its hostname, and `BIND_ADDRESS=0.0.0.0`. Keep `.env.deploy` private and backed up securely; it is ignored by Git.

```bash
docker compose --env-file .env.deploy up --build -d
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy logs --tail=100 backend worker proxy
```

Compose waits for PostgreSQL health, completes all tracked Prisma migrations, then starts the backend, frontend, worker, and proxy. The backend health endpoint requires database access and valid production secrets. The worker polls every minute and settles due escrows transactionally; a restart does not erase database deadlines.

Create the first administrator once. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your shell without storing the password in repository files; the password must be at least 16 characters. Do not run the demo seed on a public deployment. The bootstrap command refuses to run after any administrator exists:

```bash
docker compose --env-file .env.deploy run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD backend node scripts/bootstrap-admin.mjs
```

Then register ordinary buyer and seller accounts through the site. Every new client account receives a clearly labelled **simulated** $1,000 balance; it is not a real deposit. The buyer can create an escrow, the seller can submit credentials, and the buyer can release or dispute. The admin can resolve a dispute. Check `https://YOUR_DOMAIN/api/health` for `{"status":"ok"}`.

## Operations

Keep a database backup and test restoring it to a separate instance. A one-off PostgreSQL custom-format backup can be made on the host with:

```bash
docker compose --env-file .env.deploy exec -T db pg_dump -U clearhold -Fc clearhold > clearhold-$(date +%F).dump
```

Protect database backups **and** the master key. Losing `MASTER_KEY` makes stored credentials unreadable. Restoring an old backup can restore wrapped keys that were later deleted, so backup retention matters when discussing key destruction. Schedule backups and rehearse a restore before public use.

To update, pull reviewed code and run `docker compose --env-file .env.deploy up --build -d`; migrations run before the new application starts. Check `docker compose --env-file .env.deploy ps`, backend health, worker logs, and a manual buyer/seller transaction. A failed migration prevents dependent services from starting. Plan a rollback for incompatible schema changes; Compose alone does not provide zero-downtime migration or high availability.

CI is configured to run schema checks, lint, types, unit tests, all four PostgreSQL integration suites, the HTTP product smoke test, both builds, and a Docker image build. The workflow has not yet run on GitHub and does **not** automatically publish or deploy an image. The local Docker Desktop deployment has been verified; a public-host deployment, restore drill, and GitHub CI run are still separate work.
