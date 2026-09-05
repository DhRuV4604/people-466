-- One identity per person.
--
-- Employee.userId becomes required, so before the constraint goes on, every
-- employee without an account gets one and every account without an employee
-- gets a record. Nothing is deleted: this runs on databases that already hold
-- payroll history.

-- New columns first, so the accounts created below can carry them.
ALTER TABLE "User" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------- Backfill 1
-- An account for every employee that lacks one, keyed on their work email.
--
-- The password hash is a bcrypt digest of a value nobody holds, so these
-- accounts cannot be signed into until an admin reissues an invite. That is
-- deliberate: inventing a usable password for an existing employee would be
-- handing out access nobody asked for.
INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "active", "mustChangePassword", "createdAt", "updatedAt")
SELECT
  'usr_' || substr(md5(random()::text || e."id"), 1, 21),
  e."workEmail",
  e."firstName" || ' ' || e."lastName",
  '$2a$10$uninvitedaccountnopasswordissuedyetxxxxxxxxxxxxxxxxxxxxxx',
  'EMPLOYEE',
  -- Not active: nobody should gain a way in as a side effect of a migration.
  false,
  true,
  NOW(),
  NOW()
FROM "Employee" e
WHERE e."userId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."email" = e."workEmail");

UPDATE "Employee" e
SET "userId" = u."id"
FROM "User" u
WHERE e."userId" IS NULL AND u."email" = e."workEmail";

-- ---------------------------------------------------------------- Backfill 2
-- An employee record for every account that lacks one, so an admin is an
-- employee like everyone else. Department, position and schedule are left
-- unset: they are nullable, and guessing them would be worse than leaving an
-- obvious gap for HR to fill.
INSERT INTO "Employee" (
  "id", "userId", "employeeCode", "firstName", "lastName", "workEmail",
  "employeeType", "status", "hireDate", "createdAt", "updatedAt"
)
SELECT
  'emp_' || substr(md5(random()::text || u."id"), 1, 21),
  u."id",
  -- Continues the existing EMP#### sequence rather than restarting it.
  'EMP' || lpad(
    (
      COALESCE((SELECT MAX(NULLIF(regexp_replace(e2."employeeCode", '\D', '', 'g'), '')::int) FROM "Employee" e2), 0)
      + ROW_NUMBER() OVER (ORDER BY u."createdAt")
    )::text, 4, '0'),
  split_part(u."name", ' ', 1),
  NULLIF(substr(u."name", strpos(u."name", ' ') + 1), u."name"),
  u."email",
  'FULL_TIME',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."userId" = u."id");

-- A single-word name leaves the surname null above; the column is required.
UPDATE "Employee" SET "lastName" = '' WHERE "lastName" IS NULL;

-- ---------------------------------------------------------------- Constraint
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_userId_fkey";

ALTER TABLE "Employee" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
