import "server-only";

import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import type {
  Paginated,
  DepartmentDto,
  EmployeeOptionDto,
  JobPositionDto,
  SalaryStructureDto,
  TimeOffTypeDto,
  WorkingScheduleDto,
} from "@peoplepay360/shared";

import { ApiError, SESSION_COOKIE, apiFetch } from "@/lib/api-client";
import type { FieldOption, RefName, Refs } from "@/lib/fields";

/**
 * Loads the option lists forms need to point one record at another.
 *
 * These change rarely and are read on nearly every screen, so each list is
 * cached under its own tag and a write invalidates only the tag it touched.
 * The cached function is handed its bearer token rather than reading the
 * cookie store, because `cookies()` is request scope and `unstable_cache`
 * runs outside it.
 */
const EMPTY: Refs = {
  departments: [],
  positions: [],
  schedules: [],
  employees: [],
  structures: [],
  timeOffTypes: [],
};

/** Cache tag per list, so a mutation can revalidate just what it changed. */
export const REF_TAGS: Record<RefName, string> = {
  departments: "refs:departments",
  positions: "refs:positions",
  schedules: "refs:schedules",
  employees: "refs:employees",
  structures: "refs:structures",
  timeOffTypes: "refs:time-off-types",
};

/** Reference lists are read constantly and change rarely. */
const TTL_SECONDS = 300;

/**
 * A role that cannot read a reference list still needs the page it is used on,
 * so a rejected list becomes an empty one rather than an error.
 */
/**
 * A dropdown has to offer every option, not the first page of them, so these
 * ask for the largest page the API will serve. The ceiling is real: past 500
 * rows a select is the wrong control anyway and the field wants a search.
 */
const ALL = 500;

async function soft<T>(path: string, token: string | null): Promise<T[]> {
  try {
    const answer = await apiFetch<Paginated<T> | T[]>(path, {
      token,
      revalidate: TTL_SECONDS,
      query: { pageSize: ALL },
    });
    // The paginated lists return an envelope; /employees/options is a plain
    // array because a dropdown feed was never a paged list.
    return Array.isArray(answer) ? answer : answer.items;
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}

/**
 * The token is part of the cache key: two roles can see different rows of the
 * same list, so caching one role's answer under a shared key would leak it.
 */
const LOADERS: Record<
  RefName,
  (token: string | null) => Promise<FieldOption[]>
> = {
  departments: async (token) =>
    (await soft<DepartmentDto>("/departments", token)).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  positions: async (token) =>
    (await soft<JobPositionDto>("/job-positions", token)).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  schedules: async (token) =>
    (await soft<WorkingScheduleDto>("/working-schedules", token)).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  employees: async (token) =>
    // /employees/options rather than /employees: a dropdown needs an id and a
    // label, not every column of every row plus its four relations.
    (await soft<EmployeeOptionDto>("/employees/options", token)).map((row) => ({
      value: row.id,
      label: `${row.fullName} · ${row.employeeCode}`,
    })),
  structures: async (token) =>
    (await soft<SalaryStructureDto>("/salary-structures", token)).map((row) => ({
      value: row.id,
      label: row.name,
    })),
  timeOffTypes: async (token) =>
    (await soft<TimeOffTypeDto>("/time-off/types", token)).map((row) => ({
      value: row.id,
      label: row.name,
    })),
};

function load(name: RefName, token: string | null): Promise<FieldOption[]> {
  return unstable_cache(
    () => LOADERS[name](token),
    // The token is in the key so one role's view is never served to another.
    ["refs", name, token ?? "anon"],
    { revalidate: TTL_SECONDS, tags: [REF_TAGS[name]] },
  )();
}

/** Loads only the lists a page asks for, in parallel. */
export async function loadRefs(names: RefName[]): Promise<Refs> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;

  const loaded = await Promise.all(names.map((name) => load(name, token)));
  const refs: Refs = { ...EMPTY };
  names.forEach((name, index) => {
    refs[name] = loaded[index];
  });
  return refs;
}
