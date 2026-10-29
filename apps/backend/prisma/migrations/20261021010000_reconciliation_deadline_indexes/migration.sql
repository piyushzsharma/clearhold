CREATE INDEX "escrow_transactions_awaiting_deadline_idx"
  ON "escrow_transactions"("submissionDeadline")
  WHERE "status" = 'AWAITING_CREDENTIALS';

CREATE INDEX "escrow_transactions_verification_deadline_idx"
  ON "escrow_transactions"("verificationDeadline")
  WHERE "status" = 'VERIFICATION_WINDOW';
