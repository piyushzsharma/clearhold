-- This script requires the pg_cron extension to be enabled in your PostgreSQL database.
-- Run this on your production database to ensure escrows never get stuck if the Node.js process fails.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a sweeping function to automatically release funds for expired verification windows
CREATE OR REPLACE FUNCTION sweep_expired_escrows()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    expired_escrow RECORD;
    v_platform_fee_percent numeric := 0.05;
    v_fee_cents bigint;
    v_seller_cents bigint;
BEGIN
    FOR expired_escrow IN 
        SELECT id, "buyerId", "sellerId", "priceCents" 
        FROM escrow_transactions 
        WHERE status = 'VERIFICATION_WINDOW' 
          AND "verificationDeadline" < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Calculate fees
        v_fee_cents := FLOOR(expired_escrow."priceCents" * v_platform_fee_percent);
        v_seller_cents := expired_escrow."priceCents" - v_fee_cents;

        -- 1. DEBIT buyer's HELD balance
        INSERT INTO ledger_entries ("escrowId", "accountId", "entryType", "amountCents", "balanceBucket", "reason", "idempotencyKey", "createdAt")
        VALUES (expired_escrow.id, expired_escrow."buyerId", 'DEBIT', expired_escrow."priceCents", 'HELD', 'CRON_AUTO_RELEASE_DEBIT', 'cron_sweep_debit_' || expired_escrow.id, NOW());

        -- 2. CREDIT seller's AVAILABLE balance
        INSERT INTO ledger_entries ("escrowId", "accountId", "entryType", "amountCents", "balanceBucket", "reason", "idempotencyKey", "createdAt")
        VALUES (expired_escrow.id, expired_escrow."sellerId", 'CREDIT', v_seller_cents, 'AVAILABLE', 'CRON_AUTO_RELEASE_CREDIT', 'cron_sweep_credit_' || expired_escrow.id, NOW());

        -- 3. Update the Escrow Transaction status and shred credentials
        UPDATE escrow_transactions
        SET status = 'AUTO_RELEASED',
            "wrappedCredentialKey" = NULL
        WHERE id = expired_escrow.id;

        -- 4. Create an audit log
        INSERT INTO escrow_events ("escrowId", "type", "actorId", "metadata", "createdAt")
        VALUES (expired_escrow.id, 'AutoReleased', 'SYSTEM', '{"source": "pg_cron"}', NOW());
    END LOOP;
END;
$$;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule('sweep_expired_escrows_job', '*/5 * * * *', 'SELECT sweep_expired_escrows()');
