/**
 * Domain enumerations shared by the API and the web client.
 *
 * These are plain const objects rather than TypeScript `enum`s so the values
 * survive JSON transport unchanged and can be iterated for building select
 * inputs on the frontend.
 */

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

export const EMPLOYEE_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number];

export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const CONTRACT_STATUSES = ['DRAFT', 'RUNNING', 'EXPIRED', 'CANCELLED'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_TYPES = ['PERMANENT', 'FIXED_TERM', 'INTERNSHIP', 'FREELANCE'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const SCHEDULE_TYPES = ['FULL_TIME', 'PART_TIME', 'FLEXIBLE'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'MISSING_CHECKOUT',
  'HALF_DAY',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_UNITS = ['DAY', 'HOUR'] as const;
export type LeaveUnit = (typeof LEAVE_UNITS)[number];

export const LEAVE_REQUEST_STATUSES = [
  'DRAFT',
  'TO_APPROVE',
  'APPROVED',
  'REFUSED',
  'CANCELLED',
] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const ALLOCATION_STATUSES = ['DRAFT', 'APPROVED', 'REFUSED'] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const RULE_CATEGORIES = [
  'BASIC',
  'ALLOWANCE',
  'GROSS',
  'DEDUCTION',
  'CONTRIBUTION',
  'NET',
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  BASIC: 'Basic',
  ALLOWANCE: 'Allowance',
  GROSS: 'Gross',
  DEDUCTION: 'Deduction',
  CONTRIBUTION: 'Contribution',
  NET: 'Net',
};

export const COMPUTE_TYPES = ['FIXED', 'PERCENTAGE', 'FORMULA'] as const;
export type ComputeType = (typeof COMPUTE_TYPES)[number];

export const PAYRUN_STATUSES = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED'] as const;
export type PayrunStatus = (typeof PAYRUN_STATUSES)[number];

export const PAYSLIP_STATUSES = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED'] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export const EMAIL_STATUSES = ['QUEUED', 'SENT', 'FAILED'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** What an audited action did. Wider than CRUD, because approving or paying is
 *  the thing someone will actually search the trail for. */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REFUSE',
  'CANCEL',
  'COMPUTE',
  'VALIDATE',
  'PAY',
  'SEND',
  'LOGIN',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Edited',
  DELETE: 'Deleted',
  APPROVE: 'Approved',
  REFUSE: 'Refused',
  CANCEL: 'Cancelled',
  COMPUTE: 'Computed',
  VALIDATE: 'Validated',
  PAY: 'Marked paid',
  SEND: 'Sent',
  LOGIN: 'Signed in',
};

/** Deductions and contributions reduce net pay; every other category adds to it. */
export function isNegativeCategory(category: string): boolean {
  return category === 'DEDUCTION' || category === 'CONTRIBUTION';
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
