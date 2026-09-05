import "server-only";

import { notFound } from "next/navigation";
import { can, type AuthUser, type EmployeeDetailDto } from "@peoplepay360/shared";

import { requireAccess } from "@/lib/access";
import { ApiError, apiFetch } from "@/lib/api-client";

/**
 * The employee every tab of the record page is about.
 *
 * Each tab is its own route, so the layout and the page inside it both need
 * the record. Next dedupes an identical fetch within one request, so asking
 * twice costs one call rather than being a reason to thread the record through
 * a context.
 */
export async function getEmployee(
  id: string,
): Promise<EmployeeDetailDto | null> {
  try {
    return await apiFetch<EmployeeDetailDto>(`/employees/${id}`);
  } catch (error) {
    // The API answers 404 both for a missing record and for one this role may
    // not see, so the page cannot be used to probe for ids.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Which tabs a role may open. The nav and each tab's guard read this one list. */
export function employeeTabAccess(role: AuthUser["role"]) {
  return {
    attendance: can(role, "attendance", "read"),
    timeOff: can(role, "timeOffRequests", "read"),
    contracts: can(role, "contracts", "read"),
    payslips: can(role, "payslips", "read"),
    documents: can(role, "documents", "read"),
  };
}

/**
 * Guards one tab. The visitor needs to read employees to be on the record at
 * all, and the tab's own module to see what is filed under it — an HR manager
 * has no payroll access, so their Payslips tab neither renders nor opens by
 * hand-written URL. `requireAccess` redirects rather than throwing, so a role
 * that reaches for a tab it cannot have lands on a screen it can.
 */
export async function requireEmployeeTab(
  id: string,
  module: Parameters<typeof requireAccess>[0],
): Promise<{ session: AuthUser; employee: EmployeeDetailDto }> {
  await requireAccess("employees");
  const session = await requireAccess(module);

  const employee = await getEmployee(id);
  if (!employee) notFound();

  return { session, employee };
}
