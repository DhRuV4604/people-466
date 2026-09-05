/**
 * Role-based access control matrix (specification section 3).
 *
 * This lives in the shared package so the API can enforce it and the web app can
 * render navigation and hide controls from exactly the same definition. The web
 * copy is a convenience only - the API is always the enforcement point.
 */
import type { Role } from './enums';

export type Module =
  | 'employees'
  | 'contracts'
  | 'workingSchedules'
  | 'attendance'
  | 'timeOffRequests'
  | 'timeOffAllocations'
  | 'timeOffTypes'
  | 'payruns'
  | 'payslips'
  | 'salaryStructures'
  | 'salaryRules'
  | 'dashboard'
  | 'documents'
  | 'auditLogs';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'approve';

type ModuleGrants = Partial<Record<Action, boolean>>;
type RoleMatrix = Record<Module, ModuleGrants>;

const NONE: ModuleGrants = {};
const FULL: ModuleGrants = { read: true, create: true, update: true, delete: true, approve: true };
const CRU: ModuleGrants = { read: true, create: true, update: true };
const READ: ModuleGrants = { read: true };

// An Employee sees only their own rows; that narrowing is applied by the API's
// record scoping, not by this matrix.
const employeeMatrix: RoleMatrix = {
  employees: READ,
  contracts: READ,
  workingSchedules: READ,
  attendance: { read: true, create: true },
  timeOffRequests: { read: true, create: true },
  timeOffAllocations: READ,
  timeOffTypes: READ,
  payruns: NONE,
  // Their own only. The payslip service and the PDF route both narrow an
  // employee to rows carrying their employeeId, so this grant reaches exactly
  // what the API already lets through inline.
  payslips: READ,
  salaryStructures: NONE,
  salaryRules: NONE,
  dashboard: NONE,
  // Their own file only, narrowed by the API the same way payslips are.
  //
  // Read, and nothing else. Answering a request and signing are not powers an
  // employee holds in general - they are things they may do to one document,
  // because it was addressed to them, and the API checks that on the record.
  // Granting `create` here would have let anyone file a document into anyone
  // else's record, which is what those endpoints checked before this.
  documents: READ,
  // The trail records what everyone did, so only an admin may read it.
  auditLogs: NONE,
};

// HR Manager has no payroll access at all - that exception is the reason this
// matrix is written out per module rather than as a simple seniority ladder.
const hrManagerMatrix: RoleMatrix = {
  employees: FULL,
  contracts: FULL,
  workingSchedules: FULL,
  attendance: FULL,
  timeOffRequests: FULL,
  timeOffAllocations: FULL,
  timeOffTypes: FULL,
  payruns: NONE,
  payslips: NONE,
  salaryStructures: NONE,
  salaryRules: NONE,
  dashboard: NONE,
  // Managing people's files is HR's job before it is anyone else's.
  documents: FULL,
  // The trail records what everyone did, so only an admin may read it.
  auditLogs: NONE,
};

const hrPayrollUserMatrix: RoleMatrix = {
  ...hrManagerMatrix,
  payruns: CRU,
  payslips: CRU,
  salaryStructures: READ,
  salaryRules: READ,
  dashboard: READ,
};

const hrPayrollManagerMatrix: RoleMatrix = {
  ...hrPayrollUserMatrix,
  payruns: FULL,
  payslips: FULL,
  salaryStructures: FULL,
  salaryRules: FULL,
};

const adminMatrix: RoleMatrix = {
  employees: FULL,
  contracts: FULL,
  workingSchedules: FULL,
  attendance: FULL,
  timeOffRequests: FULL,
  timeOffAllocations: FULL,
  timeOffTypes: FULL,
  payruns: FULL,
  payslips: FULL,
  salaryStructures: FULL,
  salaryRules: FULL,
  dashboard: FULL,
  documents: FULL,
  // Read only, for everyone including the admin: a trail that can be edited or
  // pruned by the people it records is not a trail.
  auditLogs: READ,
};

const MATRIX: Record<Role, RoleMatrix> = {
  EMPLOYEE: employeeMatrix,
  HR_MANAGER: hrManagerMatrix,
  HR_PAYROLL_USER: hrPayrollUserMatrix,
  HR_PAYROLL_MANAGER: hrPayrollManagerMatrix,
  ADMIN: adminMatrix,
};

export function can(role: Role, module: Module, action: Action): boolean {
  return MATRIX[role]?.[module]?.[action] === true;
}

/** Employees may only ever read rows tied to their own employee record. */
export function scopeToOwnRecords(role: Role): boolean {
  return role === 'EMPLOYEE';
}

export function visibleModules(role: Role): Module[] {
  const matrix = MATRIX[role];
  return (Object.keys(matrix) as Module[]).filter((m) => matrix[m].read === true);
}
