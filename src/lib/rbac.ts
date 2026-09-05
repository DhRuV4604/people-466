// Role-based access control matching section 3 of the specification.
// Roles are cumulative in practice but expressed explicitly per module so that
// exceptions (HR Manager has zero payroll access) stay readable.

export const ROLES = [
  'EMPLOYEE',
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  HR_MANAGER: 'HR Manager',
  HR_PAYROLL_USER: 'HR Payroll User',
  HR_PAYROLL_MANAGER: 'HR Payroll Manager',
  ADMIN: 'Admin',
};

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
  | 'users';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'approve';

type ModuleGrants = Partial<Record<Action, boolean>>;
type RoleMatrix = Record<Module, ModuleGrants>;

const NONE: ModuleGrants = {};
const FULL: ModuleGrants = { read: true, create: true, update: true, delete: true, approve: true };
const CRU: ModuleGrants = { read: true, create: true, update: true };
const READ: ModuleGrants = { read: true };

// An Employee sees only their own records; the "own record" narrowing is applied
// by scopeToOwnRecords() below, not by this matrix.
const employeeMatrix: RoleMatrix = {
  employees: READ,
  contracts: READ,
  workingSchedules: READ,
  attendance: { read: true, create: true },
  timeOffRequests: { read: true, create: true },
  timeOffAllocations: READ,
  timeOffTypes: READ,
  payruns: NONE,
  payslips: NONE,
  salaryStructures: NONE,
  salaryRules: NONE,
  dashboard: NONE,
  users: NONE,
};

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
  users: NONE,
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
  dashboard: READ,
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
  users: FULL,
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

/** Employees may only ever see rows tied to their own employee record. */
export function scopeToOwnRecords(role: Role): boolean {
  return role === 'EMPLOYEE';
}

/** Modules a role can reach at all, used to build the navigation bar. */
export function visibleModules(role: Role): Module[] {
  const matrix = MATRIX[role];
  return (Object.keys(matrix) as Module[]).filter((m) => matrix[m].read === true);
}

export class AuthorizationError extends Error {
  constructor(module: Module, action: Action) {
    super(`Not authorized to ${action} ${module}`);
    this.name = 'AuthorizationError';
  }
}

export function assertCan(role: Role, module: Module, action: Action): void {
  if (!can(role, module, action)) throw new AuthorizationError(module, action);
}
