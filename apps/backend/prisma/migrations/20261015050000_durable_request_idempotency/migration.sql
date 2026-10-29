CREATE TABLE "idempotency_records" (
  "id" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "responseBody" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_response_status_check" CHECK ("responseStatus" BETWEEN 200 AND 299)
);

CREATE UNIQUE INDEX "idempotency_records_principal_method_path_key"
  ON "idempotency_records"("principalId", "method", "path", "key");
CREATE INDEX "idempotency_records_created_at_idx" ON "idempotency_records"("createdAt");

-- Committed command results are historical financial evidence. They cannot
-- be edited or deleted by the application role after insertion.
CREATE OR REPLACE FUNCTION protect_idempotency_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'idempotency records are append only';
END;
$$;

CREATE TRIGGER "idempotency_records_append_only"
BEFORE UPDATE OR DELETE ON "idempotency_records"
FOR EACH ROW EXECUTE FUNCTION protect_idempotency_record();
