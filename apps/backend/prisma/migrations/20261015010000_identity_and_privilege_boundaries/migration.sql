-- Separate legacy payment categories from platform-wide privilege.
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "users"
ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

-- PostgreSQL's ordinary text uniqueness is case-sensitive. Authentication is not.
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users" (LOWER("email"));

-- Automated workflows are principals, but they are not fake user rows.
CREATE TYPE "EscrowActorType" AS ENUM ('USER', 'SYSTEM');

ALTER TABLE "escrow_events"
DROP CONSTRAINT "escrow_events_actorId_fkey";

ALTER TABLE "escrow_events"
ADD COLUMN "actorType" "EscrowActorType" NOT NULL DEFAULT 'USER',
ALTER COLUMN "actorId" DROP NOT NULL;

ALTER TABLE "escrow_events"
ADD CONSTRAINT "escrow_events_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "escrow_events"
ADD CONSTRAINT "escrow_events_actor_identity_check"
CHECK (
  ("actorType" = 'SYSTEM' AND "actorId" IS NULL)
  OR
  ("actorType" = 'USER' AND "actorId" IS NOT NULL)
);
