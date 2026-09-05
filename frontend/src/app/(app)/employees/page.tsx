import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_TYPES,
  can,
  type EmployeeSummaryDto,
  type Paginated,
} from "@peoplepay360/shared";

import { FilterBar } from "@/components/data/filter-bar";
import { EmptyState } from "@/components/data/primitives";
import { RecordDialog } from "@/components/form";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { apiFetch } from "@/lib/api-client";
import { loadRefs } from "@/lib/refs";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { EmployeeCards, EmployeeList } from "./_components/employee-views";
import { saveEmployee } from "./actions";
import { employeeFields } from "./fields";

export const metadata: Metadata = {
  title: "Employees",
  description: "Everyone on the payroll, and their current status.",
};

type SearchParams = Promise<{
  q?: string;
  department?: string;
  type?: string;
  status?: string;
  missingBank?: string;
  view?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("employees");

  const params = await searchParams;
  const view = params.view === "list" ? "list" : "cards";
  const missingBank = params.missingBank === "true";

  // Filtering happens in the API, so the browser never holds the full table
  // and the Employee role's own-records scoping is applied at the source.
  const [employeePage, refs] = await Promise.all([
    apiFetch<Paginated<EmployeeSummaryDto>>("/employees", {
      query: {
        ...pageQuery(params),
        q: params.q,
        departmentId: params.department,
        employeeType: params.type,
        status: params.status,
        missingBank: missingBank ? "true" : undefined,
      },
    }),
    loadRefs(["departments", "positions", "schedules", "employees"]),
  ]);

  const employees = employeePage.items;

  const canCreate = can(session.role, "employees", "create");
  const canDelete = can(session.role, "employees", "delete");
  const hasFilters = Boolean(
    params.q || params.department || params.status || params.type || missingBank,
  );

  return (
    <>
      <FilterBar
        search={{ placeholder: "Search name, email or code" }}
        selects={[
          {
            key: "department",
            placeholder: "All departments",
            width: "w-44",
            options: refs.departments,
          },
          {
            key: "status",
            placeholder: "Any status",
            width: "w-36",
            options: statusOptions(EMPLOYEE_STATUSES),
          },
          {
            key: "type",
            placeholder: "Any type",
            width: "w-36",
            options: statusOptions(EMPLOYEE_TYPES),
          },
        ]}
        quickFilters={[
          { key: "missingBank", value: "true", label: "Missing bank details" },
          { key: "status", value: "ACTIVE", label: "Active" },
          { key: "status", value: "ON_LEAVE", label: "On leave" },
        ]}
        count={{ total: employeePage.total, noun: "employee" }}
        views
        actions={
          canCreate ? (
            <RecordDialog
              title="Add employee"
              description="Anything left blank can be filled in later, apart from the bank details payroll needs to pay them."
              fields={employeeFields(refs)}
              action={saveEmployee}
              submitLabel="Add employee"
            />
          ) : null
        }
      />

      {employees.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={hasFilters ? "Nobody matches those filters" : "No employees yet"}
          description={
            hasFilters
              ? "Try a broader search, or clear a filter to widen the results."
              : "Once employees are added they appear here with their department, contract type and payroll readiness."
          }
        />
      ) : view === "list" ? (
        <EmployeeList employees={employees} canDelete={canDelete} />
      ) : (
        <EmployeeCards employees={employees} canDelete={canDelete} />
      )}

      <Pagination meta={employeePage} noun="employee" />
    </>
  );
}
