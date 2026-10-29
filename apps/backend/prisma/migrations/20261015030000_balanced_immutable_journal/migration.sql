-- Replace free-standing ledger rows with balanced, posted journal transactions.
CREATE TYPE "LedgerAccountKind" AS ENUM (
  'USER_AVAILABLE', 'USER_HELD', 'PLATFORM_FEE', 'SYSTEM_ISSUANCE', 'SYSTEM_MIGRATION'
);
CREATE TYPE "JournalKind" AS ENUM (
  'INITIAL_FUNDING', 'ESCROW_RESERVE', 'ESCROW_RELEASE', 'ESCROW_REFUND',
  'ESCROW_PARTIAL_REFUND', 'MIGRATION'
);
CREATE TYPE "JournalStatus" AS ENUM ('PENDING', 'POSTED');

ALTER TABLE "ledger_entries" RENAME TO "legacy_ledger_entries";
ALTER TABLE "legacy_ledger_entries"
  RENAME CONSTRAINT "ledger_entries_pkey" TO "legacy_ledger_entries_pkey";

CREATE TABLE "ledger_accounts" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "ownerId" TEXT,
  "kind" "LedgerAccountKind" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "balanceCents" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_accounts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ledger_accounts_owner_check" CHECK (
    (("kind" IN ('USER_AVAILABLE', 'USER_HELD')) AND "ownerId" IS NOT NULL)
    OR
    (("kind" IN ('PLATFORM_FEE', 'SYSTEM_ISSUANCE', 'SYSTEM_MIGRATION')) AND "ownerId" IS NULL)
  ),
  CONSTRAINT "ledger_accounts_user_balance_check" CHECK (
    "kind" NOT IN ('USER_AVAILABLE', 'USER_HELD') OR "balanceCents" >= 0
  )
);

CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");
CREATE UNIQUE INDEX "ledger_accounts_ownerId_kind_currency_key"
  ON "ledger_accounts"("ownerId", "kind", "currency");
CREATE UNIQUE INDEX "ledger_accounts_system_kind_currency_key"
  ON "ledger_accounts"("kind", "currency") WHERE "ownerId" IS NULL;

ALTER TABLE "ledger_accounts"
  ADD CONSTRAINT "ledger_accounts_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "journal_transactions" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "kind" "JournalKind" NOT NULL,
  "status" "JournalStatus" NOT NULL DEFAULT 'PENDING',
  "escrowId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  CONSTRAINT "journal_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journal_transactions_idempotencyKey_key"
  ON "journal_transactions"("idempotencyKey");
CREATE INDEX "journal_transactions_escrowId_createdAt_idx"
  ON "journal_transactions"("escrowId", "createdAt");

ALTER TABLE "journal_transactions"
  ADD CONSTRAINT "journal_transactions_escrowId_fkey"
  FOREIGN KEY ("escrowId") REFERENCES "escrow_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "journalTransactionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "entryType" "EntryType" NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_positive_amount_check" CHECK ("amountCents" > 0)
);

CREATE INDEX "ledger_entries_accountId_createdAt_idx"
  ON "ledger_entries"("accountId", "createdAt");
CREATE INDEX "ledger_entries_journalTransactionId_idx"
  ON "ledger_entries"("journalTransactionId");

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_journalTransactionId_fkey"
  FOREIGN KEY ("journalTransactionId") REFERENCES "journal_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stable system accounts provide the other side of issuance, fee and migration entries.
INSERT INTO "ledger_accounts" ("id", "code", "ownerId", "kind", "currency", "balanceCents") VALUES
  ('system_issuance_usd', 'system:issuance:USD', NULL, 'SYSTEM_ISSUANCE', 'USD', 0),
  ('system_migration_usd', 'system:migration:USD', NULL, 'SYSTEM_MIGRATION', 'USD', 0),
  ('platform_fee_usd', 'platform:fee:USD', NULL, 'PLATFORM_FEE', 'USD', 0);

-- Preserve every existing user balance exactly. Negative user balances fail this
-- migration through the account CHECK instead of silently entering the new journal.
INSERT INTO "ledger_accounts" ("id", "code", "ownerId", "kind", "currency", "balanceCents")
SELECT
  'la_' || md5(u."id" || ':AVAILABLE'),
  'user:' || u."id" || ':available:USD',
  u."id",
  'USER_AVAILABLE',
  'USD',
  COALESCE(SUM(CASE WHEN le."entryType" = 'CREDIT' THEN le."amountCents" ELSE -le."amountCents" END), 0)
FROM "users" u
LEFT JOIN "legacy_ledger_entries" le
  ON le."accountId" = u."id" AND le."balanceBucket" = 'AVAILABLE'
GROUP BY u."id";

INSERT INTO "ledger_accounts" ("id", "code", "ownerId", "kind", "currency", "balanceCents")
SELECT
  'la_' || md5(u."id" || ':HELD'),
  'user:' || u."id" || ':held:USD',
  u."id",
  'USER_HELD',
  'USD',
  COALESCE(SUM(CASE WHEN le."entryType" = 'CREDIT' THEN le."amountCents" ELSE -le."amountCents" END), 0)
FROM "users" u
LEFT JOIN "legacy_ledger_entries" le
  ON le."accountId" = u."id" AND le."balanceBucket" = 'HELD'
GROUP BY u."id";

-- Each old row is wrapped in its own balanced migration journal. This retains
-- user balances and audit timestamps without pretending old rows formed valid batches.
INSERT INTO "journal_transactions" (
  "id", "idempotencyKey", "kind", "status", "escrowId", "createdAt", "postedAt"
)
SELECT
  'jt_' || md5(le."id"),
  CASE
    WHEN le."reason" = 'DEMO_INITIAL_FUNDING' THEN 'demo-initial-funding:' || le."accountId"
    WHEN le."reason" = 'INITIAL_FUNDING' THEN 'initial-funding:' || le."accountId"
    ELSE 'migration:' || le."idempotencyKey"
  END,
  CASE
    WHEN le."reason" IN ('DEMO_INITIAL_FUNDING', 'INITIAL_FUNDING') THEN 'INITIAL_FUNDING'::"JournalKind"
    ELSE 'MIGRATION'::"JournalKind"
  END,
  'POSTED',
  le."escrowId",
  le."createdAt",
  le."createdAt"
FROM "legacy_ledger_entries" le;

INSERT INTO "ledger_entries" (
  "id", "journalTransactionId", "accountId", "entryType", "amountCents", "createdAt"
)
SELECT
  'le_' || md5(le."id" || ':original'),
  'jt_' || md5(le."id"),
  'la_' || md5(le."accountId" || ':' || le."balanceBucket"::text),
  le."entryType",
  le."amountCents",
  le."createdAt"
FROM "legacy_ledger_entries" le;

INSERT INTO "ledger_entries" (
  "id", "journalTransactionId", "accountId", "entryType", "amountCents", "createdAt"
)
SELECT
  'le_' || md5(le."id" || ':offset'),
  'jt_' || md5(le."id"),
  CASE
    WHEN le."reason" IN ('DEMO_INITIAL_FUNDING', 'INITIAL_FUNDING') THEN 'system_issuance_usd'
    ELSE 'system_migration_usd'
  END,
  CASE WHEN le."entryType" = 'CREDIT' THEN 'DEBIT'::"EntryType" ELSE 'CREDIT'::"EntryType" END,
  le."amountCents",
  le."createdAt"
FROM "legacy_ledger_entries" le;

UPDATE "ledger_accounts"
SET "balanceCents" = (
  SELECT COALESCE(SUM(CASE WHEN le."entryType" = 'CREDIT' THEN le."amountCents" ELSE -le."amountCents" END), 0)
  FROM "ledger_entries" le
  WHERE le."accountId" = 'system_migration_usd'
)
WHERE "id" = 'system_migration_usd';

UPDATE "ledger_accounts"
SET "balanceCents" = (
  SELECT COALESCE(SUM(CASE WHEN le."entryType" = 'CREDIT' THEN le."amountCents" ELSE -le."amountCents" END), 0)
  FROM "ledger_entries" le
  WHERE le."accountId" = 'system_issuance_usd'
)
WHERE "id" = 'system_issuance_usd';

DROP TABLE "legacy_ledger_entries";
DROP TABLE "wallets";

-- Entries are insert-only and can be added only while their journal is pending.
CREATE OR REPLACE FUNCTION protect_ledger_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "JournalStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'ledger entries are immutable';
  END IF;

  SELECT "status" INTO parent_status
  FROM "journal_transactions"
  WHERE "id" = NEW."journalTransactionId";

  IF parent_status IS DISTINCT FROM 'PENDING'::"JournalStatus" THEN
    RAISE EXCEPTION 'entries may be added only to a pending journal transaction';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_entries_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION protect_ledger_entry();

-- Posting is the sole allowed journal mutation and requires a balanced,
-- single-currency transaction with at least two positive entries.
CREATE OR REPLACE FUNCTION validate_journal_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_count integer;
DECLARE debit_total bigint;
DECLARE credit_total bigint;
DECLARE currency_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PENDING' OR NEW."postedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'new journal transactions must be pending';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'journal transactions are immutable';
  END IF;

  IF OLD."status" <> 'PENDING' OR NEW."status" <> 'POSTED'
     OR OLD."id" <> NEW."id"
     OR OLD."idempotencyKey" <> NEW."idempotencyKey"
     OR OLD."kind" <> NEW."kind"
     OR OLD."escrowId" IS DISTINCT FROM NEW."escrowId"
     OR OLD."createdAt" <> NEW."createdAt"
     OR NEW."postedAt" IS NULL THEN
    RAISE EXCEPTION 'only the pending-to-posted journal transition is allowed';
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM("amountCents") FILTER (WHERE "entryType" = 'DEBIT'), 0),
    COALESCE(SUM("amountCents") FILTER (WHERE "entryType" = 'CREDIT'), 0),
    COUNT(DISTINCT a."currency")
  INTO entry_count, debit_total, credit_total, currency_count
  FROM "ledger_entries" e
  JOIN "ledger_accounts" a ON a."id" = e."accountId"
  WHERE e."journalTransactionId" = NEW."id";

  IF entry_count < 2 OR debit_total <> credit_total OR debit_total <= 0 OR currency_count <> 1 THEN
    RAISE EXCEPTION 'journal transaction must contain balanced, positive, single-currency entries';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "journal_transactions_controlled_transition"
BEFORE INSERT OR UPDATE OR DELETE ON "journal_transactions"
FOR EACH ROW EXECUTE FUNCTION validate_journal_transition();

-- Update the balance projection as part of the same database transaction.
-- Sorted account updates give concurrent postings a consistent lock order.
CREATE OR REPLACE FUNCTION apply_posted_journal()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE movement RECORD;
BEGIN
  IF OLD."status" = 'PENDING' AND NEW."status" = 'POSTED' THEN
    FOR movement IN
      SELECT
        "accountId",
        SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amountCents" ELSE -"amountCents" END) AS delta
      FROM "ledger_entries"
      WHERE "journalTransactionId" = NEW."id"
      GROUP BY "accountId"
      ORDER BY "accountId"
    LOOP
      UPDATE "ledger_accounts"
      SET "balanceCents" = "balanceCents" + movement.delta
      WHERE "id" = movement."accountId";
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "journal_transactions_apply_balances"
AFTER UPDATE ON "journal_transactions"
FOR EACH ROW EXECUTE FUNCTION apply_posted_journal();

-- Identity fields and projected balances cannot be changed directly. Nested
-- updates from the posting trigger are the only permitted balance mutation.
CREATE OR REPLACE FUNCTION protect_ledger_account()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger accounts cannot be deleted';
  END IF;
  IF OLD."id" <> NEW."id" OR OLD."code" <> NEW."code"
     OR OLD."ownerId" IS DISTINCT FROM NEW."ownerId"
     OR OLD."kind" <> NEW."kind" OR OLD."currency" <> NEW."currency"
     OR OLD."createdAt" <> NEW."createdAt" OR pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'ledger accounts are immutable outside journal posting';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_accounts_protect"
BEFORE UPDATE OR DELETE ON "ledger_accounts"
FOR EACH ROW EXECUTE FUNCTION protect_ledger_account();

-- A pending journal may exist only inside the database transaction constructing it.
CREATE OR REPLACE FUNCTION ensure_journal_posted_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status "JournalStatus";
BEGIN
  SELECT "status" INTO current_status FROM "journal_transactions" WHERE "id" = NEW."id";
  IF current_status = 'PENDING' THEN
    RAISE EXCEPTION 'pending journal transaction cannot be committed';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "journal_transactions_must_post"
AFTER INSERT OR UPDATE ON "journal_transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_journal_posted_at_commit();

