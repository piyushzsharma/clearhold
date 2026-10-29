-- Phase 9 will replace this prototype scheduler with a reconciled job design.
-- Until then, this fallback posts through the same protected journal tables.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION sweep_expired_escrows()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  expired_escrow RECORD;
  journal_id text;
  buyer_held_id text;
  seller_available_id text;
  platform_fee_id text;
  fee_cents bigint;
  seller_cents bigint;
BEGIN
  FOR expired_escrow IN
    SELECT id, "buyerId", "sellerId", "priceCents"
    FROM "escrow_transactions"
    WHERE "status" = 'VERIFICATION_WINDOW'
      AND "verificationDeadline" < (clock_timestamp() AT TIME ZONE 'UTC')
    FOR UPDATE SKIP LOCKED
  LOOP
    fee_cents := expired_escrow."priceCents" * 500 / 10000;
    seller_cents := expired_escrow."priceCents" - fee_cents;
    journal_id := 'cron_' || md5(expired_escrow.id || ':auto-release');

    SELECT "id" INTO buyer_held_id FROM "ledger_accounts"
      WHERE "code" = 'user:' || expired_escrow."buyerId" || ':held:USD';
    SELECT "id" INTO seller_available_id FROM "ledger_accounts"
      WHERE "code" = 'user:' || expired_escrow."sellerId" || ':available:USD';
    SELECT "id" INTO platform_fee_id FROM "ledger_accounts"
      WHERE "code" = 'platform:fee:USD';

    IF buyer_held_id IS NULL OR seller_available_id IS NULL OR platform_fee_id IS NULL THEN
      RAISE EXCEPTION 'required ledger account missing for escrow %', expired_escrow.id;
    END IF;

    INSERT INTO "journal_transactions" (
      "id", "idempotencyKey", "kind", "status", "escrowId", "createdAt"
    ) VALUES (
      journal_id, 'pg-cron:auto-release:' || expired_escrow.id,
      'ESCROW_RELEASE', 'PENDING', expired_escrow.id, NOW()
    );

    INSERT INTO "ledger_entries" (
      "id", "journalTransactionId", "accountId", "entryType", "amountCents", "createdAt"
    ) VALUES
      ('cron_le_' || md5(expired_escrow.id || ':held'), journal_id, buyer_held_id, 'DEBIT', expired_escrow."priceCents", NOW()),
      ('cron_le_' || md5(expired_escrow.id || ':seller'), journal_id, seller_available_id, 'CREDIT', seller_cents, NOW());

    IF fee_cents > 0 THEN
      INSERT INTO "ledger_entries" (
        "id", "journalTransactionId", "accountId", "entryType", "amountCents", "createdAt"
      ) VALUES (
        'cron_le_' || md5(expired_escrow.id || ':fee'), journal_id, platform_fee_id, 'CREDIT', fee_cents, NOW()
      );
    END IF;

    UPDATE "journal_transactions"
    SET "status" = 'POSTED', "postedAt" = NOW()
    WHERE "id" = journal_id;

    UPDATE "escrow_transactions"
    SET "status" = 'AUTO_RELEASED', "wrappedCredentialKey" = NULL,
        "version" = "version" + 1
    WHERE "id" = expired_escrow.id;

    INSERT INTO "escrow_events" (
      "id", "escrowId", "type", "actorType", "actorId", "metadata", "createdAt"
    ) VALUES (
      'cron_event_' || md5(expired_escrow.id || ':auto-release'),
      expired_escrow.id, 'AutoReleased', 'SYSTEM', NULL,
      jsonb_build_object(
        'source', 'pg_cron',
        'transition', 'AUTO_RELEASE',
        'fromStatus', 'VERIFICATION_WINDOW',
        'toStatus', 'AUTO_RELEASED'
      ), NOW()
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'sweep_expired_escrows_job',
  '*/5 * * * *',
  'SELECT sweep_expired_escrows()'
);
