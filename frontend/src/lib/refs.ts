import "server-only";

import type {
  DepartmentDto,
  EmployeeSummaryDto,
  JobPositionDto,
  SalaryStructureDto,
  TimeOffTypeDto,
  WorkingScheduleDto,
} from "@peoplepay360/shared";

import { ApiError, apiFetch } from "@/lib/api-client";
import type { FieldOption, RefName, Refs } from "@/lib/fields";

/**
 * Loads the option lists forms need to point one record at another. Doing it
 * in one call keeps a page's data fetching to two awaits: its own rows, and
 * the references.
 */
const EMPTY: Refs = {
  departments: [],
  positions: [],
  schedules: [],
  employees: [],
  structures: [],
  timeOffTypes: [],
};

/**
 * A role that cannot read a reference list still needs the page it is used on,
 * so a rejected list becomes an empty one rather than an error.
 */
async function soft<T>(path: string): Promise<T[]> {
  try {
    return await apiFetch<T[]>(path);
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}

const LOADERS: Record<RefName, () => Promise<FieldOption[]>> = {
  departments: async () =>
    (await soft<DepartmentDto>("/departments")).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  positions: async () =>
    (await soft<JobPositionDto>("/job-positions")).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  schedules: async () =>
    (await soft<WorkingScheduleDto>("/working-schedules")).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  employees: async () =>
    (await soft<EmployeeSummaryDto>("/employees")).map((row) => ({
      value: row.id,
      label: `${row.fullName} · ${row.employeeCode}`,
    })),
  structures: async () =>
    (await soft<SalaryStructureDto>("/salary-structures")).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  timeOffTypes: async () =>
    (await soft<TimeOffTypeDto>("/time-off/types")).map((row) => ({
      value: row.id,
      label: row.name,
    })),
};

/** Loads only the lists a page asks for, in parallel. */
export async function loadRefs(names: RefName[]): Promise<Refs> {
  const loaded = await Promise.all(names.map((name) => LOADERS[name]()));
  const refs: Refs = { ...EMPTY };
  names.forEach((name, index) => {
    refs[name] = loaded[index];
  });
  return refs;
}
