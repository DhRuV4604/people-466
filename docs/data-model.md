# Data model

PostgreSQL 16 through Prisma 6. The schema is
[`api/prisma/schema.prisma`](../api/prisma/schema.prisma); this explains the shape it
describes and the rules the services enforce on top of it.

## The shape

```
                      ┌──────────────┐
                      │     User     │  sign-in + role
                      └──────┬───────┘
                             │ 1..1
                      ┌──────▼───────┐
      Department ────►│   Employee   │◄──── JobPosition
                      └──────┬───────┘
                             │        └───► manager → Employee (self)
        ┌────────────┬───────┼────────────┬──────────┬──────────┐
        ▼            ▼       ▼            ▼          ▼          ▼
    Contract    Attendance  LeaveAllocation  LeaveRequest  Payslip  Document
        │                          ▲             │                     │
        │                          └─────────────┘  approving links them│
        ▼                                                              ▼
  SalaryStructure ──► SalaryRule          Payrun ──► Payslip ──► PayslipLine
  WorkingSchedule ──► WorkingScheduleLine            EmailLog

  StoredFile ──► the bytes behind a document, its signed copy,
                 an employee's avatar, and the company logo
```

**The employee record is the hub.** Everything daily hangs off it, and payroll reads through it.

- A `User` is a sign-in with a role, and it always has exactly one `Employee`. One person is one
  record and one account, never one without the other: creating an employee creates the account
  in the same transaction, and an admin is an employee like everyone else. There is nothing to
  link, so nothing can drift out of sync.
- `mustChangePassword` marks an account still on a password the system issued. `invitedAt`
  records when the invite carrying it actually went out; it stays null when the send failed, so
  "was this person ever asked to sign in" has an honest answer.
- An `Employee` may manage other employees — `manager` is a self-relation.
- Deleting an employee cascades to attendance, allocations, requests and contracts, and takes
  the account with it. Payslips do not cascade, which is why the API deactivates both instead of
  deleting once payroll history exists.

## One row for the organisation

`AppSettings` is pinned to a single id. It holds the attendance policy and who
the company is — name, address, contact details, tax id and a logo — because
both are the same kind of thing: one answer per install, read from everywhere.
Every read goes through a service that falls back to documented defaults, so an
install that has never opened the settings screen still prints a company name
on a payslip instead of a blank header.

## Ids, money and time

| Concern | Choice | Why |
|---|---|---|
| Primary keys | `uuid(7)` | UUIDv7: globally unique but **time-sortable**, unlike UUIDv4, so index locality stays good. Validated by `IsEntityId`, **not** `IsUUID` — see [architecture.md](architecture.md#ids). |
| Money | `Decimal(12,2)` | A float cannot represent a rupee exactly. Totals reconcile to the cent. |
| Hours | `Decimal(8,2)` | Same reason; half-days and breaks are fractional. |
| Timestamps | `DateTime` | Stored as instants. Date-only columns are read in UTC so server and client agree. |

Prisma surfaces `Decimal`, which is normalised to a plain number at the API boundary by
`common/decimal.ts`, so a JSON consumer never has to know.

## Contracts are period-scoped

An employee holds many contracts over time. Payroll does not take "the employee's contract" — it
resolves the single `RUNNING` contract whose `dateStart`/`dateEnd` range overlaps the payroll
period. Expired contracts are never used, which is what makes a mid-year raise or a role change
compute correctly for each period rather than retroactively.

Creating a `RUNNING` contract that overlaps another for the same employee is rejected at save
time, because two applicable contracts would make the resolution ambiguous.

A contract carries its own `jobPosition`, `workingSchedule` and `salaryStructure`, each of which
**overrides** the employee's when payroll runs. That is how someone can move to a four-day week
for one contract period without editing their employee record.

## Hours are derived, never stored from a client

`WorkingSchedule.hoursPerWeek` is a stored column, but it is always computed from the
`WorkingScheduleLine` rows — the `{ dayOfWeek, startTime, endTime, breakHours }` weekly pattern —
by a pure function in `shared/src/domain.ts`. The API recomputes it on every write and
ignores any value a client sends.

Overnight shifts roll over correctly: a line running 22:00 → 06:00 is eight hours, not minus
sixteen.

Period working days come from the schedule too, not from a flat 30-day assumption, so a day rate
means what it says.

## Attendance is derived from punches

An `Attendance` row stores `checkIn` and optionally `checkOut`. Everything else —
`workedHours`, `overtimeHours` and `status` — is derived from those two against that weekday's
schedule line. Late arrival, half day and missing check-out are detected rather than entered.

A correction may override `status` explicitly. Doing so sets `manuallyEdited` and records
`editedById`, `editedAt` and `editReason`, so a changed record always says who changed it and
why.

## Leave balance is derived, never stored

There is no balance column. For a given employee and type:

```
allocated  = Σ approved allocations valid on the date
taken      = Σ approved requests
pending    = Σ requests awaiting approval
remaining  = allocated − taken
```

Approving a request links it to a specific `LeaveAllocation`, so consumption is auditable rather
than implied by arithmetic.

A request is refused when it overlaps existing leave, exceeds the remaining balance, or breaches
the type's `maxDaysPerRequest`. Duration counts only days the employee was scheduled to work, so
a Friday-to-Monday absence is two days for a Monday-to-Friday schedule.

A `TimeOffType` decides the policy: its `unit` (`DAY` or `HOUR`), whether it
`requiresAllocation`, whether it `requiresApproval`, and whether it is `paid`. Unpaid leave needs
no allocation, which is why its remaining figure is not a limit.

## The payroll engine

`api/src/modules/payroll/payroll-engine.service.ts`.

A `SalaryStructure` holds an ordered set of `SalaryRule`s. Computing a payslip walks them in
ascending `sequence`, and **each result enters scope under its own code**, so a later rule can
build on an earlier subtotal:

```
BASIC     fixed / from the contract wage
HRA       percentage of BASIC
GROSS     formula: BASIC + HRA + …
PF        percentage of BASIC
TDS       formula, conditional
NET       formula: GROSS - PF - PT - TDS - ULD
```

`NET` is literally that expression, not a hardcoded sum. Change the rules and the arithmetic
changes with them.

A rule computes one of three ways:

| `computeType` | Uses |
|---|---|
| `FIXED` | `amountFixed` |
| `PERCENTAGE` | `amountPercentage` of `percentageBase` (another rule's code) |
| `FORMULA` | `formula`, evaluated against the codes already in scope |

An optional `condition` skips the rule entirely when it evaluates false. Formulas are validated
before being stored, and evaluate in a restricted scope: dangerous identifiers are rejected
before evaluation and globals are shadowed, so a formula cannot reach the host environment.

`category` decides the sign — `DEDUCTION` and `CONTRIBUTION` reduce net pay, everything else
adds — and whether a line appears on the printed payslip.

### The pay run lifecycle

```
DRAFT ──compute──► COMPUTED ──validate──► VALIDATED ──mark paid──► PAID
                                 ▲
                        blocked while warnings stand
```

Creating a run needs the period, the structure and an explicit list of employees. Eligibility is
a separate read (`GET /payruns/eligible-employees`) that returns everyone in scope with a reason
when they cannot be paid — no applicable contract, say — so the person building the run sees why
before committing to it.

Warnings are surfaced before validation and **block** it:

- a duplicate payslip covering the same period for the same employee
- missing bank details
- no applicable contract for the period
- negative net pay

`send-payslips` generates each PDF and records every attempt in `EmailLog` with its status and,
on failure, the error. With no `SMTP_HOST` configured it records the attempt instead of dialling
out, so the flow is demonstrable without credentials.

## A payslip belongs to the month its period ends in

Payroll periods straddle month boundaries as a matter of course — a run from 31 July to 31 August
is ordinary — so "which month is this payslip in" has to be decided rather than assumed. Both
obvious answers are wrong:

| Test | What goes wrong |
|---|---|
| Contained by the month (`periodStart >= start AND periodEnd <= end`) | Excludes exactly the straddling runs. The dashboard opened on "the latest month with payroll" and then reported it as having none. |
| Overlapping the month | Two runs touch July, so July shows twice its own payroll. |

So the rule is the **end date alone** — `periodEnd BETWEEN start AND end` — which is also what a
pay run is named for. The dashboard applies it in three places that have to agree: choosing the
month it opens on, bucketing the twelve-month trend, and filtering pay runs.

## Documents are one model in both directions

`Document` covers HR sending something to be signed and HR asking for a file, because they are
the same object at different points: something is outstanding, then it is not. One status list
spans both — `DRAFT` → `AWAITING_SIGNATURE` → `SIGNED`, and `REQUESTED` → `SUBMITTED`.

`fileId` is null while a document is `REQUESTED`: nothing exists yet. `signedFileId` is a second
file written on signing, so the original is never modified — the certificate refers to the bytes
as they were sent, and that has to stay checkable.

The signature evidence is stored on the row rather than read through relations: `signerName`,
`signerEmail`, `signerIp`, `signerUserAgent`, `signedChecksum` and the signature image. The point
of a record is that it still says what happened after the person's name or the file has changed.

`StoredFile` is bytes on disk described by a row — a generated key, the original filename for
display only, a mime type, a size and a SHA-256 checksum. Four things point at it: a document's
original, a document's signed copy, an employee's avatar and the company logo.

The seed creates no documents or avatars; both are made through the app.

[documents.md](documents.md) covers the lifecycle, the storage rules, signing and the AI bridge
in full.

## Enumerations

All in `shared/src/enums.ts` as plain const objects rather than TypeScript `enum`s, so
the values survive JSON transport unchanged and can be iterated to build a select.

| Enum | Values |
|---|---|
| `Role` | `EMPLOYEE` `HR_MANAGER` `HR_PAYROLL_USER` `HR_PAYROLL_MANAGER` `ADMIN` |
| `EmployeeType` | `FULL_TIME` `PART_TIME` `CONTRACT` `INTERN` |
| `EmployeeStatus` | `ACTIVE` `ON_LEAVE` `INACTIVE` |
| `ContractStatus` | `DRAFT` `RUNNING` `EXPIRED` `CANCELLED` |
| `ContractType` | `PERMANENT` `FIXED_TERM` `INTERNSHIP` `FREELANCE` |
| `ScheduleType` | `FULL_TIME` `PART_TIME` `FLEXIBLE` |
| `AttendanceStatus` | `PRESENT` `LATE` `ABSENT` `MISSING_CHECKOUT` `HALF_DAY` |
| `LeaveUnit` | `DAY` `HOUR` |
| `LeaveRequestStatus` | `DRAFT` `TO_APPROVE` `APPROVED` `REFUSED` `CANCELLED` |
| `AllocationStatus` | `DRAFT` `APPROVED` `REFUSED` |
| `RuleCategory` | `BASIC` `ALLOWANCE` `GROSS` `DEDUCTION` `CONTRIBUTION` `NET` |
| `ComputeType` | `FIXED` `PERCENTAGE` `FORMULA` |
| `PayrunStatus` / `PayslipStatus` | `DRAFT` `COMPUTED` `VALIDATED` `PAID` `CANCELLED` |
| `EmailStatus` | `QUEUED` `SENT` `FAILED` |
| `DocumentKind` | `JOINING_LETTER` `OFFER_LETTER` `NDA` `CONTRACT` `POLICY` `ID_PROOF` `ADDRESS_PROOF` `QUALIFICATION` `OTHER` |
| `DocumentStatus` | `DRAFT` `REQUESTED` `AWAITING_SIGNATURE` `SUBMITTED` `SIGNED` `DECLINED` `CANCELLED` |

The web client maps every one of these to a label and a tone in `frontend/src/lib/status.ts`, so
a status reads the same wherever it appears.

The two document enums live in `shared/src/types.ts` rather than `enums.ts`, beside the DTOs
that use them.

## Migrations and seed

```bash
npm run db:migrate    # create and apply
npm run db:seed       # seed
npm run db:reset      # drop, re-migrate, reseed
npm run db:studio     # browse
```

The seed is deliberately imperfect so the warning paths are demonstrable: two employees have no
bank details, several attendance records are missing a check-out or were manually corrected, and
some contracts expire within 30 days.

There are three migrations:

| Migration | What it adds |
|---|---|
| `20260905181250_init` | The whole schema as it stood, including the required `Employee.userId`. Earlier hand-written migrations — notably the one that backfilled an account for every employee and an employee for every account before making that column required — were squashed into it. |
| `20260905185350_documents_and_files` | `StoredFile`, `Document`, `DocumentKind`, `DocumentStatus`, and `Employee.avatarId`. |
| `20260905201838_company_details` | The company profile columns and logo on `AppSettings`. |

A database created before the last two will not have the document tables, and the documents
screens will fail until `npm run db:migrate` (or `db:deploy`) is run.
