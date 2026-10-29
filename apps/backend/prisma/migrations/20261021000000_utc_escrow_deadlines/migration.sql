-- Existing escrow deadlines are Prisma UTC DateTime values stored in
-- timestamp-without-time-zone columns. Compare them with a UTC wall clock,
-- independently of the PostgreSQL session's TimeZone setting.
ALTER TABLE "escrow_transactions"
  ALTER COLUMN "createdAt" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');

CREATE OR REPLACE FUNCTION enforce_escrow_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
  utc_now timestamp := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'AWAITING_CREDENTIALS' OR NEW."version" <> 0 THEN
      RAISE EXCEPTION 'new escrow must start in AWAITING_CREDENTIALS at version zero';
    END IF;
    IF NEW."verificationDeadline" IS NOT NULL OR NEW."encryptedCredentials" IS NOT NULL
       OR NEW."wrappedCredentialKey" IS NOT NULL THEN
      RAISE EXCEPTION 'new escrow cannot contain submitted credentials';
    END IF;
  ELSIF NEW."status" <> OLD."status" THEN
    allowed :=
      (OLD."status" = 'AWAITING_CREDENTIALS' AND NEW."status" IN ('VERIFICATION_WINDOW', 'DISPUTED', 'REFUNDED')) OR
      (OLD."status" = 'VERIFICATION_WINDOW' AND NEW."status" IN ('RELEASED', 'AUTO_RELEASED', 'DISPUTED')) OR
      (OLD."status" = 'DISPUTED' AND NEW."status" IN ('RELEASED', 'REFUNDED', 'PARTIAL_REFUND'));

    IF NOT allowed THEN
      RAISE EXCEPTION 'invalid escrow transition from % to %', OLD."status", NEW."status";
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION 'escrow status transition must increment version exactly once';
    END IF;

    IF OLD."status" = 'AWAITING_CREDENTIALS' AND NEW."status" = 'REFUNDED'
       AND utc_now < OLD."submissionDeadline" THEN
      RAISE EXCEPTION 'credential submission deadline has not elapsed';
    END IF;
    IF OLD."status" = 'VERIFICATION_WINDOW' AND NEW."status" = 'AUTO_RELEASED'
       AND (OLD."verificationDeadline" IS NULL OR utc_now < OLD."verificationDeadline") THEN
      RAISE EXCEPTION 'verification deadline has not elapsed';
    END IF;
  ELSIF NEW."version" <> OLD."version" THEN
    RAISE EXCEPTION 'escrow version may change only with a status transition';
  END IF;

  IF NEW."status" = 'VERIFICATION_WINDOW' AND (
    NEW."verificationDeadline" IS NULL OR
    NEW."verificationDeadline" <= utc_now OR
    NEW."encryptedCredentials" IS NULL OR
    NEW."wrappedCredentialKey" IS NULL
  ) THEN
    RAISE EXCEPTION 'verification window requires encrypted credentials, wrapped key, and deadline';
  END IF;

  IF NEW."status" IN ('RELEASED', 'AUTO_RELEASED', 'REFUNDED', 'PARTIAL_REFUND')
     AND NEW."wrappedCredentialKey" IS NOT NULL THEN
    RAISE EXCEPTION 'terminal escrow must not retain a wrapped credential key';
  END IF;

  RETURN NEW;
END;
$$;
