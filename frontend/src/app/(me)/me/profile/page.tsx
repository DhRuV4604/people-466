import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import {
  ROLE_LABELS,
  scopeToOwnRecords,
  type ContractDto,
  type EmployeeDetailDto,
} from "@peoplepay360/shared";

import { StatusBadge } from "@/components/data/status-badge";
import { Badge, Button, Card, UserAvatar, buttonVariants } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { landingFor, requireMe } from "@/lib/access";
import {
  EMPLOYEE_TYPE_LABELS,
  dateRange,
  formatDate,
  money,
} from "@/lib/format";

import { logoutAction } from "@/app/(app)/actions";

export const metadata: Metadata = { title: "Profile" };

async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export default async function MeProfile() {
  const user = await requireMe();

  const [employee, contracts] = await Promise.all([
    soft(apiFetch<EmployeeDetailDto | null>(`/employees/${user.employeeId}`), null),
    soft(
      apiFetch<ContractDto[]>("/contracts", {
        query: { employeeId: user.employeeId, status: "RUNNING" },
      }),
      [],
    ),
  ]);

  const contract = contracts[0];
  const hasPanel = !scopeToOwnRecords(user.role);

  return (
    <>
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar name={user.name} size="lg" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[employee?.jobPosition?.name, employee?.department?.name]
              .filter(Boolean)
              .join(" · ") || user.email}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {employee ? <StatusBadge value={employee.status} /> : null}
          <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
        </div>
      </Card>

      {employee ? (
        <section aria-labelledby="about">
          <h2 id="about" className="mb-2 text-sm font-medium text-muted-foreground">
            About you
          </h2>
          <Card>
            <dl className="divide-y divide-border">
              <Row label="Employee code" value={<span className="font-mono">{employee.employeeCode}</span>} />
              <Row label="Work email" value={employee.workEmail} />
              <Row label="Phone" value={employee.workPhone} />
              <Row label="Employment" value={EMPLOYEE_TYPE_LABELS[employee.employeeType]} />
              <Row label="Joined" value={formatDate(employee.hireDate)} />
              <Row label="Manager" value={employee.manager?.fullName} />
              <Row label="Working schedule" value={employee.workingSchedule?.name} />
            </dl>
          </Card>
        </section>
      ) : null}

      {contract ? (
        <section aria-labelledby="contract">
          <h2 id="contract" className="mb-2 text-sm font-medium text-muted-foreground">
            Current contract
          </h2>
          <Card>
            <dl className="divide-y divide-border">
              <Row label="Name" value={contract.name} />
              <Row label="Period" value={dateRange(contract.dateStart, contract.dateEnd)} />
              <Row label="Monthly wage" value={<span className="tabular-nums">{money(contract.wage)}</span>} />
              <Row label="Status" value={<StatusBadge value={contract.status} />} />
            </dl>
          </Card>
        </section>
      ) : null}

      <section aria-label="Account" className="flex flex-col gap-2">
        {hasPanel ? (
          <Link
            href={landingFor({ ...user, employeeId: null })}
            className={buttonVariants({ variant: "outline", size: "lg", fullWidth: true })}
          >
            <LayoutDashboard />
            Open the admin panel
          </Link>
        ) : null}
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="lg" fullWidth startIcon={<LogOut />}>
            Sign out
          </Button>
        </form>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Something wrong here? Ask HR — these details are theirs to change.
      </p>
    </>
  );
}
