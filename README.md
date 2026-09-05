# PeoplePay360 — HR & Payroll

An integrated human resource and payroll operations platform. The employee record is the
central hub; contracts and working schedules supply payroll context, attendance and time off
capture daily activity, salary structures and rules define computation, and pay runs turn
eligible employees into validated payslips that can be printed as PDF and emailed.

## Architecture

A workspace monorepo with a clean separation between the API, the web client, and the domain
contracts they share.

```
peoplepay360/
├── apps/
│   ├── api/                  NestJS REST API — the only thing that touches the database
│   │   ├── prisma/           schema + migrations + seed
│   │   └── src/
│   │       ├── common/       cross-cutting: decorators, filters, decimal helpers
│   │       ├── config/       typed configuration
│   │       ├── prisma/       database module
│   │       └── modules/      one folder per bounded context
│   │           ├── auth/         JWT strategy, guards, login
│   │           ├── employees/    controller → service → Prisma
│   │           ├── contracts/    period-scoped contract resolution
│   │           ├── attendance/   punches, exceptions, corrections
│   │           ├── time-off/     types, allocations, requests
│   │           ├── payroll/      engine, payslips, pay runs, PDF, mail
│   │           ├── config/       schedules, departments, positions, users
│   │           └── dashboard/    live aggregation
│   └── web/                  Next.js client — no database access at all
│       └── src/
│           ├── lib/          API client + session handling
│           ├── components/   shared UI
│           └── app/          routes, server actions
└── packages/
    └── shared/               types, enums, RBAC matrix, pure domain maths
```

**Why this shape.** The API owns every database read and write, so authorisation cannot be
bypassed by calling a different client. The web app holds only a session cookie and an HTTP
client. The `shared` package carries the pieces both genuinely need — the RBAC matrix, the
transport DTOs, and pure calculations like weekly-hours derivation — so the client can preview
a value using the exact function the server will use to persist it.

**Layering inside the API.** Controllers handle HTTP and permissions; services hold business
logic and are the only callers of Prisma; DTOs validate input at the boundary with
`class-validator`. Guards run globally, so a new route is authenticated by default and must
opt out explicitly with `@Public()`.

## Stack

NestJS 11 · Prisma 6 · PostgreSQL 16 · Next.js 15 · TypeScript · Tailwind · Recharts · PDFKit

## Getting started

Requires Node 20+ and Docker.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run setup     # start Postgres, build shared, migrate, seed
npm run dev       # API on :4000, web on :3000
```

Open http://localhost:3000. API docs (Swagger) are at http://localhost:4000/api/docs.

Postgres runs on **5433**, not the default 5432, so it cannot collide with another Postgres
already running on your machine.

### Everything in Docker

```bash
npm run docker:up      # db + api + web
npm run docker:down
```

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and web together |
| `npm run dev:api` / `npm run dev:web` | Run one side only |
| `npm run build` | Build shared, API and web |
| `npm run typecheck` | Typecheck all three packages |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:reset` | Drop, re-migrate and reseed |
| `npm run db:studio` | Prisma Studio |

### Demo accounts

All use the password `password123`.

| Email | Role | Sees |
|---|---|---|
| `admin@peoplepay360.com` | Admin | Everything, including user management |
| `payroll@peoplepay360.com` | HR Payroll Manager | All HR plus full payroll and salary configuration |
| `hr@peoplepay360.com` | HR Manager | All HR; **no** payroll access |
| `employee@peoplepay360.com` | Employee | Own records only, via My Space |

## Seed data

25 employees across 5 departments, 46 contracts (including expired ones so period-based
resolution is observable), ~1,650 attendance records over three months, 4 time off types with
allocations and requests, 2 salary structures with 15 sequenced rules, and 2 completed pay runs
so dashboard trends have real history.

Some imperfections are intentional, so the warning paths are demonstrable rather than
theoretical: two employees have no bank details, several attendance records are missing a
check-out or were manually corrected, and some contracts expire within 30 days.

## Business rules

Implemented in application logic, not hardcoded values.

**Period-scoped contracts** — `apps/api/src/modules/contracts/`
An employee may hold many contracts over time. Payroll resolves the single `RUNNING` contract
whose date range overlaps the payroll period; expired contracts are never used. Creating
overlapping running contracts is rejected at save time.

**Schedule-derived hours** — `packages/shared/src/domain.ts`
Weekly hours are always computed from the day/start/end/break pattern and never accepted from a
client. Overnight shifts (22:00 → 06:00) roll over correctly. Period working days come from the
schedule rather than a flat 30-day assumption.

**Allocation-backed leave** — `apps/api/src/modules/time-off/`
Balance is derived as approved allocations minus approved requests, never stored. Approving a
request links it to a specific allocation so consumption is auditable. Requests are blocked when
they overlap existing leave, exceed the remaining balance, or breach a per-request cap. Leave
duration counts only scheduled working days.

**Attendance exceptions** — `apps/api/src/modules/attendance/`
Worked hours, overtime and status are derived from the punches plus that weekday's schedule.
Late arrival, half day and missing check-out are detected automatically. Manual corrections
record who changed the record, when, and why.

**Sequenced salary rules** — `apps/api/src/modules/payroll/payroll-engine.service.ts`
Rules execute in ascending sequence, and each result enters scope under its code so later rules
build on earlier subtotals — `NET` is literally `GROSS - PF - PT - TDS - ULD`, not a hardcoded
sum. Rules support fixed amounts, percentages of another rule, and formulas, with an optional
condition that skips the rule entirely. Formulas are validated before being stored.

Formulas evaluate in a restricted scope: dangerous identifiers are rejected before evaluation
and globals are shadowed, so a formula cannot reach the host environment.

**Payroll warnings** — surfaced before validation, and validation is blocked while any remain:
duplicate payslips covering the same period, missing bank details, no applicable contract, and
negative net pay.

**Money precision** — all currency and hour columns are PostgreSQL `NUMERIC`, not floats, so
payroll totals reconcile to the cent. Values are normalised to plain numbers at the API
boundary.

## Security notes

- The JWT lives in an **httpOnly** cookie, so client-side JavaScript can never read it. The
  Next.js server attaches it as a bearer token when calling the API.
- Payslip PDFs are fetched through a small Next.js proxy route, because a browser cannot set an
  `Authorization` header on a plain link. The proxy reads the cookie server-side.
- Every token is re-checked against the database on each request, so a deactivated account or a
  changed role takes effect immediately rather than at token expiry.
- The API refuses to boot in production if `JWT_SECRET` is shorter than 32 characters.
- Requests with unknown body fields are rejected outright rather than silently stripped.

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

With no `SMTP_HOST` set on the API, **Send Payslips** records each message in the in-app Email
Outbox (Payroll → Email Outbox) with its genuinely generated PDF attachment, so the bulk flow is
fully demonstrable without credentials. Setting `SMTP_HOST` switches to live sending via
Nodemailer (`npm i nodemailer -w @peoplepay360/api`).

## Roadmap

Approval chains with delegation; payroll journal export to accounting; employee document
storage; multi-currency and multi-company; biometric or geofenced attendance capture; statutory
report generation; and a scheduled job to auto-close contracts and expire allocations.
