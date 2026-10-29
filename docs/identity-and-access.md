# Identity and access model

## Concepts

Authentication answers who presented the request. Authorization decides whether that principal may perform the requested operation. ClearHold treats these as separate checks.

`User.role` is retained temporarily for the legacy payment demo and contains `CLIENT` or `MERCHANT`. It is not a platform privilege. `User.platformRole` contains `USER` or `ADMIN` and controls access to escrow participant and operations APIs.

Buyer and seller are relationships on an escrow, not global account roles. A platform user may be a buyer in one escrow and a seller in another.

Automated jobs use `EscrowActorType.SYSTEM` with a null `actorId`. Human audit events use `EscrowActorType.USER` with a valid user foreign key. A database check constraint enforces those two valid combinations.

## Trust boundary

NextAuth issues a signed JWT session. The token contains role claims so the UI can choose navigation, but API authorization does not trust those claims. Every protected request extracts the authenticated user ID, reloads the principal from PostgreSQL, and evaluates the route policy against the database values.

This adds a database read to protected requests. The tradeoff makes privilege changes and account revocation effective on the next authorization check instead of waiting for JWT expiry. Dispute resolution also rechecks and locks the administrator row inside the financial transaction, preventing a concurrent demotion from racing a privileged settlement.

Client-side route guards improve navigation only. They are not security controls. Every sensitive API independently enforces its policy.

## Policy matrix

| Capability | Platform role | Relationship or legacy condition |
| --- | --- | --- |
| List/create escrows | `USER` | Current user; creates as buyer |
| Read escrow details | `USER` or `ADMIN` | Participant, unless administrator |
| Submit credentials | `USER` | Seller on that escrow |
| View credentials | `USER` | Buyer on that escrow |
| Confirm or dispute | `USER` | Required participant relationship |
| View/resolve disputes | `ADMIN` | No participant relationship required |
| Send legacy payment | `USER` | Legacy role must be `CLIENT` |

Unauthenticated requests receive 401. Authenticated principals that fail policy receive 403. Resource relationship checks remain inside the transaction or query that loads the resource.

## Account creation

Public registration uses a strict request schema. It can select only the legacy `CLIENT` or `MERCHANT` category; an unexpected `platformRole` field rejects the request. Every public account is persisted with `platformRole = USER`. Administrator creation is an operational action represented only by the local seed at this stage.

Credentials authentication normalizes email addresses, uses a dummy bcrypt hash when an account is absent to reduce timing differences, and applies per-IP and per-account attempt limits. A functional PostgreSQL unique index prevents accounts that differ only by email casing. The current limiter is process-local and therefore remains production debt.

Google authentication is enabled only when server credentials are configured, and the UI exposes it only when `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Adapter-created users receive wallets through the NextAuth `createUser` event.

## Security properties and limits

- A normal user cannot call administrator list or resolution APIs.
- Public input cannot grant administrator privilege.
- A stale elevated JWT cannot override a demotion stored in PostgreSQL.
- Administrators are kept out of participant and wallet mutation APIs.
- PostgreSQL idempotency records are scoped to principal, HTTP method, and route URL. A retry with the same key and body replays the committed response; changed bodies conflict. See [Durable request idempotency](durable-idempotency.md).
- The database preserves human audit attribution and represents system activity without fake users.

This phase does not provide multi-factor authentication, administrator provisioning workflows, durable distributed rate limiting, session revocation lists, database integration tests, or complete CSRF analysis. Those controls must be added or explicitly scoped before a real-money deployment.
