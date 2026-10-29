# ClearHold product scope

## Product boundary

ClearHold is currently a single-currency, simulated-money escrow platform for peer-to-peer trades involving delivery of digital credentials or comparable digital access.

The project demonstrates financial and distributed-systems engineering. It does not currently provide regulated custody, fiat deposits or withdrawals, blockchain settlement, identity verification, asset-title transfer, or insurance.

The application can verify that its own workflow and accounting rules were followed. It cannot prove that a seller surrendered every recovery path to an external account, and it cannot revoke credentials that a buyer has already viewed.

## Primary actors

- **Buyer:** funds an escrow, reviews delivery, releases funds, or opens a dispute.
- **Seller:** receives an escrow request and submits the agreed delivery.
- **Administrator:** reviews disputed trades and records a privileged resolution.
- **System:** executes authenticated scheduled transitions and reconciliation.

Administrators are human users with an explicit `platformRole`; system jobs use a separate event actor type and never masquerade as user rows. API authorization reloads the current principal from PostgreSQL rather than trusting a role copied into a session token.

## Core invariants targeted by the finished project

1. Every escrow transition is permitted by one reviewed state machine.
2. Every financial operation is represented by one balanced, immutable journal.
3. Available balances cannot become negative under concurrent commands.
4. One escrow can have at most one terminal settlement effect.
5. State, financial entries, audit event, idempotency result, and outbox work commit atomically when they belong to one command.
6. Duplicate or out-of-order delivery cannot duplicate a business effect.
7. Persisted deadlines, rather than process timers, define expiry.
8. Only an authorized actor can observe or perform each escrow action.
9. Credential ciphertext is authenticated and bound to its escrow context.
10. Operational failures become visible through actionable logs, metrics, and reconciliation queries.

## Meaning of “production-ready” for this repository

For the simulated-money scope, production-ready means the invariants above are enforced and tested against real PostgreSQL concurrency; migrations and configuration are reproducible; secrets fail closed; failure recovery is exercised; and deployment has automated quality gates.

It does not mean the application is authorized to hold real customer money. Adding real funds would require payment-provider integration, compliance and legal review, fraud controls, reconciliation with an external source of truth, and a materially broader threat model.

## Legacy payment demo

PAYSTREAM is retained as a historical demo. It has one deliberate UI entry point, namespaced routes and APIs, and separate financial storage that cannot modify ClearHold balances. Shared code is limited to neutral identity, request infrastructure, and presentation utilities whose dependency direction is explicit. The implemented boundary is documented in [Legacy payment boundary](legacy-payment-boundary.md).

## Claims policy

No architectural or resume claim is complete because a library is present or a code path exists. A claim requires:

- an implemented mechanism;
- a stated failure model and limitation;
- tests that exercise its invariant;
- and measured evidence when the wording contains a number or performance assertion.
