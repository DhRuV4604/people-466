# PeoplePay360 — HR & Payroll

An integrated human resource and payroll operations platform. The employee record is the
central hub; contracts and working schedules supply payroll context, attendance and time off
capture daily activity, salary structures and rules define computation, and pay runs turn
eligible employees into validated payslips that can be printed as PDF and emailed.

## Stack

Next.js 15 (App Router, server actions) · Prisma ORM · SQLite · Tailwind CSS · Recharts · PDFKit

SQLite keeps setup to a single command. Switching to PostgreSQL is a one-line change to the
`datasource` block in `prisma/schema.prisma`.

## Getting started

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run setup          # generate client, create the database, load demo data
npm run dev            # http://localhost:3000
```

`npm run db:reset` rebuilds the database and reseeds it from scratch.

### Demo accounts

All accounts use the password `password123`.

| Email | Role | Sees |
|---|---|---|
| `admin@peoplepay360.com` | Admin | Everything, including user management |
| `payroll@peoplepay360.com` | HR Payroll Manager | All HR plus full payroll and salary configuration |
| `hr@peoplepay360.com` | HR Manager | All HR; **no** payroll access |
| `employee@peoplepay360.com` | Employee | Own records only, via My Space |

## What the seed data contains

25 employees across 5 departments, 44 contracts (including expired ones so period-based
resolution is observable), ~1,650 attendance records over three months with deliberate
exceptions, 4 time off types with allocations and requests, 2 salary structures with 15
sequenced rules, and 2 completed pay runs so dashboard trends have real history.

Some imperfections are intentional, so the warning paths are demonstrable rather than
theoretical: two employees have no bank details, several attendance records are missing a
check-out or were manually corrected, and some contracts expire within 30 days.

## Business rules

These are implemented in application logic, not hardcoded values.

**Period-scoped contracts** — `src/lib/contracts.ts`
An employee may hold many contracts over time. Payroll resolves the single `RUNNING`
contract whose date range overlaps the payroll period; expired contracts are never used.
Creating overlapping running contracts is rejected at save time.

**Schedule-derived hours** — `src/lib/schedule.ts`
Weekly hours are always computed from the day/start/end/break pattern and never entered by
hand. Overnight shifts (22:00 → 06:00) roll over correctly. Period working days come from the
schedule rather than a flat 30-day assumption.

**Allocation-backed leave** — `src/lib/timeoff.ts`
Balance is derived as approved allocations minus approved requests, never stored. Approving a
request links it to a specific allocation so consumption is auditable. Requests are blocked
when they overlap existing leave, exceed the remaining balance, or breach a per-request cap.
Leave duration counts only scheduled working days.

**Attendance exceptions** — `src/lib/attendance.ts`
Worked hours, overtime and status are derived from the punches plus that weekday's schedule.
Late arrival, half day and missing check-out are detected automatically. Manual corrections
record who changed the record, when, and why.

**Sequenced salary rules** — `src/lib/payroll.ts`
Rules execute in ascending sequence, and each result is written into scope under its code so
later rules build on earlier subtotals — `NET` is literally `GROSS - PF - PT - TDS - ULD`, not
a hardcoded sum. Rules support fixed amounts, percentages of another rule, and formulas, with
an optional condition that skips the rule entirely.

Formulas are evaluated in a restricted scope: dangerous identifiers are rejected before
evaluation and globals are shadowed, so a formula cannot reach the host environment.

**Payroll warnings** — surfaced before validation, and validation is blocked while any remain:
duplicate payslips covering the same period, missing bank details, no applicable contract, and
negative net pay.

## End-to-end flows to demo

**Employee to payslip**
1. Employees → open an employee → smart buttons show related Contracts, Attendance, Time Off,
   Allocations and Payslips, each opening a filtered list.
2. Payroll → Pay Runs → New. Step 1 sets structure and period; **Continue creates nothing**.
   Step 2 lists only eligible staff, showing exactly why anyone is excluded.
3. Create Pay Run → Compute → review warnings → Validate → Mark Paid → Send Payslips.
4. Open any payslip for the rule-by-rule breakdown, then Print Payslip (PDF).

**Leave allocation to request**
1. Time Off → Time Off Types → inspect a policy (unit, allocation requirement, paid flag).
2. Time Off → Allocations → New → grant a balance → Approve.
3. Time Off → Requests → New → the form shows the live balance and blocks over-draw.
4. Approve the request → the linked allocation is drawn down and visible on both records.

## Email delivery

With no `SMTP_HOST` set, **Send Payslips** records each message in the in-app Email Outbox
(Payroll → Email Outbox) with its genuinely generated PDF attachment, so the bulk flow is
fully demonstrable without credentials. Setting `SMTP_HOST` in `.env` switches to live sending
via Nodemailer (`npm i nodemailer`).

## Project layout

```
prisma/
  schema.prisma          data model
  seed.ts                demo dataset
src/
  lib/                   business logic (payroll, contracts, timeoff, attendance, schedule, rbac)
  components/            shared UI and forms
  app/(app)/             authenticated modules
  app/api/payslips/      payslip PDF route
```

## Roadmap

Approval chains with delegation; payroll journal export to accounting; employee document
storage; multi-currency and multi-company; biometric/geofenced attendance capture; statutory
report generation; and a scheduled job to auto-close contracts and expire allocations.
