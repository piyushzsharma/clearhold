# Legacy payment boundary

PAYSTREAM is retained as a historical demo, not as part of the ClearHold escrow domain.

## Boundary

- UI: `/legacy`, `/legacy/transfer`, `/legacy/history`, and `/legacy/merchant`.
- API: `/api/legacy/wallet` and `/api/legacy/transfers`.
- Storage: `legacy_wallets` and the legacy `transactions` receipt table.
- Shared code: authenticated `User` identity, session handling, rate limiting, and generic UI primitives.

The ClearHold dashboard has one deliberate PAYSTREAM entry in its account menu. Old `/dashboard` and `/merchant` bookmarks redirect to the namespaced routes.

Legacy transfers debit and credit `legacy_wallets` atomically. They cannot read or write `ledger_entries`, so a PAYSTREAM transfer cannot change escrow available or held balances. The migration backfills legacy balances from old transaction-linked entries, removes those entries from the escrow ledger, and drops the cross-domain `transactionId` link.

## Deliberate limitations

PAYSTREAM uses a mutable balance rather than the journal design planned for ClearHold. It remains useful as a demo but does not support claims about immutable accounting. Identity is shared so one login can intentionally enter the demo; its role field remains a legacy categorization and is not an escrow privilege.

## Interview defense

This is a bounded-context decision: identity is common infrastructure, while money movement and persistence belong to separate domains. Namespacing makes the boundary visible, and separate tables plus a regression test enforce it. A fully separate service or database would improve operational isolation but would add deployment and consistency cost without strengthening the escrow project’s core story.

