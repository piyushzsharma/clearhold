<div align="center">

# 🔒 ClearHold

### Trust-verified escrow for high-risk P2P digital asset trading

*An automated, state-machine-driven middleman that holds funds until credentials are verified — so nobody has to trust a stranger on the internet.*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ledger-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Inngest](https://img.shields.io/badge/Inngest-Durable%20Workflows-blueviolet?style=flat-square)](https://www.inngest.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

[Overview](#-overview) • [Features](#-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Roadmap](#-roadmap)

</div>

---

## 📖 Overview

Peer-to-peer trading of digital assets — gaming accounts, social media handles, in-game items — happens today through manual, trust-based middlemen: a random Discord user, a subreddit "verified trader," or nothing at all. This produces predictable fraud: sellers who take payment and vanish, buyers who reject valid goods to extract refunds, and account "take-backs" after a sale completes.

**ClearHold replaces the human middleman with an auditable, cryptographically-secured state machine.** Buyer funds are locked in an isolated ledger state, released only after seller-provided credentials are verified — or resolved by an admin when the automated flow can't settle a disagreement on its own.

This isn't a wallet app with an escrow feature bolted on. It's a settlement engine, built the way real payment infrastructure is built: immutable ledgers instead of mutable balances, durable scheduling instead of best-effort timers, and every fund movement traceable back to a single auditable event.

---

## ✨ Features

| | |
|---|---|
| 🔁 **Explicit state machine** | Every escrow moves through a strict, guarded transition table — no ad-hoc status updates, no invalid state jumps. |
| 💰 **Immutable double-entry ledger** | Balances are never `UPDATE`d — they're derived from an append-only ledger of debit/credit pairs, fully auditable and provably balanced. |
| ⏱️ **Durable auto-release** | A 24-hour verification window enforced via durable workflow scheduling (Inngest) with a `pg_cron` reconciliation fallback — survives crashes, deploys, and process restarts. |
| 🔐 **Envelope-encrypted credential vault** | Seller credentials are encrypted with per-transaction data keys (AES-256-GCM), cryptographically shredded and unrecoverable once a transaction resolves. |
| ⚖️ **Admin dispute resolution** | Full transaction timeline, encrypted chat log review, and manual release/refund/partial-refund with mandatory audit logging. |
| 🔒 **Concurrency-safe by design** | Advisory-locked transactions and idempotency keys eliminate double-release and double-spend under concurrent access — tested, not assumed. |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Client
        Web[apps/web<br/>Buyer & Seller UI]
        Admin[apps/admin<br/>Dispute Dashboard]
    end

    subgraph Core["packages/ledger — Domain Logic"]
        FSM[Escrow State Machine]
        Ledger[Ledger Service]
        Vault[Credential Vault Service]
    end

    subgraph Infra
        PG[(PostgreSQL<br/>Ledger + Events)]
        Redis[(Redis<br/>Queues + Rate Limits)]
        Inngest[Inngest<br/>Durable Scheduling]
    end

    Web --> FSM
    Admin --> FSM
    FSM --> Ledger --> PG
    FSM --> Vault --> PG
    FSM --> Inngest
    FSM --> Redis
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> AWAITING_CREDENTIALS
    AWAITING_CREDENTIALS --> VERIFICATION_WINDOW
    VERIFICATION_WINDOW --> RELEASED: buyer confirms
    VERIFICATION_WINDOW --> AUTO_RELEASED: 24h elapses
    VERIFICATION_WINDOW --> DISPUTED: buyer rejects
    DISPUTED --> RELEASED: admin rules
    DISPUTED --> REFUNDED: admin rules
    DISPUTED --> PARTIAL_REFUND: admin rules
    RELEASED --> [*]
    AUTO_RELEASED --> [*]
    REFUNDED --> [*]
    PARTIAL_REFUND --> [*]
```

Every transition — automated or admin-triggered — passes through a single guarded function. No API route, worker, or admin action writes `status` directly.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM, PostgreSQL |
| Durable Scheduling | Inngest, `pg_cron` (reconciliation fallback) |
| Queues & Caching | Redis, BullMQ |
| Cryptography | AES-256-GCM envelope encryption, RSA key wrapping |
| Auth | NextAuth.js |
| Observability | OpenTelemetry, Sentry, Pino (structured logs) |
| CI/CD | GitHub Actions, Docker |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis
- An [Inngest](https://www.inngest.com/) account (free tier works for local dev)

### Installation

```bash
git clone https://github.com/<your-username>/clearhold.git
cd clearhold
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/clearhold"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="your-nextauth-secret"
MASTER_ENCRYPTION_KEY="your-32-byte-key"
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"
```

### Database Setup

```bash
npx prisma migrate dev
npx prisma db seed   # optional: seed sample escrow data
```

### Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000`. The admin dashboard runs at `http://localhost:3000/admin` (requires an account with the `admin` role).

### Run Tests

```bash
npm run test              # unit + integration tests
npm run test:concurrency  # concurrency/race-condition test suite
```

---

## 🗺️ Roadmap

- [x] Immutable double-entry ledger
- [x] Explicit escrow state machine
- [x] Durable auto-release scheduling
- [x] Envelope-encrypted credential vault
- [x] Admin dispute resolution dashboard
- [ ] Circuit breakers for external dependency calls
- [ ] CQRS read-path with Redis-cached balance projections
- [ ] Transactional outbox pattern for notification delivery
- [ ] Distributed tracing across the full escrow lifecycle
- [ ] Ledger table partitioning for long-term scale

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](../../issues) or open a PR.

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">
Built with a focus on financial correctness, not just feature completeness.
</div>
