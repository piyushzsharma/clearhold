-- PAYSTREAM keeps a mutable demo balance that is physically separate from
-- ClearHold's escrow journal. Existing legacy transfer effects are preserved
-- while they are removed from the escrow ledger.
CREATE TABLE "legacy_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "legacy_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legacy_wallets_userId_key" ON "legacy_wallets"("userId");

ALTER TABLE "legacy_wallets"
ADD CONSTRAINT "legacy_wallets_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "legacy_wallets" ("id", "userId", "balanceCents", "createdAt", "updatedAt")
SELECT
    'legacy_' || md5(u."id"),
    u."id",
    COALESCE(SUM(
      CASE
        WHEN le."entryType" = 'CREDIT' THEN le."amountCents"
        ELSE -le."amountCents"
      END
    ) FILTER (WHERE le."transactionId" IS NOT NULL), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u
LEFT JOIN "ledger_entries" le ON le."accountId" = u."id"
GROUP BY u."id";

DELETE FROM "ledger_entries" WHERE "transactionId" IS NOT NULL;

ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_transactionId_fkey";
ALTER TABLE "ledger_entries" DROP COLUMN "transactionId";

